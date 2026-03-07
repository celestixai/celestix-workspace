import { Router, Request, Response } from 'express';
import { workflowService } from './workflows.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError } from '../../middleware/error-handler';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
} from './workflows.schema';
import { prisma } from '../../config/database';

const router = Router();

// ==================================
// WORKFLOW CRUD ROUTES
// ==================================

// GET /api/v1/workflows — List workflows
router.get('/', authenticate, async (req: Request, res: Response) => {
  const workflows = await workflowService.getAll(req.user!.id);
  res.json({ success: true, data: workflows });
});

// POST /api/v1/workflows — Create workflow
router.post('/', authenticate, validate(createWorkflowSchema), async (req: Request, res: Response) => {
  const workflow = await workflowService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: workflow });
});

// GET /api/v1/workflows/runs/:runId — Get run detail (before /:id to avoid conflict)
router.get('/runs/:runId', authenticate, async (req: Request, res: Response) => {
  const run = await workflowService.getRunById(req.params.runId);

  // Verify the user owns the workflow
  if (run.workflow.createdById !== req.user!.id) {
    throw new AppError(403, 'Not authorized to view this run', 'FORBIDDEN');
  }

  res.json({ success: true, data: run });
});

// POST /api/v1/workflows/webhook/:id — Webhook trigger (no auth)
router.post('/webhook/:id', async (req: Request, res: Response) => {
  // Verify the workflow exists and has a webhook trigger
  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, deletedAt: null, isEnabled: true },
  });

  if (!workflow) {
    throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
  }

  const trigger = workflow.trigger as { type: string; config: Record<string, unknown> };
  if (trigger.type !== 'webhook') {
    throw new AppError(400, 'Workflow does not have a webhook trigger', 'INVALID_TRIGGER');
  }

  const run = await workflowService.executeWorkflow(req.params.id, {
    source: 'webhook',
    headers: req.headers,
    body: req.body,
    query: req.query,
  });

  res.json({ success: true, data: run });
});

// GET /api/v1/workflows/:id — Get workflow
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const workflow = await workflowService.getById(req.user!.id, req.params.id);
  res.json({ success: true, data: workflow });
});

// PATCH /api/v1/workflows/:id — Update workflow
router.patch('/:id', authenticate, validate(updateWorkflowSchema), async (req: Request, res: Response) => {
  const workflow = await workflowService.update(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: workflow });
});

// DELETE /api/v1/workflows/:id — Delete workflow
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await workflowService.delete(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Workflow deleted' } });
});

// POST /api/v1/workflows/:id/toggle — Toggle enable/disable
router.post('/:id/toggle', authenticate, async (req: Request, res: Response) => {
  const workflow = await workflowService.toggle(req.params.id, req.user!.id);
  res.json({ success: true, data: workflow });
});

// GET /api/v1/workflows/:id/runs — Get run history
router.get('/:id/runs', authenticate, async (req: Request, res: Response) => {
  const runs = await workflowService.getRuns(req.params.id, req.user!.id);
  res.json({ success: true, data: runs });
});

// POST /api/v1/workflows/:id/execute — Manually execute workflow
router.post('/:id/execute', authenticate, async (req: Request, res: Response) => {
  // Verify ownership
  await workflowService.getById(req.user!.id, req.params.id);

  const run = await workflowService.executeWorkflow(req.params.id, {
    source: 'manual',
    triggeredBy: req.user!.id,
    ...req.body,
  });

  res.json({ success: true, data: run });
});

export default router;
