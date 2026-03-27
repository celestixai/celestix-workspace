import { z } from 'zod';

export const createChatSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'CHANNEL']),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()),
}).refine(
  (data) => data.type === 'CHANNEL' || data.memberIds.length >= 1,
  { message: 'At least one member is required for DM and Group chats', path: ['memberIds'] },
);

export const sendMessageSchema = z.object({
  content: z.string().max(10000).optional(),
  contentHtml: z.string().max(50000).optional(),
  replyToId: z.string().uuid().optional(),
  forwardedFromId: z.string().uuid().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })).optional(),
});

export const editMessageSchema = z.object({
  content: z.string().max(10000),
  contentHtml: z.string().max(50000).optional(),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(20),
});

export const updateChatSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
