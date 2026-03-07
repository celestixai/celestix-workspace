import { z } from 'zod';

export const createVideoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  channelId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']).default('PUBLIC'),
  chapters: z.array(z.object({ time: z.number(), title: z.string() })).optional(),
});

export const updateVideoSchema = createVideoSchema.partial();

export const createChannelSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().uuid().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  timestampSeconds: z.number().int().optional(),
  parentCommentId: z.string().uuid().optional(),
});

export const createPlaylistSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoIds: z.array(z.string().uuid()).default([]),
});

export const updatePlaylistSchema = createPlaylistSchema.partial();

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;
