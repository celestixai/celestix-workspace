import { z } from 'zod';

export const createListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().optional(),
  color: z.string().default('#4F8EF7'),
  templateId: z.string().optional(),
});

export const updateListSchema = createListSchema.partial();

export const createColumnSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['TEXT', 'MULTILINE', 'NUMBER', 'CURRENCY', 'PERCENTAGE', 'CHOICE', 'MULTI_CHOICE', 'DATE', 'DATETIME', 'PERSON', 'BOOLEAN', 'HYPERLINK', 'IMAGE', 'LOOKUP', 'CALCULATED']),
  settings: z.record(z.any()).optional(),
  position: z.number().int().default(0),
  isRequired: z.boolean().default(false),
});

export const updateColumnSchema = createColumnSchema.partial();

export const createItemSchema = z.object({
  values: z.record(z.any()).default({}),
});

export const updateItemSchema = z.object({
  values: z.record(z.any()),
});

export const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['LIST', 'GRID', 'GALLERY', 'CALENDAR', 'BOARD']).default('LIST'),
  filters: z.record(z.any()).optional(),
  sort: z.record(z.any()).optional(),
  groupBy: z.string().optional(),
  columnOrder: z.array(z.string()).optional(),
});

export const updateViewSchema = createViewSchema.partial();

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
