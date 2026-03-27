import { Router, Request, Response } from 'express';
import { docsEnhancedService } from './docs-enhanced.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  docsHubQuerySchema,
  createSubPageSchema,
  publishDocSchema,
  createDocCommentSchema,
  updateDocCommentSchema,
  createDocTemplateSchema,
  createFromTemplateSchema,
  saveAsTemplateSchema,
  linkDocToTaskSchema,
} from './docs-enhanced.validation';

const router = Router();

// ==========================================
// DOCS HUB
// ==========================================

// GET /api/v1/docs/hub?workspaceId=&filter=
router.get('/hub', authenticate, async (req: Request, res: Response) => {
  const query = docsHubQuerySchema.parse(req.query);
  const docs = await docsEnhancedService.getDocsHub(req.user!.id, query);
  res.json({ success: true, data: docs });
});

// ==========================================
// TEMPLATES (before /:docId to avoid conflicts)
// ==========================================

// GET /api/v1/docs/templates?workspaceId=
router.get('/templates', authenticate, async (req: Request, res: Response) => {
  const workspaceId = req.query.workspaceId as string;
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspaceId required' });
  }
  const templates = await docsEnhancedService.getDocTemplates(workspaceId);
  res.json({ success: true, data: templates });
});

// POST /api/v1/docs/templates
router.post('/templates', authenticate, validate(createDocTemplateSchema), async (req: Request, res: Response) => {
  const template = await docsEnhancedService.createDocTemplate(req.user!.id, req.body);
  res.status(201).json({ success: true, data: template });
});

// ==========================================
// PUBLISHED (no auth)
// ==========================================

// GET /api/v1/docs/public/:slug
router.get('/public/:slug', async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.getPublishedDoc(req.params.slug);
  res.json({ success: true, data: doc });
});

// ==========================================
// TASK-LINKED DOCS
// ==========================================

// GET /api/v1/docs/task/:taskId
router.get('/task/:taskId', authenticate, async (req: Request, res: Response) => {
  const docs = await docsEnhancedService.getDocsForTask(req.params.taskId, req.user!.id);
  res.json({ success: true, data: docs });
});

// ==========================================
// COMMENT STANDALONE ROUTES (before /:docId)
// ==========================================

// PATCH /api/v1/docs/comments/:commentId
router.patch('/comments/:commentId', authenticate, validate(updateDocCommentSchema), async (req: Request, res: Response) => {
  const comment = await docsEnhancedService.updateDocComment(req.params.commentId, req.user!.id, req.body);
  res.json({ success: true, data: comment });
});

// DELETE /api/v1/docs/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  await docsEnhancedService.deleteDocComment(req.params.commentId, req.user!.id);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

// POST /api/v1/docs/comments/:commentId/resolve
router.post('/comments/:commentId/resolve', authenticate, async (req: Request, res: Response) => {
  const comment = await docsEnhancedService.resolveDocComment(req.params.commentId, req.user!.id);
  res.json({ success: true, data: comment });
});

// ==========================================
// DOCUMENT-SCOPED ROUTES (/:docId)
// ==========================================

// PATCH /api/v1/docs/:docId/wiki
router.patch('/:docId/wiki', authenticate, async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.toggleWiki(req.params.docId, req.user!.id);
  res.json({ success: true, data: doc });
});

// POST /api/v1/docs/:docId/sub-pages
router.post('/:docId/sub-pages', authenticate, validate(createSubPageSchema), async (req: Request, res: Response) => {
  const subPage = await docsEnhancedService.createSubPage(req.params.docId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: subPage });
});

// GET /api/v1/docs/:docId/sub-pages
router.get('/:docId/sub-pages', authenticate, async (req: Request, res: Response) => {
  const subPages = await docsEnhancedService.getSubPages(req.params.docId);
  res.json({ success: true, data: subPages });
});

// POST /api/v1/docs/:docId/publish
router.post('/:docId/publish', authenticate, validate(publishDocSchema), async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.publishDoc(req.params.docId, req.user!.id, req.body);
  res.json({ success: true, data: doc });
});

// POST /api/v1/docs/:docId/unpublish
router.post('/:docId/unpublish', authenticate, async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.unpublishDoc(req.params.docId, req.user!.id);
  res.json({ success: true, data: doc });
});

// POST /api/v1/docs/:docId/link-task
router.post('/:docId/link-task', authenticate, validate(linkDocToTaskSchema), async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.linkDocToTask(req.params.docId, req.body.taskId, req.user!.id);
  res.json({ success: true, data: doc });
});

// GET /api/v1/docs/:docId/comments
router.get('/:docId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await docsEnhancedService.getDocComments(req.params.docId, req.user!.id);
  res.json({ success: true, data: comments });
});

// POST /api/v1/docs/:docId/comments
router.post('/:docId/comments', authenticate, validate(createDocCommentSchema), async (req: Request, res: Response) => {
  const comment = await docsEnhancedService.createDocComment(req.params.docId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: comment });
});

// POST /api/v1/docs/:docId/from-template
router.post('/:docId/from-template', authenticate, validate(createFromTemplateSchema), async (req: Request, res: Response) => {
  const doc = await docsEnhancedService.createDocFromTemplate(req.body.templateId, req.user!.id, req.params.docId);
  res.status(201).json({ success: true, data: doc });
});

// POST /api/v1/docs/:docId/save-as-template
router.post('/:docId/save-as-template', authenticate, validate(saveAsTemplateSchema), async (req: Request, res: Response) => {
  const template = await docsEnhancedService.saveDocAsTemplate(
    req.params.docId,
    req.user!.id,
    req.body.name,
    req.body.workspaceId,
    req.body.description,
    req.body.category,
  );
  res.status(201).json({ success: true, data: template });
});

export default router;
