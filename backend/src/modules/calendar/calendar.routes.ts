import { Router, Request, Response } from 'express';
import { calendarService } from './calendar.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import {
  createCalendarSchema,
  updateCalendarSchema,
  shareCalendarSchema,
  updateShareSchema,
  createEventSchema,
  updateEventSchema,
  rsvpSchema,
  createReminderSchema,
  eventsQuerySchema,
  conflictQuerySchema,
} from './calendar.schema';

const router = Router();

// ==========================================
// CALENDAR CRUD
// ==========================================

// GET /api/v1/calendar/calendars
router.get('/calendars', authenticate, async (req: Request, res: Response) => {
  const calendars = await calendarService.getCalendars(req.user!.id);
  res.json({ success: true, data: calendars });
});

// POST /api/v1/calendar/calendars
router.post('/calendars', authenticate, validate(createCalendarSchema), async (req: Request, res: Response) => {
  const calendar = await calendarService.createCalendar(req.user!.id, req.body);
  res.status(201).json({ success: true, data: calendar });
});

// GET /api/v1/calendar/calendars/:calendarId
router.get('/calendars/:calendarId', authenticate, async (req: Request, res: Response) => {
  const calendar = await calendarService.getCalendar(req.user!.id, req.params.calendarId);
  res.json({ success: true, data: calendar });
});

// PATCH /api/v1/calendar/calendars/:calendarId
router.patch('/calendars/:calendarId', authenticate, validate(updateCalendarSchema), async (req: Request, res: Response) => {
  const calendar = await calendarService.updateCalendar(req.user!.id, req.params.calendarId, req.body);
  res.json({ success: true, data: calendar });
});

// DELETE /api/v1/calendar/calendars/:calendarId
router.delete('/calendars/:calendarId', authenticate, async (req: Request, res: Response) => {
  await calendarService.deleteCalendar(req.user!.id, req.params.calendarId);
  res.json({ success: true, data: { message: 'Calendar deleted' } });
});

// ==========================================
// CALENDAR SHARING
// ==========================================

// POST /api/v1/calendar/calendars/:calendarId/share
router.post('/calendars/:calendarId/share', authenticate, validate(shareCalendarSchema), async (req: Request, res: Response) => {
  const share = await calendarService.shareCalendar(req.user!.id, req.params.calendarId, req.body);
  res.status(201).json({ success: true, data: share });
});

// PATCH /api/v1/calendar/shares/:shareId
router.patch('/shares/:shareId', authenticate, validate(updateShareSchema), async (req: Request, res: Response) => {
  const share = await calendarService.updateShare(req.user!.id, req.params.shareId, req.body.permission);
  res.json({ success: true, data: share });
});

// DELETE /api/v1/calendar/shares/:shareId
router.delete('/shares/:shareId', authenticate, async (req: Request, res: Response) => {
  await calendarService.removeShare(req.user!.id, req.params.shareId);
  res.json({ success: true, data: { message: 'Share removed' } });
});

// ==========================================
// EVENTS
// ==========================================

// GET /api/v1/calendar/events — query events for a date range
router.get('/events', authenticate, validate(eventsQuerySchema, 'query'), async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    start: Date;
    end: Date;
    calendarIds?: string[];
    includeShared: boolean;
  };
  const events = await calendarService.getEventsForRange(req.user!.id, query);
  res.json({ success: true, data: events });
});

// POST /api/v1/calendar/events
router.post('/events', authenticate, validate(createEventSchema), async (req: Request, res: Response) => {
  const event = await calendarService.createEvent(req.user!.id, req.body);
  res.status(201).json({ success: true, data: event });
});

// GET /api/v1/calendar/events/:eventId
router.get('/events/:eventId', authenticate, async (req: Request, res: Response) => {
  const event = await calendarService.getEvent(req.user!.id, req.params.eventId);
  res.json({ success: true, data: event });
});

