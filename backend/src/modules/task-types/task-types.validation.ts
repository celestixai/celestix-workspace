import { z } from 'zod';

export const createTaskTypeSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  description: z.string().max(200).optional(),
  isDefault: z.boolean().optional(),
});

export const updateTaskTypeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  isDefault: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateTaskTypeInput = z.infer<typeof createTaskTypeSchema>;
export type UpdateTaskTypeInput = z.infer<typeof updateTaskTypeSchema>;
