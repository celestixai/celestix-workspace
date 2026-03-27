import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().uuid().optional(),
});

export const summarizeSchema = z.object({
  type: z.enum(['task_thread', 'doc', 'channel', 'sprint']),
  content: z.string().min(1).max(50000),
});

export const generateSchema = z.object({
  type: z.enum(['task_description', 'doc_draft', 'email_draft', 'post_draft', 'comment_reply']),
  prompt: z.string().min(1).max(5000),
  context: z.string().max(10000).optional(),
});

export const autofillSchema = z.object({
  title: z.string().min(1).max(500),
  context: z.string().max(5000).optional(),
});

export const subtasksSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
});

export const standupSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const translateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.string().min(2).max(50),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),
});
