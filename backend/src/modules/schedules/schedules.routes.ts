import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { schedulesService } from './schedules.service';
import {
  createScheduleSchema,
  updateScheduleSchema,
  assignScheduleSchema,
  createTimeOffSchema,
  updateTimeOffSchema,
} from './schedules.validation';

const router = Router();

// ==========================================
// WORK SCHEDULES
// ==========================================

// GET /api/v1/schedules/workspace/:workspaceId
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const schedules = await schedulesService.getSchedules(req.params.workspaceId);
  res.json({ success: true, data: schedules });
});

// POST /api/v1/schedules/workspace/:workspaceId
router.post('/workspace/:workspaceId', authenticate, validate(createScheduleSchema), async (req: Request, res: Response) => {
  const schedule = await schedulesService.createSchedule(req.params.workspaceId, req.body);
  res.status(201).json({ success: true, data: schedule });
});

// PATCH /api/v1/schedules/:scheduleId
router.patch('/:scheduleId', authenticate, validate(updateScheduleSchema), async (req: Request, res: Response) => {
  const schedule = await schedulesService.updateSchedule(req.params.scheduleId, req.body);
  res.json({ success: true, data: schedule });
});

// DELETE /api/v1/schedules/:scheduleId
router.delete('/:scheduleId', authenticate, async (req: Request, res: Response) => {
  await schedulesService.deleteSchedule(req.params.scheduleId);
  res.json({ success: true, message: 'Schedule deleted' });
});

// POST /api/v1/schedules/assign
router.post('/assign', authenticate, validate(assignScheduleSchema), async (req: Request, res: Response) => {
  const { userId, scheduleId, effectiveFrom } = req.body;
  const assignment = await schedulesService.assignUserSchedule(userId, scheduleId, effectiveFrom);
  res.status(201).json({ success: true, data: assignment });
});

// GET /api/v1/schedules/user/:userId
router.get('/user/:userId', authenticate, async (req: Request, res: Response) => {
  const schedule = await schedulesService.getUserSchedule(req.params.userId);
  res.json({ success: true, data: schedule });
});

// ==========================================
// TIME OFF
// ==========================================

// POST /api/v1/schedules/time-off
router.post('/time-off', authenticate, validate(createTimeOffSchema), async (req: Request, res: Response) => {
  const timeOff = await schedulesService.requestTimeOff(req.user!.id, req.body);
  res.status(201).json({ success: true, data: timeOff });
});

// GET /api/v1/schedules/time-off
router.get('/time-off', authenticate, async (req: Request, res: Response) => {
  const { userId, startDate, endDate } = req.query as Record<string, string>;
  const timeOff = await schedulesService.getTimeOff({ userId, startDate, endDate });
  res.json({ success: true, data: timeOff });
});

// PATCH /api/v1/schedules/time-off/:id
router.patch('/time-off/:id', authenticate, validate(updateTimeOffSchema), async (req: Request, res: Response) => {
  const { status } = req.body;
  let result;
  if (status === 'APPROVED') {
    result = await schedulesService.approveTimeOff(req.params.id, req.user!.id);
  } else {
    result = await schedulesService.rejectTimeOff(req.params.id, req.user!.id);
  }
  res.json({ success: true, data: result });
});

// DELETE /api/v1/schedules/time-off/:id
router.delete('/time-off/:id', authenticate, async (req: Request, res: Response) => {
  await schedulesService.cancelTimeOff(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Time off cancelled' });
});

// GET /api/v1/schedules/team-availability
router.get('/team-availability', authenticate, async (req: Request, res: Response) => {
  const { workspaceId, date } = req.query as Record<string, string>;
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspaceId is required' });
  }
  const targetDate = date ? new Date(date) : new Date();
  const availability = await schedulesService.getTeamAvailability(workspaceId, targetDate);
  res.json({ success: true, data: availability });
});

export default router;
