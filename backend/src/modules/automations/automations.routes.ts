import { Router, Request, Response } from 'express';
import { automationsService } from './automations.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createAutomationSchema,
  updateAutomationSchema,
  testAutomationSchema,
} from './automations.validation';

// Import engine to ensure event listener is registered on startup
import './automations.engine';

const router = Router();

// GET /api/v1/automations/templates — pre-built templates
router.get('/templates', authenticate, (_req: Request, res: Response) => {
  const templates = automationsService.getTemplates();
  res.json({ success: true, data: templates });
});

// GET /api/v1/automations/workspace/:workspaceId — list automations for workspace
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { locationId, locationType, isActive } = req.query as Record<string, string>;
    const filters: any = {};
    if (locationId) filters.locationId = locationId;
    if (locationType) filters.locationType = locationType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const automations = await automationsService.getAutomations(workspaceId, filters);
    res.json({ success: true, data: automations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch automations' });
  }
});

// GET /api/v1/automations/location/:locationType/:locationId — at specific location
router.get('/location/:locationType/:locationId', authenticate, async (req: Request, res: Response) => {
  const { locationType, locationId } = req.params;
  const automations = await automationsService.getAutomationsAtLocation(locationType, locationId);
  res.json({ success: true, data: automations });
});

// POST /api/v1/automations — create automation
router.post('/', authenticate, validate(createAutomationSchema), async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const automation = await automationsService.createAutomation(userId, req.body);
  res.status(201).json({ success: true, data: automation });
});

// GET /api/v1/automations/:automationId — get with recent logs
router.get('/:automationId', authenticate, async (req: Request, res: Response) => {
  const automation = await automationsService.getAutomation(req.params.automationId);
  res.json({ success: true, data: automation });
});

// PATCH /api/v1/automations/:automationId — update
router.patch('/:automationId', authenticate, validate(updateAutomationSchema), async (req: Request, res: Response) => {
  const automation = await automationsService.updateAutomation(req.params.automationId, req.body);
  res.json({ success: true, data: automation });
});

// DELETE /api/v1/automations/:automationId — delete
router.delete('/:automationId', authenticate, async (req: Request, res: Response) => {
  const result = await automationsService.deleteAutomation(req.params.automationId);
  res.json({ success: true, data: result });
});

// POST /api/v1/automations/:automationId/toggle — activate/deactivate
router.post('/:automationId/toggle', authenticate, async (req: Request, res: Response) => {
  const automation = await automationsService.toggleAutomation(req.params.automationId);
  res.json({ success: true, data: automation });
});

// POST /api/v1/automations/:automationId/test — dry-run test
router.post('/:automationId/test', authenticate, validate(testAutomationSchema), async (req: Request, res: Response) => {
  const result = await automationsService.testAutomation(req.params.automationId, req.body.taskId);
  res.json({ success: true, data: result });
});

// GET /api/v1/automations/:automationId/logs — execution history
router.get('/:automationId/logs', authenticate, async (req: Request, res: Response) => {
  const { limit, cursor } = req.query as Record<string, string>;
  const result = await automationsService.getAutomationLogs(
    req.params.automationId,
    limit ? parseInt(limit, 10) : 20,
    cursor || undefined,
  );
  res.json({ success: true, data: result });
});

export default router;
