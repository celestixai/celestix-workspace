import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color (e.g. #FF0000)');

// ==========================================
// Folder CRUD
// ==========================================

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  parentFolderId: z.string().uuid().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: hexColor.nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
});

// ==========================================
// Folder Statuses
// ==========================================

export const createFolderStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: hexColor,
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']),
  position: z.number().int().min(0).optional(),
});

export const updateFolderStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColor.optional(),
  statusGroup: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']).optional(),
  position: z.number().int().min(0).optional(),
});

// ==========================================
// Move
// ==========================================

export const moveFolderSchema = z.object({
  targetSpaceId: z.string().uuid().optional(),
  parentFolderId: z.string().uuid().nullable().optional(),
});

// ==========================================
// Type exports
// ==========================================

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateFolderStatusInput = z.infer<typeof createFolderStatusSchema>;
export type UpdateFolderStatusInput = z.infer<typeof updateFolderStatusSchema>;
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;