// PATCH /api/v1/calendar/events/:eventId
router.patch('/events/:eventId', authenticate, validate(updateEventSchema), async (req: Request, res: Response) => {
  const event = await calendarService.updateEvent(req.user!.id, req.params.eventId, req.body);
  res.json({ success: true, data: event });
});

// DELETE /api/v1/calendar/events/:eventId
router.delete('/events/:eventId', authenticate, async (req: Request, res: Response) => {
  await calendarService.deleteEvent(req.user!.id, req.params.eventId);
  res.json({ success: true, data: { message: 'Event deleted' } });
});

// ==========================================
// ATTENDEES & RSVP
// ==========================================

// POST /api/v1/calendar/events/:eventId/attendees
router.post('/events/:eventId/attendees', authenticate, async (req: Request, res: Response) => {
  const { userId, email } = req.body;
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId is required', code: 'INVALID_INPUT' });
    return;
  }
  const attendee = await calendarService.addAttendee(req.user!.id, req.params.eventId, userId, email);
  res.status(201).json({ success: true, data: attendee });
});

// DELETE /api/v1/calendar/events/:eventId/attendees/:userId
router.delete('/events/:eventId/attendees/:userId', authenticate, async (req: Request, res: Response) => {
  await calendarService.removeAttendee(req.user!.id, req.params.eventId, req.params.userId);
  res.json({ success: true, data: { message: 'Attendee removed' } });
});

// POST /api/v1/calendar/events/:eventId/rsvp
router.post('/events/:eventId/rsvp', authenticate, validate(rsvpSchema), async (req: Request, res: Response) => {
  const attendee = await calendarService.rsvp(req.user!.id, req.params.eventId, req.body);
  res.json({ success: true, data: attendee });
});

// ==========================================
// REMINDERS
// ==========================================

// POST /api/v1/calendar/events/:eventId/reminders
router.post('/events/:eventId/reminders', authenticate, validate(createReminderSchema), async (req: Request, res: Response) => {
  const reminder = await calendarService.addReminder(req.user!.id, req.params.eventId, req.body);
  res.status(201).json({ success: true, data: reminder });
});

// DELETE /api/v1/calendar/reminders/:reminderId
router.delete('/reminders/:reminderId', authenticate, async (req: Request, res: Response) => {
  await calendarService.removeReminder(req.user!.id, req.params.reminderId);
  res.json({ success: true, data: { message: 'Reminder removed' } });
});

// ==========================================
// CONFLICT DETECTION
// ==========================================

// GET /api/v1/calendar/conflicts
router.get('/conflicts', authenticate, validate(conflictQuerySchema, 'query'), async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    start: string;
    end: string;
    excludeEventId?: string;
  };
  const conflicts = await calendarService.detectConflicts(req.user!.id, query);
  res.json({ success: true, data: conflicts });
});

// ==========================================
// VIEW ENDPOINTS
// ==========================================

// GET /api/v1/calendar/view/day?date=2026-03-06
router.get('/view/day', authenticate, async (req: Request, res: Response) => {
  const dateStr = req.query.date as string;
  if (!dateStr) {
    res.status(400).json({ success: false, error: 'date query parameter is required', code: 'INVALID_INPUT' });
    return;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    res.status(400).json({ success: false, error: 'Invalid date format', code: 'INVALID_INPUT' });
    return;
  }
  const events = await calendarService.getDayView(req.user!.id, date);
  res.json({ success: true, data: events });
});

// GET /api/v1/calendar/view/week?date=2026-03-06
router.get('/view/week', authenticate, async (req: Request, res: Response) => {
  const dateStr = req.query.date as string;
  if (!dateStr) {
    res.status(400).json({ success: false, error: 'date query parameter is required', code: 'INVALID_INPUT' });
    return;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    res.status(400).json({ success: false, error: 'Invalid date format', code: 'INVALID_INPUT' });
    return;
  }
  const view = await calendarService.getWeekView(req.user!.id, date);
  res.json({ success: true, data: view });
});

