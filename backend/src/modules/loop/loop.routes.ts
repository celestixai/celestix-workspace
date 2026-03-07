import { Router, Request, Response } from 'express';
import { loopService } from './loop.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createComponentSchema,
  updateComponentSchema,
  createPageSchema,
  updatePageSchema,
  createEmbedSchema,
} from './loop.schema';

const router = Router();

// ==================================
// COMPONENT ROUTES
// ==================================

// POST /api/v1/loop/components — Create component
router.post('/components', authenticate, validate(createComponentSchema), async (req: Request, res: Response) => {
  const component = await loopService.createComponent(req.user!.id, req.body);
  res.status(201).json({ success: true, data: component });
});

// GET /api/v1/loop/components/:id — Get component
router.get('/components/:id', authenticate, async (req: Request, res: Response) => {
  const component = await loopService.getComponent(req.params.id);
  res.json({ success: true, data: component });
});

// PATCH /api/v1/loop/components/:id — Update component
router.patch('/components/:id', authenticate, validate(updateComponentSchema), async (req: Request, res: Response) => {
  const component = await loopService.updateComponent(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: component });
});

// DELETE /api/v1/loop/components/:id — Delete component
router.delete('/components/:id', authenticate, async (req: Request, res: Response) => {
  await loopService.deleteComponent(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Component deleted' } });
});

// ==================================
// PAGE ROUTES
// ==================================

// GET /api/v1/loop/pages — List my pages
router.get('/pages', authenticate, async (req: Request, res: Response) => {
  const pages = await loopService.getMyPages(req.user!.id);
  res.json({ success: true, data: pages });
});

// POST /api/v1/loop/pages — Create page
router.post('/pages', authenticate, validate(createPageSchema), async (req: Request, res: Response) => {
  const page = await loopService.createPage(req.user!.id, req.body);
  res.status(201).json({ success: true, data: page });
});

// GET /api/v1/loop/pages/:id — Get page
router.get('/pages/:id', authenticate, async (req: Request, res: Response) => {
  const page = await loopService.getPage(req.params.id);
  res.json({ success: true, data: page });
});

// PATCH /api/v1/loop/pages/:id — Update page
router.patch('/pages/:id', authenticate, validate(updatePageSchema), async (req: Request, res: Response) => {
  const page = await loopService.updatePage(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: page });
});

// DELETE /api/v1/loop/pages/:id — Delete page
router.delete('/pages/:id', authenticate, async (req: Request, res: Response) => {
  await loopService.deletePage(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Page deleted' } });
});

// ==================================
// EMBED ROUTES
// ==================================

// POST /api/v1/loop/embeds — Create embed
router.post('/embeds', authenticate, validate(createEmbedSchema), async (req: Request, res: Response) => {
  const embed = await loopService.createEmbed(req.user!.id, req.body);
  res.status(201).json({ success: true, data: embed });
});

// GET /api/v1/loop/embeds — Get embeds (query: contextType, contextId)
router.get('/embeds', authenticate, async (req: Request, res: Response) => {
  const { contextType, contextId } = req.query;

  if (!contextType || !contextId) {
    res.status(400).json({ success: false, error: 'contextType and contextId are required', code: 'VALIDATION_ERROR' });
    return;
  }

  const embeds = await loopService.getEmbedsByContext(contextType as string, contextId as string);
  res.json({ success: true, data: embeds });
});

export default router;
