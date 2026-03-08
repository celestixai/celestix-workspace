import { Router, Request, Response } from 'express';
import { messengerService } from './messenger.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { messageLimiter } from '../../middleware/rate-limit';
import { prisma } from '../../config/database';
import {
  createChatSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  updateChatSchema,
  addMembersSchema,
  messagesQuerySchema,
} from './messenger.schema';

const router = Router();

// GET /api/v1/messenger/chats
router.get('/chats', authenticate, async (req: Request, res: Response) => {
  const chats = await messengerService.getChats(req.user!.id);
  res.json({ success: true, data: chats });
});

// POST /api/v1/messenger/chats
router.post('/chats', authenticate, validate(createChatSchema), async (req: Request, res: Response) => {
  const chat = await messengerService.createChat(req.user!.id, req.body);
  res.status(201).json({ success: true, data: chat });
});

// GET /api/v1/messenger/chats/:chatId
router.get('/chats/:chatId', authenticate, async (req: Request, res: Response) => {
  const chat = await messengerService.getChat(req.user!.id, req.params.chatId);
  res.json({ success: true, data: chat });
});

// PATCH /api/v1/messenger/chats/:chatId
router.patch('/chats/:chatId', authenticate, validate(updateChatSchema), async (req: Request, res: Response) => {
  const chat = await messengerService.updateChat(req.user!.id, req.params.chatId, req.body);
  res.json({ success: true, data: chat });
});

// GET /api/v1/messenger/chats/:chatId/messages
router.get('/chats/:chatId/messages', authenticate, validate(messagesQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { cursor, limit, search } = req.query as { cursor?: string; limit?: string; search?: string };
  const result = await messengerService.getMessages(req.user!.id, req.params.chatId, cursor, Number(limit) || 50, search);
  res.json({ success: true, data: result.messages, pagination: { hasMore: result.hasMore, cursor: result.cursor } });
});

// POST /api/v1/messenger/chats/:chatId/messages
router.post('/chats/:chatId/messages', authenticate, messageLimiter, validate(sendMessageSchema), async (req: Request, res: Response) => {
  const message = await messengerService.sendMessage(req.user!.id, req.params.chatId, req.body);
  res.status(201).json({ success: true, data: message });
});

// PATCH /api/v1/messenger/messages/:messageId
router.patch('/messages/:messageId', authenticate, validate(editMessageSchema), async (req: Request, res: Response) => {
  const message = await messengerService.editMessage(req.user!.id, req.params.messageId, req.body);
  res.json({ success: true, data: message });
});

// DELETE /api/v1/messenger/messages/:messageId
router.delete('/messages/:messageId', authenticate, async (req: Request, res: Response) => {
  const forAll = req.query.forAll === 'true';
  await messengerService.deleteMessage(req.user!.id, req.params.messageId, forAll);
  res.json({ success: true, data: { message: 'Message deleted' } });
});

// POST /api/v1/messenger/messages/:messageId/reactions
router.post('/messages/:messageId/reactions', authenticate, validate(reactionSchema), async (req: Request, res: Response) => {
  const result = await messengerService.toggleReaction(req.user!.id, req.params.messageId, req.body.emoji);
  res.json({ success: true, data: result });
});

// POST /api/v1/messenger/messages/:messageId/pin
router.post('/messages/:messageId/pin', authenticate, async (req: Request, res: Response) => {
  const message = await messengerService.pinMessage(req.user!.id, req.params.messageId);
  res.json({ success: true, data: message });
});

// GET /api/v1/messenger/chats/:chatId/pinned
router.get('/chats/:chatId/pinned', authenticate, async (req: Request, res: Response) => {
  const messages = await messengerService.getPinnedMessages(req.params.chatId);
  res.json({ success: true, data: messages });
});

// POST /api/v1/messenger/chats/:chatId/read
router.post('/chats/:chatId/read', authenticate, async (req: Request, res: Response) => {
  const { messageId } = req.body;
  await messengerService.markAsRead(req.user!.id, req.params.chatId, messageId);
  res.json({ success: true, data: { read: true } });
});

// POST /api/v1/messenger/chats/:chatId/members
router.post('/chats/:chatId/members', authenticate, validate(addMembersSchema), async (req: Request, res: Response) => {
  const members = await messengerService.addMembers(req.user!.id, req.params.chatId, req.body.userIds);
  res.json({ success: true, data: members });
});

// DELETE /api/v1/messenger/chats/:chatId/members/:userId
router.delete('/chats/:chatId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await messengerService.removeMember(req.user!.id, req.params.chatId, req.params.userId);
  res.json({ success: true, data: { removed: true } });
});

// POST /api/v1/messenger/chats/:chatId/leave
router.post('/chats/:chatId/leave', authenticate, async (req: Request, res: Response) => {
  await messengerService.leaveChat(req.user!.id, req.params.chatId);
  res.json({ success: true, data: { left: true } });
});

// POST /api/v1/messenger/chats/:chatId/invite-link
router.post('/chats/:chatId/invite-link', authenticate, async (req: Request, res: Response) => {
  const link = await messengerService.generateInviteLink(req.user!.id, req.params.chatId);
  res.json({ success: true, data: { inviteLink: link } });
});

