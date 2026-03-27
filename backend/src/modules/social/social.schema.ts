import { z } from 'zod';

// ==========================================
// COMMUNITY SCHEMAS
// ==========================================

export const createCommunitySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  coverImage: z.string().max(500).optional(),
  isOfficial: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});

export const updateCommunitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  isOfficial: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});

// ==========================================
// POST SCHEMAS
// ==========================================

export const createPostSchema = z.object({
  type: z.enum(['DISCUSSION', 'QUESTION', 'POLL', 'PRAISE', 'ANNOUNCEMENT', 'EVENT']).optional(),
  title: z.string().max(300).optional(),
  bodyHtml: z.string().max(100000).optional(),
  images: z.array(z.string()).optional(),
  pollOptions: z.array(z.object({
    text: z.string().min(1).max(200),
    votes: z.number().int().min(0).optional(),
  })).optional(),
  pollExpiresAt: z.string().datetime().optional(),
  praiseUserId: z.string().uuid().optional(),
  praiseBadge: z.string().max(100).optional(),
  eventDate: z.string().datetime().optional(),
  isPinned: z.boolean().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().max(300).optional(),
  bodyHtml: z.string().max(100000).optional(),
  images: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
});

// ==========================================
// COMMENT SCHEMAS
// ==========================================

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
});

// ==========================================
// REACTION SCHEMAS
// ==========================================

export const addReactionSchema = z.object({
  type: z.enum(['like', 'love', 'celebrate', 'insightful', 'curious']),
});

// ==========================================
// FEED QUERY SCHEMAS
// ==========================================

export const feedQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export const postsByTypeSchema = z.object({
  type: z.enum(['DISCUSSION', 'QUESTION', 'POLL', 'PRAISE', 'ANNOUNCEMENT', 'EVENT']),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type AddReactionInput = z.infer<typeof addReactionSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type PostsByTypeInput = z.infer<typeof postsByTypeSchema>;
