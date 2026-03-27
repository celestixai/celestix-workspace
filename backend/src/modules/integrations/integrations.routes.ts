import { Router, Request, Response } from 'express';
import { integrationsService } from './integrations.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createIntegrationSchema,
  updateIntegrationSchema,
  webhookIncomingSchema,
} from './integrations.validation';

const router = Router();

// ==========================================
// CORE CRUD (authenticated)
// ==========================================

// GET /api/v1/integrations/workspace/:workspaceId — list integrations
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const integrations = await integrationsService.getIntegrations(req.params.workspaceId);
  res.json({ success: true, data: integrations });
});

// POST /api/v1/integrations — create/connect integration
router.post('/', authenticate, validate(createIntegrationSchema), async (req: Request, res: Response) => {
  const { workspaceId, ...rest } = req.body;
  const integration = await integrationsService.createIntegration(workspaceId, req.user!.id, rest);
  res.status(201).json({ success: true, data: integration });
});

// GET /api/v1/integrations/:integrationId — get details
router.get('/:integrationId', authenticate, async (req: Request, res: Response) => {
  const integration = await integrationsService.getIntegration(req.params.integrationId);
  res.json({ success: true, data: integration });
});

// PATCH /api/v1/integrations/:integrationId — update
router.patch('/:integrationId', authenticate, validate(updateIntegrationSchema), async (req: Request, res: Response) => {
  const integration = await integrationsService.updateIntegration(req.params.integrationId, req.body);
  res.json({ success: true, data: integration });
});

// DELETE /api/v1/integrations/:integrationId — disconnect
router.delete('/:integrationId', authenticate, async (req: Request, res: Response) => {
  await integrationsService.deleteIntegration(req.params.integrationId);
  res.json({ success: true, data: { message: 'Integration disconnected' } });
});

// POST /api/v1/integrations/:integrationId/sync — force sync
router.post('/:integrationId/sync', authenticate, async (req: Request, res: Response) => {
  const integration = await integrationsService.syncIntegration(req.params.integrationId);
  res.json({ success: true, data: integration });
});

// POST /api/v1/integrations/:integrationId/test — test connection
router.post('/:integrationId/test', authenticate, async (req: Request, res: Response) => {
  const result = await integrationsService.testIntegration(req.params.integrationId);
  res.json({ success: true, data: result });
});

// GET /api/v1/integrations/:integrationId/webhook-logs — delivery logs
router.get('/:integrationId/webhook-logs', authenticate, async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = await integrationsService.getWebhookLogs(req.params.integrationId, limit);
  res.json({ success: true, data: logs });
});

// ==========================================
// WEBHOOKS (no auth — external callers)
// ==========================================

// POST /api/v1/integrations/webhooks/incoming/:webhookId — receive incoming webhook
router.post('/webhooks/incoming/:webhookId', validate(webhookIncomingSchema), async (req: Request, res: Response) => {
  const result = await integrationsService.processIncomingWebhook(req.params.webhookId, req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/integrations/webhooks/github — GitHub webhook receiver
router.post('/webhooks/github', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const result = await integrationsService.processGitHubWebhook(req.body, signature);
  res.json({ success: true, data: result });
});

export default router;
