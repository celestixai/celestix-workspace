import { Router, Request, Response } from 'express';
import { workspaceService } from './workspace.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createChannelSchema,
  updateChannelSchema,
  archiveChannelSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  channelBookmarkSchema,
  addChannelMembersSchema,
  updateChannelMemberSchema,
  channelMemberPrefsSchema,
  inviteMembersSchema,
  updateMemberRoleSchema,
  customEmojiSchema,
  searchMessagesSchema,
  slashCommandSchema,
  messagesQuerySchema,
  threadQuerySchema,
  createDmSchema,
} from './workspace.schema';

const router = Router();

// ==========================================
// Workspace CRUD
// ==========================================

// GET /api/v1/workspace
router.get('/', authenticate, async (req: Request, res: Response) => {
  const workspaces = await workspaceService.getWorkspaces(req.user!.id);
  res.json({ success: true, data: workspaces });
});

// POST /api/v1/workspace
router.post('/', authenticate, validate(createWorkspaceSchema), async (req: Request, res: Response) => {
  const workspace = await workspaceService.createWorkspace(req.user!.id, req.body);
  res.status(201).json({ success: true, data: workspace });
});

// GET /api/v1/workspace/channels — convenience: auto-resolve user's first workspace (auto-creates one if needed)
router.get('/channels', authenticate, async (req: Request, res: Response) => {
  let workspaces = await workspaceService.getWorkspaces(req.user!.id);
  if (workspaces.length === 0) {
    const user = req.user!;
    const slug = `ws-${user.id.substring(0, 8)}`;
    await workspaceService.createWorkspace(user.id, {
      name: 'My Workspace',
      slug,
      description: 'Default workspace',
    });
    workspaces = await workspaceService.getWorkspaces(user.id);
  }
  const channels = await workspaceService.getChannels(req.user!.id, workspaces[0].id);
  res.json({ success: true, data: channels });
});

// POST /api/v1/workspace/channels — convenience: auto-resolve user's first workspace (auto-creates one if needed)
router.post('/channels', authenticate, validate(createChannelSchema), async (req: Request, res: Response) => {
  let workspaces = await workspaceService.getWorkspaces(req.user!.id);
  if (workspaces.length === 0) {
    const user = req.user!;
    const slug = `ws-${user.id.substring(0, 8)}`;
    await workspaceService.createWorkspace(user.id, {
      name: 'My Workspace',
      slug,
      description: 'Default workspace',
    });
    workspaces = await workspaceService.getWorkspaces(user.id);
  }
  const channel = await workspaceService.createChannel(req.user!.id, workspaces[0].id, req.body);
  res.status(201).json({ success: true, data: channel });
});

// GET /api/v1/workspace/:workspaceId
router.get('/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const workspace = await workspaceService.getWorkspace(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: workspace });
});

// PATCH /api/v1/workspace/:workspaceId
router.patch('/:workspaceId', authenticate, validate(updateWorkspaceSchema), async (req: Request, res: Response) => {
  const workspace = await workspaceService.updateWorkspace(req.user!.id, req.params.workspaceId, req.body);
  res.json({ success: true, data: workspace });
});

// DELETE /api/v1/workspace/:workspaceId
router.delete('/:workspaceId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.deleteWorkspace(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: { message: 'Workspace deleted' } });
});

// POST /api/v1/workspace/:workspaceId/regenerate-invite
router.post('/:workspaceId/regenerate-invite', authenticate, async (req: Request, res: Response) => {
  const inviteCode = await workspaceService.regenerateInviteCode(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: { inviteCode } });
});

// POST /api/v1/workspace/join/:inviteCode
router.post('/join/:inviteCode', authenticate, async (req: Request, res: Response) => {
  const result = await workspaceService.joinViaInvite(req.user!.id, req.params.inviteCode);
  res.json({ success: true, data: result });
});

// ==========================================
// Workspace Members
// ==========================================

