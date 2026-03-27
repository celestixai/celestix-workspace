import { z } from 'zod';

export const createGoalFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
});

export const updateGoalFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  folderId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  isPrivate: z.boolean().optional(),
  workspaceId: z.string().uuid(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const createTargetSchema = z.object({
  name: z.string().min(1).max(200),
  targetType: z.enum(['NUMBER', 'CURRENCY', 'TRUE_FALSE', 'TASK_COMPLETION', 'AUTOMATIC']),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  listId: z.string().uuid().optional(),
});

export const updateTargetSchema = z.object({
  currentValue: z.number().optional(),
  name: z.string().min(1).max(200).optional(),
  targetValue: z.number().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'CONTRIBUTOR', 'VIEWER']).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'CONTRIBUTOR', 'VIEWER']),
});

export const updateProgressSchema = z.object({
  value: z.number(),
});

export type CreateGoalFolderInput = z.infer<typeof createGoalFolderSchema>;
export type UpdateGoalFolderInput = z.infer<typeof updateGoalFolderSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateTargetInput = z.infer<typeof createTargetSchema>;
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
