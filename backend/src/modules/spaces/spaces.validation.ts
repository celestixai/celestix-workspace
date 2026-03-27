import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color (e.g. #FF0000)');

// ==========================================
// Space CRUD
// ==========================================

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  isPrivate: z.boolean().optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: hexColor.nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
});

// ==========================================
// Statuses
// ==========================================

export const createStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: hexColor,
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']),
  position: z.number().int().min(0).optional(),
});

export const updateStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColor.optional(),
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']).optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderStatusesSchema = z.object({
  statuses: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
  })).min(1),
});

// ==========================================
// Members
// ==========================================

export const addMemberSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']),
});

// ==========================================
// Duplicate
// ==========================================

export const duplicateSpaceSchema = z.object({
  includeTasks: z.boolean().optional().default(false),
});

// ==========================================
// Task ID Prefix
// ==========================================

export const setTaskIdPrefixSchema = z.object({
  prefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9-]+$/, 'Must be 2-10 uppercase alphanumeric characters or hyphens')
    .transform((v) => v.toUpperCase()),
});

export type SetTaskIdPrefixInput = z.infer<typeof setTaskIdPrefixSchema>;

// ==========================================
// Type exports
// ==========================================

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ReorderStatusesInput = z.infer<typeof reorderStatusesSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type DuplicateSpaceInput = z.infer<typeof duplicateSpaceSchema>;
