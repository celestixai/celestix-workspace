import { Router, Request, Response } from 'express';
import { TemplateType } from '@prisma/client';
import { templatesService } from './templates.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createTemplateSchema,
  updateTemplateSchema,
  applyTemplateSchema,
} from './templates.validation';

const router = Router();

// ==========================================
// Workspace-scoped routes
// ==========================================

// GET /api/v1/templates/workspace/:workspaceId — list templates
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const { type, tags, search } = req.query;
  const filters: { templateType?: TemplateType; tags?: string[]; search?: string } = {};

  if (type && typeof type === 'string') {
    filters.templateType = type as TemplateType;
  }
  if (tags && typeof tags === 'string') {
    filters.tags = tags.split(',').map((t) => t.trim());
  }
  if (search && typeof search === 'string') {
    filters.search = search;
  }

  const templates = await templatesService.getTemplates(req.params.workspaceId, filters);
  res.json({ success: true, data: templates });
});

// POST /api/v1/templates/workspace/:workspaceId — create template
router.post('/workspace/:workspaceId', authenticate, validate(createTemplateSchema), async (req: Request, res: Response) => {
  const template = await templatesService.createTemplate(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: template });
});

// GET /api/v1/templates/workspace/:workspaceId/tags — list template tags
router.get('/workspace/:workspaceId/tags', authenticate, async (req: Request, res: Response) => {
  const tags = await templatesService.getTemplateTags(req.params.workspaceId);
  res.json({ success: true, data: tags });
});

// ==========================================
// Create from existing entities
// ==========================================

// POST /api/v1/templates/from-task/:taskId — create template from task
router.post('/from-task/:taskId', authenticate, async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'name is required', code: 'VALIDATION_ERROR' } });
  }
  const template = await templatesService.createFromTask(req.params.taskId, req.user!.id, name, description);
  res.status(201).json({ success: true, data: template });
});

// POST /api/v1/templates/from-list/:listId — create template from list
router.post('/from-list/:listId', authenticate, async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'name is required', code: 'VALIDATION_ERROR' } });
  }
  const template = await templatesService.createFromList(req.params.listId, req.user!.id, name, description);
  res.status(201).json({ success: true, data: template });
});

// ==========================================
// Single template routes
// ==========================================

// GET /api/v1/templates/:templateId — get template details
router.get('/:templateId', authenticate, async (req: Request, res: Response) => {
  const template = await templatesService.getTemplate(req.params.templateId);
  res.json({ success: true, data: template });
});

// PATCH /api/v1/templates/:templateId — update template
router.patch('/:templateId', authenticate, validate(updateTemplateSchema), async (req: Request, res: Response) => {
  const template = await templatesService.updateTemplate(req.params.templateId, req.user!.id, req.body);
  res.json({ success: true, data: template });
});

// DELETE /api/v1/templates/:templateId — delete template
router.delete('/:templateId', authenticate, async (req: Request, res: Response) => {
  await templatesService.deleteTemplate(req.params.templateId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/templates/:templateId/apply — apply template
router.post('/:templateId/apply', authenticate, validate(applyTemplateSchema), async (req: Request, res: Response) => {
  const result = await templatesService.applyTemplate(req.params.templateId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: result });
});

// POST /api/v1/templates/:templateId/pin — toggle pin
router.post('/:templateId/pin', authenticate, async (req: Request, res: Response) => {
  const template = await templatesService.togglePin(req.params.templateId, req.user!.id);
  res.json({ success: true, data: template });
});

export default router;