// POST /api/v1/messenger/join/:inviteLink
router.post('/join/:inviteLink', authenticate, async (req: Request, res: Response) => {
  const result = await messengerService.joinViaInvite(req.user!.id, req.params.inviteLink);
  res.json({ success: true, data: result });
});

// ─── Polls ──────────────────────────────────────────────────────────────────

router.post('/polls', authenticate, async (req, res, next) => {
  try {
    const { chatId, question, options, isMultiVote, isAnonymous, isQuiz, correctOption, closesAt } = req.body;
    const poll = await prisma.poll.create({
      data: {
        chatId, question, options, isMultiVote, isAnonymous, isQuiz, correctOption,
        closesAt: closesAt ? new Date(closesAt) : null,
        creatorId: req.user!.id,
      },
    });
    // Create a message referencing the poll
    const message = await prisma.message.create({
      data: {
        chatId, senderId: req.user!.id,
        content: `📊 Poll: ${question}`,
        metadata: { type: 'poll', pollId: poll.id },
      },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    await prisma.poll.update({ where: { id: poll.id }, data: { messageId: message.id } });
    res.json({ success: true, data: { poll, message } });
  } catch (err) { next(err); }
});

router.post('/polls/:pollId/vote', authenticate, async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const { optionIndex } = req.body;
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) return res.status(404).json({ success: false, error: 'Poll not found' });
    if (poll.isClosed) return res.status(400).json({ success: false, error: 'Poll is closed' });
    if (!poll.isMultiVote) {
      await prisma.pollVote.deleteMany({ where: { pollId, userId: req.user!.id } });
    }
    const vote = await prisma.pollVote.upsert({
      where: { pollId_userId_optionIndex: { pollId, userId: req.user!.id, optionIndex } },
      create: { pollId, userId: req.user!.id, optionIndex },
      update: {},
    });
    const votes = await prisma.pollVote.findMany({ where: { pollId } });
    res.json({ success: true, data: { vote, totalVotes: votes } });
  } catch (err) { next(err); }
});

router.get('/polls/:pollId', authenticate, async (req, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.pollId },
      include: { votes: true },
    });
    res.json({ success: true, data: poll });
  } catch (err) { next(err); }
});

router.post('/polls/:pollId/close', authenticate, async (req, res, next) => {
  try {
    const poll = await prisma.poll.update({
      where: { id: req.params.pollId, creatorId: req.user!.id },
      data: { isClosed: true },
    });
    res.json({ success: true, data: poll });
  } catch (err) { next(err); }
});

// ─── Saved Messages ─────────────────────────────────────────────────────────

router.get('/saved', authenticate, async (req, res, next) => {
  try {
    const saved = await prisma.savedMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: saved });
  } catch (err) { next(err); }
});

router.post('/saved', authenticate, async (req, res, next) => {
  try {
    const { messageId, contextType, note } = req.body;
    const saved = await prisma.savedMessage.upsert({
      where: { userId_messageId_contextType: { userId: req.user!.id, messageId, contextType } },
      create: { userId: req.user!.id, messageId, contextType, note },
      update: { note },
    });
    res.json({ success: true, data: saved });
  } catch (err) { next(err); }
});

router.delete('/saved/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.savedMessage.delete({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Scheduled Messages ─────────────────────────────────────────────────────

router.get('/scheduled', authenticate, async (req, res, next) => {
  try {
    const messages = await prisma.scheduledMessage.findMany({
      where: { userId: req.user!.id, sent: false },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

router.post('/scheduled', authenticate, async (req, res, next) => {
  try {
    const { chatId, channelId, content, contentHtml, scheduledAt } = req.body;
    const msg = await prisma.scheduledMessage.create({
      data: { userId: req.user!.id, chatId, channelId, content, contentHtml, scheduledAt: new Date(scheduledAt) },
    });
    res.json({ success: true, data: msg });
  } catch (err) { next(err); }
});

router.delete('/scheduled/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.scheduledMessage.delete({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Chat Folders ────────────────────────────────────────────────────────────

router.get('/folders', authenticate, async (req, res, next) => {
  try {
    const folders = await prisma.chatFolder.findMany({
      where: { userId: req.user!.id },
      orderBy: { position: 'asc' },
    });
    res.json({ success: true, data: folders });
  } catch (err) { next(err); }
});

router.post('/folders', authenticate, async (req, res, next) => {
  try {
    const { name, chatIds } = req.body;
    const folder = await prisma.chatFolder.create({
      data: { userId: req.user!.id, name, chatIds: chatIds || [] },
    });
    res.json({ success: true, data: folder });
  } catch (err) { next(err); }
});

router.patch('/folders/:id', authenticate, async (req, res, next) => {
  try {
    const folder = await prisma.chatFolder.update({
      where: { id: req.params.id, userId: req.user!.id },
      data: req.body,
    });
    res.json({ success: true, data: folder });
  } catch (err) { next(err); }
});

router.delete('/folders/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.chatFolder.delete({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
