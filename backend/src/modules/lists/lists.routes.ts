import { Router, Request, Response } from 'express';
import { listsService } from './lists.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createListSchema,
  updateListSchema,
  createColumnSchema,
  updateColumnSchema,
  createItemSchema,
  updateItemSchema,
  createViewSchema,
  updateViewSchema,
  createCommentSchema,
} from './lists.schema';

const router = Router();

// ==========================================
// LIST CRUD ROUTES
// ==========================================

// GET /api/v1/lists
router.get('/', authenticate, async (req: Request, res: Response) => {
  const lists = await listsService.getAll(req.user!.id);
  res.json({ success: true, data: lists });
});

// POST /api/v1/lists
router.post('/', authenticate, validate(createListSchema), async (req: Request, res: Response) => {
  const list = await listsService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: list });
});

// GET /api/v1/lists/:listId
router.get('/:listId', authenticate, async (req: Request, res: Response) => {
  const list = await listsService.getById(req.params.listId, req.user!.id);
  res.json({ success: true, data: list });
});

// PATCH /api/v1/lists/:listId
router.patch('/:listId', authenticate, validate(updateListSchema), async (req: Request, res: Response) => {
  const list = await listsService.update(req.params.listId, req.user!.id, req.body);
  res.json({ success: true, data: list });
});

// DELETE /api/v1/lists/:listId
router.delete('/:listId', authenticate, async (req: Request, res: Response) => {
  await listsService.delete(req.params.listId, req.user!.id);
  res.json({ success: true, data: { message: 'List deleted' } });
});

// ==========================================
// COLUMN ROUTES
// ==========================================

// POST /api/v1/lists/:listId/columns
router.post('/:listId/columns', authenticate, validate(createColumnSchema), async (req: Request, res: Response) => {
  const column = await listsService.addColumn(req.params.listId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: column });
});

// ==========================================
// STATIC-SEGMENT ROUTES (must precede /:param)
// ==========================================

// PATCH /api/v1/lists/columns/:columnId
router.patch('/columns/:columnId', authenticate, validate(updateColumnSchema), async (req: Request, res: Response) => {
  const column = await listsService.updateColumn(req.params.columnId, req.user!.id, req.body);
  res.json({ success: true, data: column });
});

// DELETE /api/v1/lists/columns/:columnId
router.delete('/columns/:columnId', authenticate, async (req: Request, res: Response) => {
  await listsService.deleteColumn(req.params.columnId, req.user!.id);
  res.json({ success: true, data: { message: 'Column deleted' } });
});

// PATCH /api/v1/lists/items/:itemId
router.patch('/items/:itemId', authenticate, validate(updateItemSchema), async (req: Request, res: Response) => {
  const item = await listsService.updateItem(req.params.itemId, req.user!.id, req.body);
  res.json({ success: true, data: item });
});

// DELETE /api/v1/lists/items/:itemId
router.delete('/items/:itemId', authenticate, async (req: Request, res: Response) => {
  await listsService.deleteItem(req.params.itemId, req.user!.id);
  res.json({ success: true, data: { message: 'Item deleted' } });
});

// GET /api/v1/lists/items/:itemId/comments
router.get('/items/:itemId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await listsService.getComments(req.params.itemId, req.user!.id);
  res.json({ success: true, data: comments });
});

// POST /api/v1/lists/items/:itemId/comments
router.post('/items/:itemId/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await listsService.addComment(req.params.itemId, req.user!.id, req.body.body);
  res.status(201).json({ success: true, data: comment });
});

// PATCH /api/v1/lists/views/:viewId
router.patch('/views/:viewId', authenticate, validate(updateViewSchema), async (req: Request, res: Response) => {
  const view = await listsService.updateView(req.params.viewId, req.user!.id, req.body);
  res.json({ success: true, data: view });
});

// DELETE /api/v1/lists/views/:viewId
router.delete('/views/:viewId', authenticate, async (req: Request, res: Response) => {
  await listsService.deleteView(req.params.viewId, req.user!.id);
  res.json({ success: true, data: { message: 'View deleted' } });
});

// ==========================================
// LIST-SCOPED ITEM ROUTES
// ==========================================

// GET /api/v1/lists/:listId/items
router.get('/:listId/items', authenticate, async (req: Request, res: Response) => {
  const filter = req.query.filter ? JSON.parse(req.query.filter as string) : undefined;
  const sort = req.query.sort ? JSON.parse(req.query.sort as string) : undefined;
  const groupBy = req.query.groupBy as string | undefined;
  const result = await listsService.getItems(req.params.listId, req.user!.id, filter, sort, groupBy);
  res.json({ success: true, data: result });
});

// POST /api/v1/lists/:listId/items
router.post('/:listId/items', authenticate, validate(createItemSchema), async (req: Request, res: Response) => {
  const item = await listsService.createItem(req.params.listId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: item });
});

// ==========================================
// LIST-SCOPED VIEW ROUTES
// ==========================================

// POST /api/v1/lists/:listId/views
router.post('/:listId/views', authenticate, validate(createViewSchema), async (req: Request, res: Response) => {
  const view = await listsService.createView(req.params.listId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: view });
});

export default router;
