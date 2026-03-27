import { z } from 'zod';

// ==========================================
// Posts
// ==========================================

export const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  contentJson: z.any().optional(),
  coverImageUrl: z.string().url().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).optional(),
  contentJson: z.any().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});

// ==========================================
// Comments
// ==========================================

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
});

// ==========================================
// Follow-Ups
// ==========================================

export const createFollowUpSchema = z.object({
  channelId: z.string().uuid(),
  assignedToId: z.string().uuid(),
  dueDate: z.string().datetime().optional(),
  note: z.string().max(1000).optional(),
});

export const updateFollowUpSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// ==========================================
// Chat-to-Task
// ==========================================

export const createTaskFromMessageSchema = z.object({
  listId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  dueDate: z.string().datetime().optional(),
});
