import { z } from 'zod';

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
  workDays: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun, 1=Mon ... 6=Sat
  workHoursPerDay: z.number().min(0.5).max(24).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
  timezone: z.string().optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  workDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  workHoursPerDay: z.number().min(0.5).max(24).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
  timezone: z.string().optional(),
});

export const assignScheduleSchema = z.object({
  userId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  effectiveFrom: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
});

export const createTimeOffSchema = z.object({
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'HOLIDAY', 'OTHER']),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  isHalfDay: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export const updateTimeOffSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});
