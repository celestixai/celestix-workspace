import { z } from 'zod';

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  trigger: z.object({
    type: z.enum(['message_keyword', 'email_received', 'form_submitted', 'task_status_changed', 'event_starting', 'file_uploaded', 'scheduled', 'webhook']),
    config: z.record(z.any()),
  }),
  actions: z.array(z.object({
    type: z.enum(['send_message', 'send_email', 'create_task', 'create_event', 'update_list_item', 'send_notification', 'http_request', 'delay', 'condition']),
    config: z.record(z.any()),
  })),
  workspaceId: z.string().uuid().optional(),
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  isEnabled: z.boolean().optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
