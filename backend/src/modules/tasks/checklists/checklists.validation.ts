import { z } from 'zod';

export const createChecklistSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateChecklistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1).max(500),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const reorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
