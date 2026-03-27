import { z } from 'zod';

export const createWhiteboardSchema = z.object({
  name: z.string().min(1).max(200).default('Untitled Whiteboard'),
  workspaceId: z.string().uuid().optional(),
  templateId: z.string().optional(),
});

export const updateWhiteboardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  canvasData: z.array(z.any()).optional(),
});

export const addCollaboratorSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
});

export type CreateWhiteboardInput = z.infer<typeof createWhiteboardSchema>;
export type UpdateWhiteboardInput = z.infer<typeof updateWhiteboardSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
