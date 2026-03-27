import { Router, Request, Response } from 'express';
import { taskTypesService } from './task-types.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createTaskTypeSchema, updateTaskTypeSchema } from './task-types.validation';

const router = Router();

// GET /api/v1/task-types/space/:spaceId — list task types for a space
router.get('/space/:spaceId', authenticate, async (req: Request, res: Response) => {
  const taskTypes = await taskTypesService.getTaskTypes(req.params.spaceId);
  res.json({ success: true, data: taskTypes });
});

// POST /api/v1/task-types/space/:spaceId — create a task type
router.post('/space/:spaceId', authenticate, validate(createTaskTypeSchema), async (req: Request, res: Response) => {
  const taskType = await taskTypesService.createTaskType(req.params.spaceId, req.body);
  res.status(201).json({ success: true, data: taskType });
});

// PATCH /api/v1/task-types/:typeId — update a task type
router.patch('/:typeId', authenticate, validate(updateTaskTypeSchema), async (req: Request, res: Response) => {
  const taskType = await taskTypesService.updateTaskType(req.params.typeId, req.body);
  res.json({ success: true, data: taskType });
});

// DELETE /api/v1/task-types/:typeId — delete a task type
router.delete('/:typeId', authenticate, async (req: Request, res: Response) => {
  await taskTypesService.deleteTaskType(req.params.typeId);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
