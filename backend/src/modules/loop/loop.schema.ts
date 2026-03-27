import { z } from 'zod';

export const createComponentSchema = z.object({
  type: z.enum(['TABLE', 'TASK_LIST', 'VOTING_TABLE', 'STATUS_TRACKER', 'QA', 'BULLETED_LIST', 'NUMBERED_LIST', 'PARAGRAPH', 'CODE_SNIPPET', 'DIVIDER', 'REACTION_BAR']),
  content: z.record(z.any()).default({}),
  workspaceId: z.string().uuid().optional(),
});

export const updateComponentSchema = z.object({
  content: z.record(z.any()),
});

export const createPageSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled'),
  componentIds: z.array(z.string().uuid()).default([]),
  workspaceId: z.string().uuid().optional(),
});

export const updatePageSchema = createPageSchema.partial();

export const createEmbedSchema = z.object({
  componentId: z.string().uuid(),
  contextType: z.enum(['message', 'email', 'note', 'task', 'event']),
  contextId: z.string().uuid(),
});

export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateEmbedInput = z.infer<typeof createEmbedSchema>;
