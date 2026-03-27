import { z } from 'zod';

// ==========================================
// Template CRUD
// ==========================================

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  templateType: z.enum(['TASK', 'LIST', 'FOLDER', 'SPACE']).optional(),
  templateData: z.any(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  templateType: z.enum(['TASK', 'LIST', 'FOLDER', 'SPACE']).optional(),
  templateData: z.any().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  previewImageUrl: z.string().nullable().optional(),
});

export const applyTemplateSchema = z.object({
  targetListId: z.string().uuid(),
  remapDates: z.boolean().optional(),
  dateOffset: z.number().int().optional(),
});

// ==========================================
// Type exports
// ==========================================

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
