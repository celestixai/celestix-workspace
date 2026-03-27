import { z } from 'zod';

// ==========================================
// CALENDAR SCHEMAS
// ==========================================

export const createCalendarSchema = z.object({
  name: z.string().min(1, 'Calendar name is required').max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .default('#4F8EF7'),
  isVisible: z.boolean().optional().default(true),
});

export const updateCalendarSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  isVisible: z.boolean().optional(),
});

// ==========================================
// CALENDAR SHARING SCHEMAS
// ==========================================

export const shareCalendarSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
});

export const updateShareSchema = z.object({
  permission: z.enum(['VIEW', 'EDIT']),
});

// ==========================================
// EVENT SCHEMAS
// ==========================================

const reminderSchema = z.object({
  minutesBefore: z.number().int().min(0).max(40320), // up to 4 weeks
  type: z.enum(['push', 'email']).default('push'),
});

const attendeeSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
});

export const createEventSchema = z
  .object({
    calendarId: z.string().uuid('Invalid calendar ID'),
    title: z.string().min(1, 'Event title is required').max(500),
    description: z.string().max(10000).optional().nullable(),
    startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 datetime' }),
    endAt: z.string().datetime({ message: 'endAt must be a valid ISO 8601 datetime' }),
    allDay: z.boolean().optional().default(false),
    location: z.string().max(500).optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .nullable(),
    recurrenceRule: z.string().max(500).optional().nullable(),
    busyStatus: z.enum(['BUSY', 'FREE', 'TENTATIVE', 'OUT_OF_OFFICE']).optional().default('BUSY'),
    generateMeetingLink: z.boolean().optional().default(false),
    attendees: z.array(attendeeSchema).optional().default([]),
    reminders: z.array(reminderSchema).optional().default([]),
  })
  .refine(
    (data) => new Date(data.endAt) > new Date(data.startAt),
    { message: 'endAt must be after startAt', path: ['endAt'] }
  );

export const updateEventSchema = z
  .object({
    calendarId: z.string().uuid().optional(),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional().nullable(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    location: z.string().max(500).optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .nullable(),
    recurrenceRule: z.string().max(500).optional().nullable(),
    busyStatus: z.enum(['BUSY', 'FREE', 'TENTATIVE', 'OUT_OF_OFFICE']).optional(),
    meetingLink: z.string().url().optional().nullable(),
    attendees: z.array(attendeeSchema).optional(),
    reminders: z.array(reminderSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt);
      }
      return true;
    },
    { message: 'endAt must be after startAt', path: ['endAt'] }
  );

// ==========================================
// RSVP SCHEMA
// ==========================================

export const rsvpSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE', 'NO_RESPONSE']),
});

// ==========================================
// REMINDER SCHEMAS
// ==========================================

export const createReminderSchema = z.object({
  minutesBefore: z.number().int().min(0).max(40320),
  type: z.enum(['push', 'email']).default('push'),
});

export const updateReminderSchema = z.object({
  minutesBefore: z.number().int().min(0).max(40320).optional(),
  type: z.enum(['push', 'email']).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const eventsQuerySchema = z.object({
  start: z.coerce.date({ required_error: 'start date is required' }),
  end: z.coerce.date({ required_error: 'end date is required' }),
  calendarIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').filter(Boolean) : undefined)),
  includeShared: z.coerce.boolean().optional().default(true),
});

export const conflictQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  excludeEventId: z.string().uuid().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateCalendarInput = z.infer<typeof createCalendarSchema>;
export type UpdateCalendarInput = z.infer<typeof updateCalendarSchema>;
export type ShareCalendarInput = z.infer<typeof shareCalendarSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RSVPInput = z.infer<typeof rsvpSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type EventsQueryInput = z.infer<typeof eventsQuerySchema>;
export type ConflictQueryInput = z.infer<typeof conflictQuerySchema>;