// POST /api/v1/workspace/:workspaceId/members
router.post('/:workspaceId/members', authenticate, validate(inviteMembersSchema), async (req: Request, res: Response) => {
  const members = await workspaceService.inviteMembers(
    req.user!.id,
    req.params.workspaceId,
    req.body.userIds,
    req.body.role,
  );
  res.status(201).json({ success: true, data: members });
});

// PATCH /api/v1/workspace/:workspaceId/members/:userId
router.patch('/:workspaceId/members/:userId', authenticate, validate(updateMemberRoleSchema), async (req: Request, res: Response) => {
  const member = await workspaceService.updateMemberRole(
    req.user!.id,
    req.params.workspaceId,
    req.params.userId,
    req.body.role,
  );
  res.json({ success: true, data: member });
});

// DELETE /api/v1/workspace/:workspaceId/members/:userId
router.delete('/:workspaceId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.removeMember(req.user!.id, req.params.workspaceId, req.params.userId);
  res.json({ success: true, data: { removed: true } });
});

// POST /api/v1/workspace/:workspaceId/leave
router.post('/:workspaceId/leave', authenticate, async (req: Request, res: Response) => {
  await workspaceService.leaveWorkspace(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: { left: true } });
});

// ==========================================
// Channels
// ==========================================

// GET /api/v1/workspace/:workspaceId/channels
router.get('/:workspaceId/channels', authenticate, async (req: Request, res: Response) => {
  const channels = await workspaceService.getChannels(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: channels });
});

// POST /api/v1/workspace/:workspaceId/channels
router.post('/:workspaceId/channels', authenticate, validate(createChannelSchema), async (req: Request, res: Response) => {
  const channel = await workspaceService.createChannel(req.user!.id, req.params.workspaceId, req.body);
  res.status(201).json({ success: true, data: channel });
});

// POST /api/v1/workspace/:workspaceId/dm
router.post('/:workspaceId/dm', authenticate, validate(createDmSchema), async (req: Request, res: Response) => {
  const channel = await workspaceService.createDm(req.user!.id, req.params.workspaceId, req.body.userIds);
  res.status(201).json({ success: true, data: channel });
});

// GET /api/v1/workspace/channels/:channelId
router.get('/channels/:channelId', authenticate, async (req: Request, res: Response) => {
  const channel = await workspaceService.getChannel(req.user!.id, req.params.channelId);
  res.json({ success: true, data: channel });
});

// PATCH /api/v1/workspace/channels/:channelId
router.patch('/channels/:channelId', authenticate, validate(updateChannelSchema), async (req: Request, res: Response) => {
  const channel = await workspaceService.updateChannel(req.user!.id, req.params.channelId, req.body);
  res.json({ success: true, data: channel });
});

// POST /api/v1/workspace/channels/:channelId/archive
router.post('/channels/:channelId/archive', authenticate, validate(archiveChannelSchema), async (req: Request, res: Response) => {
  const channel = await workspaceService.archiveChannel(req.user!.id, req.params.channelId, req.body.archive);
  res.json({ success: true, data: channel });
});

// DELETE /api/v1/workspace/channels/:channelId
router.delete('/channels/:channelId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.deleteChannel(req.user!.id, req.params.channelId);
  res.json({ success: true, data: { message: 'Channel deleted' } });
});

// POST /api/v1/workspace/channels/:channelId/join
router.post('/channels/:channelId/join', authenticate, async (req: Request, res: Response) => {
  const membership = await workspaceService.joinChannel(req.user!.id, req.params.channelId);
  res.json({ success: true, data: membership });
});

// POST /api/v1/workspace/channels/:channelId/leave
router.post('/channels/:channelId/leave', authenticate, async (req: Request, res: Response) => {
  await workspaceService.leaveChannel(req.user!.id, req.params.channelId);
  res.json({ success: true, data: { left: true } });
});

// ==========================================
// Channel Members
// ==========================================

