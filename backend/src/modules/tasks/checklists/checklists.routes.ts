import { Router, Request, Response } from 'express';
import { authenticate } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { checklistsService } from './checklists.service';
import {
  createChecklistSchema,
  updateChecklistSchema,
  createItemSchema,
  updateItemSchema,
  reorderItemsSchema,
  updatePositionSchema,
} from './checklists.validation';

// mergeParams: true so we can access :taskId from parent router
const router = Router({ mergeParams: true });

// ==========================================
// CHECKLIST ROUTES
// ==========================================

// GET /api/v1/tasks/:taskId/checklists
router.get('/', authenticate, async (req: Request, res: Response) => {
  const checklists = await checklistsService.getChecklists(req.params.taskId);
  res.json({ success: true, data: checklists });
});

// POST /api/v1/tasks/:taskId/checklists
router.post('/', authenticate, validate(createChecklistSchema), async (req: Request, res: Response) => {
  const checklist = await checklistsService.createChecklist(req.params.taskId, req.body);
  res.status(201).json({ success: true, data: checklist });
});

// PATCH /api/v1/tasks/:taskId/checklists/:checklistId
router.patch('/:checklistId', authenticate, validate(updateChecklistSchema), async (req: Request, res: Response) => {
  const checklist = await checklistsService.updateChecklist(req.params.checklistId, req.body);
  res.json({ success: true, data: checklist });
});

// DELETE /api/v1/tasks/:taskId/checklists/:checklistId
router.delete('/:checklistId', authenticate, async (req: Request, res: Response) => {
  await checklistsService.deleteChecklist(req.params.checklistId);
  res.json({ success: true, data: { message: 'Checklist deleted' } });
});

// PATCH /api/v1/tasks/:taskId/checklists/:checklistId/position
router.patch('/:checklistId/position', authenticate, validate(updatePositionSchema), async (req: Request, res: Response) => {
  const checklist = await checklistsService.updateChecklistPosition(req.params.checklistId, req.body.position);
  res.json({ success: true, data: checklist });
});

// ==========================================
// CHECKLIST ITEM ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/checklists/:checklistId/items
router.post('/:checklistId/items', authenticate, validate(createItemSchema), async (req: Request, res: Response) => {
  const item = await checklistsService.addItem(req.params.checklistId, req.body);
  res.status(201).json({ success: true, data: item });
});

// PATCH /api/v1/tasks/:taskId/checklists/items/:itemId
router.patch('/items/:itemId', authenticate, validate(updateItemSchema), async (req: Request, res: Response) => {
  const item = await checklistsService.updateItem(req.params.itemId, req.body);
  res.json({ success: true, data: item });
});

// DELETE /api/v1/tasks/:taskId/checklists/items/:itemId
router.delete('/items/:itemId', authenticate, async (req: Request, res: Response) => {
  await checklistsService.deleteItem(req.params.itemId);
  res.json({ success: true, data: { message: 'Item deleted' } });
});

// PATCH /api/v1/tasks/:taskId/checklists/:checklistId/items/reorder
router.patch('/:checklistId/items/reorder', authenticate, validate(reorderItemsSchema), async (req: Request, res: Response) => {
  const items = await checklistsService.reorderItems(req.params.checklistId, req.body);
  res.json({ success: true, data: items });
});

// ==========================================
// BULK OPERATIONS
// ==========================================

// POST /api/v1/tasks/:taskId/checklists/:checklistId/items/bulk-complete
router.post('/:checklistId/items/bulk-complete', authenticate, async (req: Request, res: Response) => {
  const items = await checklistsService.bulkCompleteItems(req.params.checklistId);
  res.json({ success: true, data: items });
});

// POST /api/v1/tasks/:taskId/checklists/:checklistId/items/bulk-incomplete
router.post('/:checklistId/items/bulk-incomplete', authenticate, async (req: Request, res: Response) => {
  const items = await checklistsService.bulkIncompleteItems(req.params.checklistId);
  res.json({ success: true, data: items });
});

export default router;
