import { z } from 'zod';

// ==========================================
// DESIGN SCHEMAS
// ==========================================

export const createDesignSchema = z.object({
  title: z.string().min(1).max(200),
  canvasSize: z.object({
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
  }).optional(),
  templateId: z.string().max(100).optional(),
});

export const updateDesignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  elements: z.array(z.any()).optional(),
});

export const duplicateDesignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateDesignInput = z.infer<typeof createDesignSchema>;
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
export type DuplicateDesignInput = z.infer<typeof duplicateDesignSchema>;
