import { z } from 'zod';

export const startSyncUpSchema = z.object({
  title: z.string().max(200).optional(),
});

export const toggleMediaSchema = z.object({
  enabled: z.boolean(),
});
