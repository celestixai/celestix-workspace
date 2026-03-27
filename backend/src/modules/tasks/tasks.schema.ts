import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

export const taskStatusEnum = z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
export const taskPriorityEnum = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);
export const memberRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);

// ==========================================
// PROJECT SCHEMAS
// ==========================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  columnOrder: z.array(taskStatusEnum).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  columnOrder: z.array(taskStatusEnum).optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: memberRoleEnum.optional().default('MEMBER'),
});

export const updateProjectMemberSchema = z.object({
  role: memberRoleEnum,
});

// ==========================================
// TASK SCHEMAS
// ==========================================

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  descriptionHtml: z.string().max(100000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  parentTaskId: z.string().uuid().optional(),
  position: z.number().optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  listId: z.string().uuid().optional(),
  statusName: z.string().optional(),
  statusColor: z.string().optional(),
  taskTypeId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionHtml: z.string().max(100000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  position: z.number().optional(),
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
});

export const updateTaskDatesSchema = z.object({
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const updateTaskPositionSchema = z.object({
  status: taskStatusEnum.optional(),
  position: z.number(),
});

// ==========================================
// ASSIGNEE SCHEMAS
// ==========================================

export const assignUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

// ==========================================
// LABEL SCHEMAS
// ==========================================

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const assignLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).min(1),
});

// ==========================================
// COMMENT SCHEMAS
// ==========================================

export const createCommentSchema = z.object({
  bodyHtml: z.string().min(1).max(50000),
});

export const updateCommentSchema = z.object({
  bodyHtml: z.string().min(1).max(50000),
});

// ==========================================
// TIME ENTRY SCHEMAS
// ==========================================

export const logTimeEntrySchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).optional(),
});

// ==========================================
// DEPENDENCY SCHEMAS
// ==========================================

export const addDependencySchema = z.object({
  dependsOnId: z.string().uuid(),
});

// ==========================================
// FILTER / SORT / QUERY SCHEMAS
// ==========================================

export const taskFiltersSchema = z.object({
  status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
  priority: z.union([taskPriorityEnum, z.array(taskPriorityEnum)]).optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['priority', 'dueDate', 'createdAt', 'title', 'position']).optional().default('position'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
});

// ==========================================
// BULK OPERATION SCHEMAS
// ==========================================

export const bulkUpdateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(100),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
});

export const bulkActionEnum = z.enum([
  'update_status',
  'update_priority',
  'assign',
  'unassign',
  'add_label',
  'remove_label',
  'set_due_date',
  'move',
  'duplicate',
  'delete',
  'archive',
  'set_custom_field',
]);

export const bulkActionSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(500),
  action: bulkActionEnum,
  payload: z.record(z.unknown()).optional().default({}),
});

// ==========================================
// SUBTASK SCHEMAS
// ==========================================

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(100000).optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  statusName: z.string().max(100).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export const convertToSubtaskSchema = z.object({
  parentTaskId: z.string().uuid(),
});

export const moveSubtaskSchema = z.object({
  newParentTaskId: z.string().uuid(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskPositionInput = z.infer<typeof updateTaskPositionSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type LogTimeEntryInput = z.infer<typeof logTimeEntrySchema>;
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>;
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type ConvertToSubtaskInput = z.infer<typeof convertToSubtaskSchema>;
export type MoveSubtaskInput = z.infer<typeof moveSubtaskSchema>;
export type UpdateTaskDatesInput = z.infer<typeof updateTaskDatesSchema>;
