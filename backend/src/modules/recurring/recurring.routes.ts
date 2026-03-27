import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createRecurrenceSchema,
  updateRecurrenceSchema,
} from './recurring.validation';
import * as recurringService from './recurring.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /tasks/:taskId/recurrence — make a task recurring
router.post(
  '/tasks/:taskId/recurrence',
  validate(createRecurrenceSchema),
  async (req: Request, res: Response) => {
    const result = await recurringService.makeTaskRecurring(
      req.params.taskId,
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: result });
  },
);

// GET /tasks/:taskId/recurrence — get recurrence settings
router.get('/tasks/:taskId/recurrence', async (req: Request, res: Response) => {
  const result = await recurringService.getRecurrence(req.params.taskId);
  res.json({ data: result });
});

// PATCH /tasks/:taskId/recurrence — update settings
router.patch(
  '/tasks/:taskId/recurrence',
  validate(updateRecurrenceSchema),
  async (req: Request, res: Response) => {
    const result = await recurringService.updateRecurrence(req.params.taskId, req.body);
    res.json({ data: result });
  },
);

// DELETE /tasks/:taskId/recurrence — stop recurring
router.delete('/tasks/:taskId/recurrence', async (req: Request, res: Response) => {
  const result = await recurringService.deleteRecurrence(req.params.taskId);
  res.json({ data: result });
});

// POST /tasks/:taskId/recurrence/pause — pause
router.post('/tasks/:taskId/recurrence/pause', async (req: Request, res: Response) => {
  const result = await recurringService.pauseRecurrence(req.params.taskId);
  res.json({ data: result });
});

// POST /tasks/:taskId/recurrence/resume — resume
router.post('/tasks/:taskId/recurrence/resume', async (req: Request, res: Response) => {
  const result = await recurringService.resumeRecurrence(req.params.taskId);
  res.json({ data: result });
});

// GET /upcoming — list upcoming recurring task creations
router.get('/upcoming', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const result = await recurringService.getUpcoming(req.user!.id, days);
  res.json({ data: result });
});

// POST /process — manually trigger processing (admin/dev)
router.post('/process', async (_req: Request, res: Response) => {
  const result = await recurringService.processRecurringTasks();
  res.json({ data: result });
});

export default router;
