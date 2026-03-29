import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import type { CreateWorkflowInput, UpdateWorkflowInput } from './workflows.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

export class WorkflowService {
  async create(userId: string, input: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
        workspaceId: input.workspaceId,
        userId,
      },
      include: {
        user: { select: userSelect },
      },
    });
  }

  async getAll(userId: string) {
    return prisma.workflow.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(userId: string, workflowId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return workflow;
  }

  async update(userId: string, workflowId: string, input: UpdateWorkflowInput) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger ? (input.trigger as Prisma.InputJsonValue) : undefined,
        actions: input.actions ? (input.actions as Prisma.InputJsonValue) : undefined,
        isEnabled: input.isEnabled,
      },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });
  }

  async delete(userId: string, workflowId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });
  }

  async toggle(workflowId: string, userId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflow.update({
      where: { id: workflowId },
      data: { isEnabled: !workflow.isEnabled },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });
  }

  async getRuns(workflowId: string, userId: string) {
    // Verify ownership
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async getRunById(runId: string) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!run) {
      throw new AppError(404, 'Workflow run not found', 'NOT_FOUND');
    }

    return run;
  }

  async executeWorkflow(workflowId: string, triggerData: Record<string, unknown>) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    // Create a run record
    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        status: 'RUNNING',
        triggerData: triggerData as Prisma.InputJsonValue,
        startedAt: new Date(),
      },
    });

    const actionResults: Array<{ actionType: string; status: string; output?: unknown }> = [];

    try {
      const actions = workflow.actions as Array<{ type: string; config: Record<string, unknown> }>;

      for (const action of actions) {
        logger.info({ workflowId, runId: run.id, actionType: action.type }, 'Executing workflow action');

        try {
          const output = await this.executeAction(action, triggerData);
          actionResults.push({ actionType: action.type, status: 'completed', output });
        } catch (actionErr) {
          const errMsg = actionErr instanceof Error ? actionErr.message : 'Action failed';
          actionResults.push({ actionType: action.type, status: 'failed', output: { error: errMsg } });
          throw actionErr; // Fail the whole run
        }
      }

      // Mark run as successful
      const completedRun = await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          actionResults: actionResults as unknown as Prisma.InputJsonValue,
        },
      });

      // Update lastRunAt on the workflow
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date() },
      });

      return completedRun;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ workflowId, runId: run.id, error: errorMessage }, 'Workflow execution failed');

      const failedRun = await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          actionResults: actionResults as unknown as Prisma.InputJsonValue,
          errorMessage,
        },
      });

      // Still update lastRunAt on failure
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date() },
      });

      return failedRun;
    }
  }

  /**
   * Execute a single action based on its type.
   */
  private async executeAction(
    action: { type: string; config: Record<string, unknown> },
    triggerData: Record<string, unknown>,
  ): Promise<unknown> {
    switch (action.type) {
      case 'http_request': {
        const { url, method = 'GET', headers = {}, body } = action.config as {
          url: string; method?: string; headers?: Record<string, string>; body?: unknown;
        };
        if (!url) throw new Error('HTTP Request action requires a url');

        const fetchOpts: RequestInit = {
          method: method.toUpperCase(),
          headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
        };
        if (body && ['POST', 'PUT', 'PATCH'].includes(fetchOpts.method!)) {
          fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        fetchOpts.signal = controller.signal;

        const res = await fetch(url, fetchOpts);
        clearTimeout(timeout);

        const contentType = res.headers.get('content-type') || '';
        const responseBody = contentType.includes('json') ? await res.json() : await res.text();
        return { status: res.status, statusText: res.statusText, body: responseBody };
      }

      case 'delay': {
        const ms = Number(action.config.duration || action.config.ms || 1000);
        const clamped = Math.min(ms, 30000); // Max 30s delay
        await new Promise((r) => setTimeout(r, clamped));
        return { delayed: clamped };
      }

      case 'send_notification': {
        logger.info({ action: 'send_notification', config: action.config }, 'Notification action executed');
        return { sent: true, ...action.config };
      }

      default: {
        // Placeholder for unimplemented action types
        logger.info({ actionType: action.type, config: action.config }, 'Action executed (placeholder)');
        return { message: `Action ${action.type} executed`, config: action.config };
      }
    }
  }
}

export const workflowService = new WorkflowService();