// POST /api/v1/workspace/channels/:channelId/members
router.post('/channels/:channelId/members', authenticate, validate(addChannelMembersSchema), async (req: Request, res: Response) => {
  const members = await workspaceService.addChannelMembers(req.user!.id, req.params.channelId, req.body.userIds);
  res.status(201).json({ success: true, data: members });
});

// DELETE /api/v1/workspace/channels/:channelId/members/:userId
router.delete('/channels/:channelId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.removeChannelMember(req.user!.id, req.params.channelId, req.params.userId);
  res.json({ success: true, data: { removed: true } });
});

// PATCH /api/v1/workspace/channels/:channelId/members/:userId/role
router.patch('/channels/:channelId/members/:userId/role', authenticate, validate(updateChannelMemberSchema), async (req: Request, res: Response) => {
  const member = await workspaceService.updateChannelMemberRole(
    req.user!.id,
    req.params.channelId,
    req.params.userId,
    req.body.role,
  );
  res.json({ success: true, data: member });
});

// PATCH /api/v1/workspace/channels/:channelId/prefs
router.patch('/channels/:channelId/prefs', authenticate, validate(channelMemberPrefsSchema), async (req: Request, res: Response) => {
  const prefs = await workspaceService.updateChannelMemberPrefs(req.user!.id, req.params.channelId, req.body);
  res.json({ success: true, data: prefs });
});

// ==========================================
// Messages
// ==========================================

// GET /api/v1/workspace/channels/:channelId/messages
router.get('/channels/:channelId/messages', authenticate, validate(messagesQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await workspaceService.getMessages(req.user!.id, req.params.channelId, cursor, Number(limit) || 50);
  res.json({
    success: true,
    data: result.messages,
    pagination: { hasMore: result.hasMore, cursor: result.cursor },
  });
});

// POST /api/v1/workspace/channels/:channelId/messages
router.post('/channels/:channelId/messages', authenticate, validate(sendMessageSchema), async (req: Request, res: Response) => {
  const message = await workspaceService.sendMessage(req.user!.id, req.params.channelId, req.body);
  res.status(201).json({ success: true, data: message });
});

// PATCH /api/v1/workspace/messages/:messageId
router.patch('/messages/:messageId', authenticate, validate(editMessageSchema), async (req: Request, res: Response) => {
  const message = await workspaceService.editMessage(req.user!.id, req.params.messageId, req.body);
  res.json({ success: true, data: message });
});

// DELETE /api/v1/workspace/messages/:messageId
router.delete('/messages/:messageId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.deleteMessage(req.user!.id, req.params.messageId);
  res.json({ success: true, data: { message: 'Message deleted' } });
});

// ==========================================
// Threads
// ==========================================

// GET /api/v1/workspace/messages/:messageId/thread
router.get('/messages/:messageId/thread', authenticate, validate(threadQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await workspaceService.getThreadReplies(req.user!.id, req.params.messageId, cursor, Number(limit) || 50);
  res.json({
    success: true,
    data: {
      parentMessage: result.parentMessage,
      replies: result.replies,
    },
    pagination: { hasMore: result.hasMore, cursor: result.cursor },
  });
});

// ==========================================
// Reactions
// ==========================================

// POST /api/v1/workspace/messages/:messageId/reactions
router.post('/messages/:messageId/reactions', authenticate, validate(reactionSchema), async (req: Request, res: Response) => {
  const result = await workspaceService.toggleReaction(req.user!.id, req.params.messageId, req.body.emoji);
  res.json({ success: true, data: result });
});

// ==========================================
// Bookmarks
// ==========================================

// GET /api/v1/workspace/channels/:channelId/bookmarks
router.get('/channels/:channelId/bookmarks', authenticate, async (req: Request, res: Response) => {
  const bookmarks = await workspaceService.getChannelBookmarks(req.user!.id, req.params.channelId);
  res.json({ success: true, data: bookmarks });
});

