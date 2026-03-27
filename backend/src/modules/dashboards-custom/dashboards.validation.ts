import { z } from 'zod';

const dashboardCardTypes = [
  'STATUS_CHART',
  'PRIORITY_CHART',
  'ASSIGNEE_WORKLOAD',
  'TIME_TRACKING',
  'SPRINT_BURNDOWN',
  'SPRINT_VELOCITY',
  'DUE_DATE_OVERVIEW',
  'CUSTOM_FIELD_CHART',
  'TEXT_BLOCK',
  'EMBED',
  'TASK_LIST',
  'GOAL_PROGRESS',
  'TIMESHEET',
  'CALCULATION',
  'RECENT_ACTIVITY',
  'CHAT_EMBED',
  'PIE_CHART',
  'LINE_CHART',
  'BAR_CHART',
  'KPI_CARD',
] as const;

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const addCardSchema = z.object({
  cardType: z.enum(dashboardCardTypes),
  title: z.string().optional(),
  config: z.any().optional(),
  position: positionSchema.optional(),
});

export const updateCardSchema = z.object({
  title: z.string().optional(),
  config: z.any().optional(),
  position: positionSchema.optional(),
});

export const updateLayoutSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().uuid(),
      position: positionSchema,
    })
  ),
});

export const shareDashboardSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['VIEW', 'COMMENT', 'EDIT', 'FULL']).optional(),
});

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;
export type AddCardInput = z.infer<typeof addCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
export type ShareDashboardInput = z.infer<typeof shareDashboardSchema>;
