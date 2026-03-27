import { z } from 'zod';

export const relationTypeEnum = z.enum(['BLOCKS', 'WAITING_ON', 'LINKED_TO']);

export const createRelationshipSchema = z.object({
  targetTaskId: z.string().uuid(),
  type: relationTypeEnum,
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
