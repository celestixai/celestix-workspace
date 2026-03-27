import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color (e.g. #FF0000)');

// ==========================================
// List CRUD
// ==========================================

export const createListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: hexColor.nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).nullable().optional(),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
});

// ==========================================
// List Statuses
// ==========================================

export const createListStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: hexColor,
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']),
  position: z.number().int().min(0).optional(),
});

export const updateListStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColor.optional(),
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']).optional(),
  position: z.number().int().min(0).optional(),
});

// ==========================================
// Move & Duplicate
// ==========================================

export const moveListSchema = z.object({
  targetFolderId: z.string().uuid().nullable().optional(),
  targetSpaceId: z.string().uuid().optional(),
});

export const duplicateListSchema = z.object({
  includeTasks: z.boolean().optional().default(false),
});

// ==========================================
// Type exports
// ==========================================

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type CreateListStatusInput = z.infer<typeof createListStatusSchema>;
export type UpdateListStatusInput = z.infer<typeof updateListStatusSchema>;
export type MoveListInput = z.infer<typeof moveListSchema>;
export type DuplicateListInput = z.infer<typeof duplicateListSchema>;
