import { z } from 'zod';

export const reportQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  groupBy: z.enum(['user', 'task', 'project', 'tag']).optional().default('user'),
});

export const timesheetQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  weekStart: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
});

export const timesheetEntrySchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  minutes: z.number().int().min(0).max(1440),
  note: z.string().optional(),
  isBillable: z.boolean().optional(),
});

export const timesheetEntryUpdateSchema = z.object({
  minutes: z.number().int().min(0).max(1440),
  note: z.string().optional(),
});

export const billableRatesSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  defaultRate: z.number().min(0),
  userRates: z
    .array(
      z.object({
        userId: z.string().uuid(),
        rate: z.number().min(0),
      })
    )
    .optional(),
});
