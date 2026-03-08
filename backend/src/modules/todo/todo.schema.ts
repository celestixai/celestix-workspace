import { z } from 'zod';

// ==========================================
// LIST SCHEMAS
// ==========================================

export const createListSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  position: z.number().int().min(0).optional(),
});

// ==========================================
// ITEM SCHEMAS
// ==========================================

export const createItemSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).optional(),
  dueDate: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  repeatRule: z.string().max(200).optional(),
  isImportant: z.boolean().optional(),
  isMyDay: z.boolean().optional(),
  position: z.number().int().optional(),
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  notes: z.string().max(10000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  repeatRule: z.string().max(200).nullable().optional(),
  isImportant: z.boolean().optional(),
  isMyDay: z.boolean().optional(),
  position: z.number().int().optional(),
  listId: z.string().uuid().optional(),
});

export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
  })).min(1),
});

// ==========================================
// STEP SCHEMAS
// ==========================================

export const createStepSchema = z.object({
  title: z.string().min(1).max(300),
  position: z.number().int().optional(),
});

export const updateStepSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  position: z.number().int().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
export type CreateStepInput = z.infer<typeof createStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
