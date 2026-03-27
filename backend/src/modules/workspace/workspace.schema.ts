import { z } from 'zod';

// ==========================================
// Workspace
// ==========================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

// ==========================================
// Channels
// ==========================================

export const createChannelSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-_]*$/, 'Channel name must be lowercase, start with alphanumeric, hyphens/underscores allowed'),
  description: z.string().max(500).optional(),
  topic: z.string().max(250).optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'DM']).default('PUBLIC'),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-_]*$/).optional(),
  description: z.string().max(500).optional(),
  topic: z.string().max(250).nullable().optional(),
});

export const archiveChannelSchema = z.object({
  archive: z.boolean(),
});

// ==========================================
// Messages
// ==========================================

export const sendMessageSchema = z.object({
  content: z.string().max(40000).optional(),
  contentHtml: z.string().max(100000).optional(),
  parentMessageId: z.string().uuid().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const editMessageSchema = z.object({
  content: z.string().max(40000),
  contentHtml: z.string().max(100000).optional(),
});

// ==========================================
// Reactions
// ==========================================

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(50),
});

// ==========================================
// Bookmarks
// ==========================================

export const channelBookmarkSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
});

// ==========================================
// Channel Members
// ==========================================

export const addChannelMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export const updateChannelMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).optional(),
});

export const channelMemberPrefsSchema = z.object({
  isStarred: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  notificationPref: z.enum(['all', 'mentions', 'none']).optional(),
});

// ==========================================
// Workspace Members
// ==========================================

export const inviteMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']).default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']),
});

// ==========================================
// Custom Emoji
// ==========================================

export const customEmojiSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'Emoji name must be lowercase alphanumeric with hyphens/underscores'),
  imageUrl: z.string().url(),
});

// ==========================================
// Search
// ==========================================

export const searchMessagesSchema = z.object({
  query: z.string().min(1).max(500),
  channelId: z.string().uuid().optional(),
  fromUserId: z.string().uuid().optional(),
  after: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  hasLink: z.coerce.boolean().optional(),
  hasFile: z.coerce.boolean().optional(),
  hasReaction: z.coerce.boolean().optional(),
  hasThread: z.coerce.boolean().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
});

// ==========================================
// Slash Commands
// ==========================================

export const slashCommandSchema = z.object({
  command: z.string().min(1),
  channelId: z.string().uuid(),
});

// ==========================================
// Messages Query
// ==========================================

export const messagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const threadQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// ==========================================
// DM
// ==========================================

export const createDmSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(8),
});

// ==========================================
// Huddles
// ==========================================

export const startHuddleSchema = z.object({
  topic: z.string().max(200).optional(),
  audioOnly: z.boolean().default(true),
});

// ==========================================
// Canvas
// ==========================================

export const createCanvasSchema = z.object({
  title: z.string().min(1).max(200),
  contentJson: z.record(z.unknown()).optional(),
  contentText: z.string().max(500000).optional(),
});

export const updateCanvasSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentJson: z.record(z.unknown()).optional(),
  contentText: z.string().max(500000).optional(),
});

// ==========================================
// Channel Analytics
// ==========================================

export const channelAnalyticsQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

// ==========================================
// Workflow Automations
// ==========================================

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trigger: z.object({
    type: z.enum(['message_posted', 'member_joined', 'reaction_added', 'keyword', 'scheduled']),
    channelId: z.string().uuid().optional(),
    keyword: z.string().max(100).optional(),
    schedule: z.string().max(100).optional(),
  }),
  actions: z.array(z.object({
    type: z.enum(['send_message', 'add_reaction', 'create_channel', 'invite_to_channel', 'webhook']),
    config: z.record(z.unknown()),
  })).min(1).max(10),
  enabled: z.boolean().default(true),
});

export const updateAutomationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  trigger: z.object({
    type: z.enum(['message_posted', 'member_joined', 'reaction_added', 'keyword', 'scheduled']),
    channelId: z.string().uuid().optional(),
    keyword: z.string().max(100).optional(),
    schedule: z.string().max(100).optional(),
  }).optional(),
  actions: z.array(z.object({
    type: z.enum(['send_message', 'add_reaction', 'create_channel', 'invite_to_channel', 'webhook']),
    config: z.record(z.unknown()),
  })).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

// ==========================================
// Workspace Invites
// ==========================================

export const createInviteSchema = z.object({
  expiresIn: z.enum(['1h', '12h', '1d', '7d', '30d', 'never']).default('7d'),
  maxUses: z.enum(['1', '5', '10', '25', '50', '100', 'unlimited']).default('unlimited'),
});

export const joinViaTokenSchema = z.object({
  token: z.string().min(8).max(20),
});

// ==========================================
// Inferred Types
// ==========================================

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;
export type SlashCommandInput = z.infer<typeof slashCommandSchema>;
export type StartHuddleInput = z.infer<typeof startHuddleSchema>;
export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type JoinViaTokenInput = z.infer<typeof joinViaTokenSchema>;
