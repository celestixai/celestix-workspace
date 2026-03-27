import { z } from 'zod';

// ==========================================
// FOLDER SCHEMAS
// ==========================================

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  defaultDuration: z.number().int().min(1).max(365).optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  defaultDuration: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// ==========================================
// SPRINT SCHEMAS
// ==========================================

export const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  listId: z.string().uuid().optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  listId: z.string().uuid().nullable().optional(),
});

export const completeSprintSchema = z.object({
  moveIncompleteToSprintId: z.string().uuid().optional(),
});

// ==========================================
// TASK SCHEMAS
// ==========================================

export const addTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
});

// ==========================================
// Types
// ==========================================

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;
export type AddTasksInput = z.infer<typeof addTasksSchema>;
