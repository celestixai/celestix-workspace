import { Router, Request, Response } from 'express';
import { tagsService } from './tags.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createTagSchema, updateTagSchema, addTaskTagsSchema } from './tags.validation';

const router = Router();

// ==========================================
// WORKSPACE TAG ROUTES
// ==========================================

// GET /api/v1/tags/workspace/:workspaceId — list workspace tags
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const tags = await tagsService.getTags(req.params.workspaceId);
  res.json({ success: true, data: tags });
});

// POST /api/v1/tags/workspace/:workspaceId — create tag
router.post('/workspace/:workspaceId', authenticate, validate(createTagSchema), async (req: Request, res: Response) => {
  const tag = await tagsService.createTag(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: tag });
});

// PATCH /api/v1/tags/:tagId — update tag
router.patch('/:tagId', authenticate, validate(updateTagSchema), async (req: Request, res: Response) => {
  const tag = await tagsService.updateTag(req.params.tagId, req.body);
  res.json({ success: true, data: tag });
});

// DELETE /api/v1/tags/:tagId — delete tag
router.delete('/:tagId', authenticate, async (req: Request, res: Response) => {
  await tagsService.deleteTag(req.params.tagId);
  res.json({ success: true, data: { message: 'Tag deleted' } });
});

// ==========================================
// TASK TAG ROUTES
// ==========================================

// POST /api/v1/tags/task/:taskId/tags — add tags to task
router.post('/task/:taskId/tags', authenticate, validate(addTaskTagsSchema), async (req: Request, res: Response) => {
  const tags = await tagsService.addTagsToTask(req.params.taskId, req.body.tagIds);
  res.json({ success: true, data: tags });
});

// DELETE /api/v1/tags/task/:taskId/tags/:tagId — remove tag from task
router.delete('/task/:taskId/tags/:tagId', authenticate, async (req: Request, res: Response) => {
  const tags = await tagsService.removeTagFromTask(req.params.taskId, req.params.tagId);
  res.json({ success: true, data: tags });
});

// GET /api/v1/tags/task/:taskId/tags — list task's tags
router.get('/task/:taskId/tags', authenticate, async (req: Request, res: Response) => {
  const tags = await tagsService.getTaskTags(req.params.taskId);
  res.json({ success: true, data: tags });
});

export default router;
