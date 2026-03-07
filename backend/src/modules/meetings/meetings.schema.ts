import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().min(5).max(480).optional(),
  isRecurring: z.boolean().optional().default(false),
  recurrenceRule: z.string().optional(),
  password: z.string().max(20).optional(),
  attendeeIds: z.array(z.string().uuid()).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().min(5).max(480).optional(),
  password: z.string().max(20).optional(),
  isLocked: z.boolean().optional(),
});

export const meetingChatSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
