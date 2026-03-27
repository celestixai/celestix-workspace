import { z } from 'zod';

const recurrenceFrequency = z.enum([
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'CUSTOM',
]);

export const createRecurrenceSchema = z.object({
  frequency: recurrenceFrequency,
  interval: z.number().int().min(1).max(365).optional().default(1),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .describe('0=Sunday, 1=Monday ... 6=Saturday'),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  endDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional()
    .nullable(),
  maxOccurrences: z.number().int().min(1).optional().nullable(),
  createBefore: z.number().int().min(0).max(30).optional().default(0),
  timezone: z.string().optional().default('UTC'),
});

export const updateRecurrenceSchema = createRecurrenceSchema.partial();

export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
