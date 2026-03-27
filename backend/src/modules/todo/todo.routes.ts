import { Router, Request, Response } from 'express';
import { todoService } from './todo.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createListSchema,
  updateListSchema,
  createItemSchema,
  updateItemSchema,
  reorderItemsSchema,
  createStepSchema,
  updateStepSchema,
} from './todo.schema';

const router = Router();

// ==========================================
// SMART LIST ROUTES (must precede /:listId)
// ==========================================

// GET /api/v1/todo/my-day
router.get('/my-day', authenticate, async (req: Request, res: Response) => {
  const items = await todoService.getMyDay(req.user!.id);
  res.json({ success: true, data: items });
});

// GET /api/v1/todo/important
router.get('/important', authenticate, async (req: Request, res: Response) => {
  const items = await todoService.getImportant(req.user!.id);
  res.json({ success: true, data: items });
});

// GET /api/v1/todo/planned
router.get('/planned', authenticate, async (req: Request, res: Response) => {
  const groups = await todoService.getPlanned(req.user!.id);
  res.json({ success: true, data: groups });
});

// ==========================================
// LIST CRUD ROUTES
// ==========================================

// GET /api/v1/todo/lists
router.get('/lists', authenticate, async (req: Request, res: Response) => {
  const lists = await todoService.getLists(req.user!.id);
  res.json({ success: true, data: lists });
});

// POST /api/v1/todo/lists
router.post('/lists', authenticate, validate(createListSchema), async (req: Request, res: Response) => {
  const list = await todoService.createList(req.user!.id, req.body);
  res.status(201).json({ success: true, data: list });
});

// PATCH /api/v1/todo/lists/:listId
router.patch('/lists/:listId', authenticate, validate(updateListSchema), async (req: Request, res: Response) => {
  const list = await todoService.updateList(req.user!.id, req.params.listId, req.body);
  res.json({ success: true, data: list });
});

// DELETE /api/v1/todo/lists/:listId
router.delete('/lists/:listId', authenticate, async (req: Request, res: Response) => {
  await todoService.deleteList(req.user!.id, req.params.listId);
  res.json({ success: true, data: { message: 'List deleted' } });
});

// ==========================================
// ITEM REORDER ROUTE (must precede /:itemId)
// ==========================================

// POST /api/v1/todo/reorder
router.post('/reorder', authenticate, validate(reorderItemsSchema), async (req: Request, res: Response) => {
  await todoService.reorderItems(req.user!.id, req.body);
  res.json({ success: true, data: { message: 'Items reordered' } });
});

// ==========================================
// ITEM CRUD ROUTES (list-scoped)
// ==========================================

// POST /api/v1/todo/lists/:listId/items
router.post('/lists/:listId/items', authenticate, validate(createItemSchema), async (req: Request, res: Response) => {
  const item = await todoService.createItem(req.user!.id, req.params.listId, req.body);
  res.status(201).json({ success: true, data: item });
});

// ==========================================
// STEP ROUTES (must precede /:itemId dynamic)
// ==========================================

// PATCH /api/v1/todo/steps/:stepId
router.patch('/steps/:stepId', authenticate, validate(updateStepSchema), async (req: Request, res: Response) => {
  const step = await todoService.updateStep(req.user!.id, req.params.stepId, req.body);
  res.json({ success: true, data: step });
});

// DELETE /api/v1/todo/steps/:stepId
router.delete('/steps/:stepId', authenticate, async (req: Request, res: Response) => {
  await todoService.deleteStep(req.user!.id, req.params.stepId);
  res.json({ success: true, data: { message: 'Step deleted' } });
});

// POST /api/v1/todo/steps/:stepId/toggle-complete
router.post('/steps/:stepId/toggle-complete', authenticate, async (req: Request, res: Response) => {
  const step = await todoService.toggleStepComplete(req.user!.id, req.params.stepId);
  res.json({ success: true, data: step });
});

// ==========================================
// ITEM DETAIL ROUTES (/:itemId parameterized)
// ==========================================

// PATCH /api/v1/todo/:itemId
router.patch('/:itemId', authenticate, validate(updateItemSchema), async (req: Request, res: Response) => {
  const item = await todoService.updateItem(req.user!.id, req.params.itemId, req.body);
  res.json({ success: true, data: item });
});

// DELETE /api/v1/todo/:itemId
router.delete('/:itemId', authenticate, async (req: Request, res: Response) => {
  await todoService.deleteItem(req.user!.id, req.params.itemId);
  res.json({ success: true, data: { message: 'Item deleted' } });
});

// POST /api/v1/todo/:itemId/toggle-complete
router.post('/:itemId/toggle-complete', authenticate, async (req: Request, res: Response) => {
  const item = await todoService.toggleComplete(req.user!.id, req.params.itemId);
  res.json({ success: true, data: item });
});

// POST /api/v1/todo/:itemId/toggle-important
router.post('/:itemId/toggle-important', authenticate, async (req: Request, res: Response) => {
  const item = await todoService.toggleImportant(req.user!.id, req.params.itemId);
  res.json({ success: true, data: item });
});

// POST /api/v1/todo/:itemId/toggle-myday
router.post('/:itemId/toggle-myday', authenticate, async (req: Request, res: Response) => {
  const item = await todoService.toggleMyDay(req.user!.id, req.params.itemId);
  res.json({ success: true, data: item });
});

// ==========================================
// STEP ROUTES (item-scoped)
// ==========================================

// POST /api/v1/todo/:itemId/steps
router.post('/:itemId/steps', authenticate, validate(createStepSchema), async (req: Request, res: Response) => {
  const step = await todoService.createStep(req.user!.id, req.params.itemId, req.body);
  res.status(201).json({ success: true, data: step });
});

export default router;
