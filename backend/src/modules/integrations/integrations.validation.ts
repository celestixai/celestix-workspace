import { z } from 'zod';

const IntegrationTypeEnum = z.enum([
  'GOOGLE_CALENDAR',
  'OUTLOOK_CALENDAR',
  'SLACK',
  'GITHUB',
  'GOOGLE_DRIVE',
  'WEBHOOK_INCOMING',
  'WEBHOOK_OUTGOING',
  'ZAPIER',
]);

export const createIntegrationSchema = z.object({
  type: IntegrationTypeEnum,
  name: z.string().min(1).max(100),
  config: z.any().optional(),
  workspaceId: z.string().uuid(),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.any().optional(),
  isActive: z.boolean().optional(),
});

export const webhookIncomingSchema = z.object({
  event: z.string().min(1),
  data: z.any(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
export type WebhookIncomingInput = z.infer<typeof webhookIncomingSchema>;