// POST /api/v1/workspace/channels/:channelId/bookmarks
router.post('/channels/:channelId/bookmarks', authenticate, validate(channelBookmarkSchema), async (req: Request, res: Response) => {
  const bookmark = await workspaceService.addChannelBookmark(req.user!.id, req.params.channelId, req.body.title, req.body.url);
  res.status(201).json({ success: true, data: bookmark });
});

// DELETE /api/v1/workspace/bookmarks/:bookmarkId
router.delete('/bookmarks/:bookmarkId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.removeChannelBookmark(req.user!.id, req.params.bookmarkId);
  res.json({ success: true, data: { message: 'Bookmark removed' } });
});

// POST /api/v1/workspace/messages/:messageId/bookmark
router.post('/messages/:messageId/bookmark', authenticate, async (req: Request, res: Response) => {
  const result = await workspaceService.toggleMessageBookmark(req.user!.id, req.params.messageId);
  res.json({ success: true, data: result });
});

// GET /api/v1/workspace/:workspaceId/saved
router.get('/:workspaceId/saved', authenticate, async (req: Request, res: Response) => {
  const saved = await workspaceService.getSavedMessages(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: saved });
});

// ==========================================
// Read / Unread
// ==========================================

// POST /api/v1/workspace/channels/:channelId/read
router.post('/channels/:channelId/read', authenticate, async (req: Request, res: Response) => {
  await workspaceService.markChannelRead(req.user!.id, req.params.channelId);
  res.json({ success: true, data: { read: true } });
});

// GET /api/v1/workspace/:workspaceId/unread
router.get('/:workspaceId/unread', authenticate, async (req: Request, res: Response) => {
  const counts = await workspaceService.getUnreadCounts(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: counts });
});

// ==========================================
// Search
// ==========================================

// GET /api/v1/workspace/:workspaceId/search
router.get('/:workspaceId/search', authenticate, validate(searchMessagesSchema, 'query'), async (req: Request, res: Response) => {
  const result = await workspaceService.searchMessages(req.user!.id, req.params.workspaceId, req.query as any);
  res.json({
    success: true,
    data: result.messages,
    pagination: { hasMore: result.hasMore, cursor: result.cursor },
  });
});

// ==========================================
// Mentions
// ==========================================

// GET /api/v1/workspace/:workspaceId/mentions
router.get('/:workspaceId/mentions', authenticate, async (req: Request, res: Response) => {
  const mentions = await workspaceService.getMentions(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: mentions });
});

// ==========================================
// Custom Emoji
// ==========================================

// GET /api/v1/workspace/:workspaceId/emoji
router.get('/:workspaceId/emoji', authenticate, async (req: Request, res: Response) => {
  const emojis = await workspaceService.getCustomEmojis(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: emojis });
});

// POST /api/v1/workspace/:workspaceId/emoji
router.post('/:workspaceId/emoji', authenticate, validate(customEmojiSchema), async (req: Request, res: Response) => {
  const emoji = await workspaceService.addCustomEmoji(req.user!.id, req.params.workspaceId, req.body.name, req.body.imageUrl);
  res.status(201).json({ success: true, data: emoji });
});

// DELETE /api/v1/workspace/emoji/:emojiId
router.delete('/emoji/:emojiId', authenticate, async (req: Request, res: Response) => {
  await workspaceService.removeCustomEmoji(req.user!.id, req.params.emojiId);
  res.json({ success: true, data: { message: 'Emoji removed' } });
});

// ==========================================
// Slash Commands
// ==========================================

// POST /api/v1/workspace/:workspaceId/command
router.post('/:workspaceId/command', authenticate, validate(slashCommandSchema), async (req: Request, res: Response) => {
  const result = await workspaceService.handleSlashCommand(req.user!.id, req.params.workspaceId, req.body);
  res.json({ success: true, data: result });
});

export default router;
