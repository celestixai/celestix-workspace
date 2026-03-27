import { Router, Request, Response } from 'express';
import { remindersService, ReminderFilter } from './reminders.service';
import { createReminderSchema, updateReminderSchema, snoozeReminderSchema } from './reminders.validation';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/v1/reminders — list reminders
router.get('/', authenticate, async (req: Request, res: Response) => {
  const filter = (req.query.filter as ReminderFilter) || 'all';
  const reminders = await remindersService.getReminders(req.user!.id, filter);
  res.json({ success: true, data: reminders });
});

// POST /api/v1/reminders — create
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = createReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors });
  }
  const reminder = await remindersService.createReminder(req.user!.id, parsed.data);
  res.status(201).json({ success: true, data: reminder });
});

// PATCH /api/v1/reminders/:reminderId — update
router.patch('/:reminderId', authenticate, async (req: Request, res: Response) => {
  const parsed = updateReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors });
  }
  await remindersService.updateReminder(req.params.reminderId, req.user!.id, parsed.data);
  res.json({ success: true, data: { updated: true } });
});

// DELETE /api/v1/reminders/:reminderId — delete
router.delete('/:reminderId', authenticate, async (req: Request, res: Response) => {
  await remindersService.deleteReminder(req.params.reminderId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/reminders/:reminderId/complete — mark complete
router.post('/:reminderId/complete', authenticate, async (req: Request, res: Response) => {
  await remindersService.completeReminder(req.params.reminderId, req.user!.id);
  res.json({ success: true, data: { completed: true } });
});

// POST /api/v1/reminders/:reminderId/snooze — snooze
router.post('/:reminderId/snooze', authenticate, async (req: Request, res: Response) => {
  const parsed = snoozeReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors });
  }
  await remindersService.snoozeReminder(req.params.reminderId, req.user!.id, parsed.data.duration);
  res.json({ success: true, data: { snoozed: true } });
});

export default router;