// GET /api/v1/calendar/view/month?year=2026&month=3
router.get('/view/month', authenticate, async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ success: false, error: 'Valid year and month (1-12) query parameters are required', code: 'INVALID_INPUT' });
    return;
  }
  const view = await calendarService.getMonthView(req.user!.id, year, month);
  res.json({ success: true, data: view });
});

// ==========================================
// BUSY/FREE STATUS
// ==========================================

// GET /api/v1/calendar/busy/:userId?start=...&end=...
router.get('/busy/:userId', authenticate, async (req: Request, res: Response) => {
  const startStr = req.query.start as string;
  const endStr = req.query.end as string;
  if (!startStr || !endStr) {
    res.status(400).json({ success: false, error: 'start and end query parameters are required', code: 'INVALID_INPUT' });
    return;
  }
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ success: false, error: 'Invalid date format', code: 'INVALID_INPUT' });
    return;
  }
  const slots = await calendarService.getBusyFreeStatus(req.user!.id, req.params.userId, start, end);
  res.json({ success: true, data: slots });
});

// ==========================================
// RESOURCES (Room/Equipment Booking)
// ==========================================

router.get('/resources', authenticate, async (req, res, next) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: resources });
  } catch (err) { next(err); }
});

router.post('/resources', authenticate, async (req, res, next) => {
  try {
    const { name, type, description, capacity, location } = req.body;
    const resource = await prisma.resource.create({
      data: { name, type: type || 'room', description, capacity, location },
    });
    res.json({ success: true, data: resource });
  } catch (err) { next(err); }
});

router.patch('/resources/:id', authenticate, async (req, res, next) => {
  try {
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: resource });
  } catch (err) { next(err); }
});

router.delete('/resources/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.resource.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// RESOURCE BOOKINGS
// ==========================================

router.get('/resources/:id/bookings', authenticate, async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const bookings = await prisma.resourceBooking.findMany({
      where: {
        resourceId: req.params.id,
        ...(start && end ? { startAt: { gte: new Date(start as string) }, endAt: { lte: new Date(end as string) } } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
    res.json({ success: true, data: bookings });
  } catch (err) { next(err); }
});

router.post('/resources/:id/bookings', authenticate, async (req, res, next) => {
  try {
    const { eventId, startAt, endAt } = req.body;
    // Check for conflicts
    const conflict = await prisma.resourceBooking.findFirst({
      where: {
        resourceId: req.params.id,
        OR: [
          { startAt: { lt: new Date(endAt) }, endAt: { gt: new Date(startAt) } },
        ],
      },
    });
    if (conflict) return res.status(409).json({ success: false, error: 'Resource is already booked for this time' });
    const booking = await prisma.resourceBooking.create({
      data: {
        resourceId: req.params.id,
        eventId,
        bookedBy: req.user!.id,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      },
    });
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
});

router.delete('/resource-bookings/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.resourceBooking.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// SCHEDULING ASSISTANT
// ==========================================

// Get combined availability for multiple users on a given date
router.post('/availability', authenticate, async (req, res, next) => {
  try {
    const { userIds, date } = req.body;
    if (!Array.isArray(userIds) || !date) {
      return res.status(400).json({ success: false, error: 'userIds (array) and date are required' });
    }
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const availability: Record<string, any[]> = {};
    for (const uid of userIds) {
      const calendars = await prisma.calendar.findMany({ where: { userId: uid } });
      const events = await prisma.calendarEvent.findMany({
        where: {
          calendarId: { in: calendars.map(c => c.id) },
          startAt: { lte: dayEnd },
          endAt: { gte: dayStart },
        },
        select: { startAt: true, endAt: true, busyStatus: true, title: true },
      });
      availability[uid] = events.map(e => ({
        start: e.startAt, end: e.endAt, status: e.busyStatus,
      }));
    }
    res.json({ success: true, data: availability });
  } catch (err) { next(err); }
});

export default router;
