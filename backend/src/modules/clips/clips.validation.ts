import { z } from 'zod';

export const updateClipSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateClipInput = z.infer<typeof updateClipSchema>;
