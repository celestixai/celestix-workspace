import { z } from 'zod';

export const createReminderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO date string',
  }),
  isRecurring: z.boolean().optional(),
  recurrenceConfig: z.any().optional(),
  relatedTaskId: z.string().uuid().optional(),
  relatedMessageId: z.string().uuid().optional(),
});

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  dueAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO date string',
  }).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceConfig: z.any().optional(),
  relatedTaskId: z.string().uuid().nullable().optional(),
  relatedMessageId: z.string().uuid().nullable().optional(),
});

export const snoozeReminderSchema = z.object({
  duration: z.enum(['15m', '1h', '3h', 'tomorrow', 'next_week']),
});
