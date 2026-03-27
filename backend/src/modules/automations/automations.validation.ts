import { z } from 'zod';

const uuid = z.string().uuid();

const hierarchyLevel = z.enum(['WORKSPACE', 'SPACE', 'FOLDER', 'LIST']);

export const createAutomationSchema = z.object({
  workspaceId: uuid,
  locationId: uuid.optional(),
  locationType: hierarchyLevel.optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  trigger: z.object({
    type: z.string(),
    config: z.any().optional(),
  }),
  conditions: z.any().optional(),
  actions: z.array(
    z.object({
      type: z.string(),
      config: z.any(),
    }),
  ),
  isActive: z.boolean().optional(),
});

export const updateAutomationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  locationId: uuid.nullable().optional(),
  locationType: hierarchyLevel.nullable().optional(),
  trigger: z
    .object({
      type: z.string(),
      config: z.any().optional(),
    })
    .optional(),
  conditions: z.any().optional(),
  actions: z
    .array(
      z.object({
        type: z.string(),
        config: z.any(),
      }),
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export const testAutomationSchema = z.object({
  taskId: uuid,
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
