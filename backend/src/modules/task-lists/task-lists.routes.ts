import { Router, Request, Response } from 'express';
import { taskListsService } from './task-lists.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createListSchema,
  updateListSchema,
  updatePositionSchema,
  createListStatusSchema,
  updateListStatusSchema,
  moveListSchema,
  duplicateListSchema,
} from './task-lists.validation';

const router = Router();

// ==========================================
// List CRUD
// ==========================================

// GET /api/v1/lists/space/:spaceId/lists
router.get('/space/:spaceId/lists', authenticate, async (req: Request, res: Response) => {
  const lists = await taskListsService.getListsBySpace(req.params.spaceId, req.user!.id);
  res.json({ success: true, data: lists });
});

// GET /api/v1/lists/folder/:folderId/lists
router.get('/folder/:folderId/lists', authenticate, async (req: Request, res: Response) => {
  const lists = await taskListsService.getListsByFolder(req.params.folderId, req.user!.id);
  res.json({ success: true, data: lists });
});

// POST /api/v1/lists/space/:spaceId/lists
router.post('/space/:spaceId/lists', authenticate, validate(createListSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.createListInSpace(req.params.spaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: list });
});

// POST /api/v1/lists/folder/:folderId/lists
router.post('/folder/:folderId/lists', authenticate, validate(createListSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.createListInFolder(req.params.folderId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: list });
});

// GET /api/v1/lists/:listId
router.get('/:listId', authenticate, async (req: Request, res: Response) => {
  const list = await taskListsService.getListById(req.params.listId, req.user!.id);
  res.json({ success: true, data: list });
});

// PATCH /api/v1/lists/:listId
router.patch('/:listId', authenticate, validate(updateListSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.updateList(req.params.listId, req.user!.id, req.body);
  res.json({ success: true, data: list });
});

// DELETE /api/v1/lists/:listId
router.delete('/:listId', authenticate, async (req: Request, res: Response) => {
  await taskListsService.deleteList(req.params.listId, req.user!.id);
  res.json({ success: true, data: { message: 'List deleted' } });
});

// PATCH /api/v1/lists/:listId/position
router.patch('/:listId/position', authenticate, validate(updatePositionSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.updatePosition(req.params.listId, req.body.position);
  res.json({ success: true, data: list });
});

// ==========================================
// List Statuses (3-tier inheritance)
// ==========================================

// GET /api/v1/lists/:listId/statuses
router.get('/:listId/statuses', authenticate, async (req: Request, res: Response) => {
  const statuses = await taskListsService.getEffectiveStatuses(req.params.listId);
  res.json({ success: true, data: statuses });
});

// POST /api/v1/lists/:listId/statuses
router.post('/:listId/statuses', authenticate, validate(createListStatusSchema), async (req: Request, res: Response) => {
  const status = await taskListsService.createListStatus(req.params.listId, req.body);
  res.status(201).json({ success: true, data: status });
});

// PATCH /api/v1/lists/list-statuses/:statusId
router.patch('/list-statuses/:statusId', authenticate, validate(updateListStatusSchema), async (req: Request, res: Response) => {
  const status = await taskListsService.updateListStatus(req.params.statusId, req.body);
  res.json({ success: true, data: status });
});

// DELETE /api/v1/lists/list-statuses/:statusId
router.delete('/list-statuses/:statusId', authenticate, async (req: Request, res: Response) => {
  await taskListsService.deleteListStatus(req.params.statusId);
  res.json({ success: true, data: { deleted: true } });
});

// ==========================================
// List Info
// ==========================================

// GET /api/v1/lists/:listId/info
router.get('/:listId/info', authenticate, async (req: Request, res: Response) => {
  const info = await taskListsService.getListInfo(req.params.listId);
  res.json({ success: true, data: info });
});

// PATCH /api/v1/lists/:listId/info
router.patch('/:listId/info', authenticate, validate(updateListSchema), async (req: Request, res: Response) => {
  const info = await taskListsService.updateListInfo(req.params.listId, req.body);
  res.json({ success: true, data: info });
});

// ==========================================
// Move & Duplicate
// ==========================================

// PATCH /api/v1/lists/:listId/move
router.patch('/:listId/move', authenticate, validate(moveListSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.moveList(req.params.listId, req.user!.id, req.body);
  res.json({ success: true, data: list });
});

// POST /api/v1/lists/:listId/duplicate
router.post('/:listId/duplicate', authenticate, validate(duplicateListSchema), async (req: Request, res: Response) => {
  const list = await taskListsService.duplicateList(req.params.listId, req.user!.id, req.body.includeTasks);
  res.status(201).json({ success: true, data: list });
});

export default router;
