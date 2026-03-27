import { z } from 'zod';

export const updateLayoutSchema = z.object({
  widgets: z.array(z.object({
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ w: z.number(), h: z.number() }),
    settings: z.record(z.any()).optional(),
  })),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
