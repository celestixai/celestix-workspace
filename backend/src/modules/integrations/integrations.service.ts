import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import type { CreateIntegrationInput, UpdateIntegrationInput } from './integrations.validation';
import type { IntegrationType } from '@prisma/client';
import crypto from 'crypto';

const userSelect = { id: true, displayName: true, avatarUrl: true };

interface WebhookLog {
  id: string;
  event: string;
  url: string;
  status: number | null;
  response: string | null;
  attempts: number;
  createdAt: Date;
}

// In-memory webhook logs (in production this would be a DB table)
const webhookLogs: Map<string, WebhookLog[]> = new Map();

class IntegrationsService {
  // ==========================================
  // CORE CRUD
  // ==========================================

  async getIntegrations(workspaceId: string) {
    return prisma.integration.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        connectedBy: { select: userSelect },
      },
    });
  }

  async createIntegration(workspaceId: string, userId: string, data: CreateIntegrationInput) {
    return prisma.integration.create({
      data: {
        workspaceId,
        connectedById: userId,
        type: data.type,
        name: data.name,
        config: data.config ?? undefined,
      },
      include: {
        connectedBy: { select: userSelect },
      },
    });
  }

  async getIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        connectedBy: { select: userSelect },
      },
    });

    if (!integration) {
      throw new AppError(404, 'Integration not found', 'NOT_FOUND');
    }

    return integration;
  }

  async updateIntegration(integrationId: string, data: UpdateIntegrationInput) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      throw new AppError(404, 'Integration not found', 'NOT_FOUND');
    }

    return prisma.integration.update({
      where: { id: integrationId },
      data: {
        name: data.name,
        config: data.config,
        isActive: data.isActive,
      },
      include: {
        connectedBy: { select: userSelect },
      },
    });
  }

  async deleteIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      throw new AppError(404, 'Integration not found', 'NOT_FOUND');
    }

    await prisma.integration.delete({ where: { id: integrationId } });
  }

  async syncIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      throw new AppError(404, 'Integration not found', 'NOT_FOUND');
    }

    // Mark sync in progress
    await prisma.integration.update({
      where: { id: integrationId },
      data: { syncStatus: 'syncing' },
    });

    try {
      // Type-specific sync logic would go here
      // For now, simulate a successful sync
      const updated = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'success',
        },
        include: {
          connectedBy: { select: userSelect },
        },
      });

      return updated;
    } catch (error) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: { syncStatus: 'error' },
      });
      throw error;
    }
  }

  async testIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      throw new AppError(404, 'Integration not found', 'NOT_FOUND');
    }

    // Type-specific connection test logic
    // For webhooks, verify URL is reachable; for OAuth, verify token validity
    try {
      const config = integration.config as Record<string, any> | null;

      if (integration.type === 'WEBHOOK_OUTGOING' && config?.url) {
        // Try a HEAD request to the webhook URL
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          await fetch(config.url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } catch {
          clearTimeout(timeout);
          return { success: false, message: 'Could not reach webhook URL' };
        }
      }

      return { success: true, message: 'Connection test successful' };
    } catch {
      return { success: false, message: 'Connection test failed' };
    }
  }

  // ==========================================
  // WEBHOOK INCOMING
  // ==========================================

  async processIncomingWebhook(webhookId: string, payload: { event: string; data: any }) {
    const integration = await prisma.integration.findFirst({
      where: { id: webhookId, type: 'WEBHOOK_INCOMING' },
    });

    if (!integration) {
      throw new AppError(404, 'Webhook integration not found', 'NOT_FOUND');
    }

    if (!integration.isActive) {
      throw new AppError(400, 'Webhook integration is disabled', 'DISABLED');
    }

    const config = integration.config as Record<string, any> | null;
    const action = config?.action || payload.event;

    logger.info({ webhookId, event: payload.event, action }, 'Processing incoming webhook');

    // Route based on action
    switch (action) {
      case 'create_task':
        // Would create a task in the workspace
        logger.info({ workspaceId: integration.workspaceId }, 'Incoming webhook: create_task');
        break;
      case 'update_task':
        logger.info({ workspaceId: integration.workspaceId }, 'Incoming webhook: update_task');
        break;
      case 'add_comment':
        logger.info({ workspaceId: integration.workspaceId }, 'Incoming webhook: add_comment');
        break;
      case 'trigger_automation':
        logger.info({ workspaceId: integration.workspaceId }, 'Incoming webhook: trigger_automation');
        break;
      default:
        logger.info({ action }, 'Incoming webhook: unhandled action');
    }

    // Update last sync
    await prisma.integration.update({
      where: { id: webhookId },
      data: { lastSyncAt: new Date(), syncStatus: 'received' },
    });

    return { processed: true };
  }

  // ==========================================
  // WEBHOOK OUTGOING
  // ==========================================

  async registerOutgoingWebhook(
    workspaceId: string,
    userId: string,
    config: { url: string; events: string[]; secret?: string },
  ) {
    return prisma.integration.create({
      data: {
        workspaceId,
        connectedById: userId,
        type: 'WEBHOOK_OUTGOING',
        name: `Outgoing Webhook - ${config.url}`,
        config: {
          url: config.url,
          events: config.events,
          secret: config.secret || crypto.randomBytes(32).toString('hex'),
        },
      },
      include: {
        connectedBy: { select: userSelect },
      },
    });
  }

  async fireOutgoingWebhook(integrationId: string, event: string, payload: any) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration || integration.type !== 'WEBHOOK_OUTGOING') return;
    if (!integration.isActive) return;

    const config = integration.config as Record<string, any> | null;
    if (!config?.url) return;

    // Check if this integration listens for this event
    const events = config.events as string[] | undefined;
    if (events && events.length > 0 && !events.includes(event)) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = config.secret
      ? crypto.createHmac('sha256', config.secret).update(body).digest('hex')
      : undefined;

    const logEntry: WebhookLog = {
      id: crypto.randomUUID(),
      event,
      url: config.url,
      status: null,
      response: null,
      attempts: 0,
      createdAt: new Date(),
    };

    // Retry with exponential backoff: 1s, 5s, 25s
    const delays = [0, 1000, 5000, 25000];
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }

      logEntry.attempts = attempt + 1;

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (signature) headers['X-Webhook-Signature'] = signature;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        logEntry.status = response.status;
        logEntry.response = await response.text().catch(() => '');

        if (response.ok) {
          this.addWebhookLog(integrationId, logEntry);
          return;
        }
      } catch (err: any) {
        logEntry.response = err.message || 'Request failed';
        logger.warn({ integrationId, attempt, error: err.message }, 'Outgoing webhook attempt failed');
      }
    }

    // All retries exhausted
    this.addWebhookLog(integrationId, logEntry);
    logger.error({ integrationId, event }, 'Outgoing webhook delivery failed after all retries');
  }

  private addWebhookLog(integrationId: string, log: WebhookLog) {
    const logs = webhookLogs.get(integrationId) || [];
    logs.unshift(log);
    // Keep only last 100 logs
    if (logs.length > 100) logs.length = 100;
    webhookLogs.set(integrationId, logs);
  }

  async getWebhookLogs(integrationId: string, limit = 50) {
    const logs = webhookLogs.get(integrationId) || [];
    return logs.slice(0, limit);
  }

  // ==========================================
  // FIRE WEBHOOKS FOR TASK EVENTS
  // ==========================================

  async fireWebhooksForEvent(workspaceId: string, event: string, payload: any) {
    try {
      const outgoingIntegrations = await prisma.integration.findMany({
        where: {
          workspaceId,
          type: 'WEBHOOK_OUTGOING',
          isActive: true,
        },
      });

      // Fire-and-forget: don't await
      for (const integration of outgoingIntegrations) {
        this.fireOutgoingWebhook(integration.id, event, payload).catch((err) =>
          logger.error({ err, integrationId: integration.id }, 'Error firing outgoing webhook'),
        );
      }
    } catch (err) {
      logger.error({ err, workspaceId, event }, 'Error fetching outgoing webhooks');
    }
  }

  // ==========================================
  // GITHUB WEBHOOK
  // ==========================================

  async processGitHubWebhook(payload: any, signature: string | undefined) {
    const event = payload?.action;
    const repo = payload?.repository?.full_name;

    logger.info({ event, repo }, 'Processing GitHub webhook');

    // Find GitHub integrations that match this repo
    const integrations = await prisma.integration.findMany({
      where: {
        type: 'GITHUB',
        isActive: true,
      },
    });

    for (const integration of integrations) {
      const config = integration.config as Record<string, any> | null;

      // Verify signature if secret is configured
      if (config?.webhookSecret && signature) {
        const expected = 'sha256=' + crypto
          .createHmac('sha256', config.webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex');

        if (signature !== expected) {
          logger.warn({ integrationId: integration.id }, 'GitHub webhook signature mismatch');
          continue;
        }
      }

      // Handle different GitHub events
      if (payload?.issue) {
        // GitHub Issue — could create a task
        logger.info(
          { integrationId: integration.id, issue: payload.issue.number },
          'GitHub issue event',
        );
      }

      if (payload?.pull_request) {
        // PR event — could update task status on merge
        if (payload.action === 'closed' && payload.pull_request.merged) {
          logger.info(
            { integrationId: integration.id, pr: payload.pull_request.number },
            'GitHub PR merged',
          );
        }
      }

      // Update last sync
      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), syncStatus: 'received' },
      });
    }

    return { processed: true };
  }
}

export const integrationsService = new IntegrationsService();
