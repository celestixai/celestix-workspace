import { z } from 'zod';

const uuid = z.string().uuid();

const hierarchyLevel = z.enum(['WORKSPACE', 'SPACE', 'FOLDER', 'LIST']);

const viewType = z.enum([
  'LIST', 'BOARD', 'TABLE', 'CALENDAR', 'GANTT', 'TIMELINE',
  'WORKLOAD', 'MIND_MAP', 'MAP', 'TEAM', 'ACTIVITY', 'FORM', 'EMBED',
]);

export const createViewSchema = z.object({
  workspaceId: uuid,
  locationType: hierarchyLevel,
  locationId: uuid.optional(),
  name: z.string().min(1).max(100),
  viewType: viewType,
  icon: z.string().max(50).optional(),
  isPrivate: z.boolean().optional(),
  config: z.any().optional(),
  filters: z.any().optional(),
  sorts: z.any().optional(),
  groupBy: z.string().max(100).optional(),
  subGroupBy: z.string().max(100).optional(),
  showSubtasks: z.boolean().optional(),
  showClosedTasks: z.boolean().optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  viewType: viewType.optional(),
  icon: z.string().max(50).nullable().optional(),
  isPrivate: z.boolean().optional(),
  config: z.any().optional(),
  filters: z.any().optional(),
  sorts: z.any().optional(),
  groupBy: z.string().max(100).nullable().optional(),
  subGroupBy: z.string().max(100).nullable().optional(),
  showSubtasks: z.boolean().optional(),
  showClosedTasks: z.boolean().optional(),
});

export const duplicateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
});

export const taskQuerySchema = z.object({
  workspaceId: uuid.optional(),
  locationType: hierarchyLevel.optional(),
  locationId: uuid.optional(),
  filters: z.any().optional(),
  sorts: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  groupBy: z.string().optional(),
  subGroupBy: z.string().optional(),
  showSubtasks: z.boolean().optional(),
  showClosedTasks: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
export type DuplicateViewInput = z.infer<typeof duplicateViewSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
