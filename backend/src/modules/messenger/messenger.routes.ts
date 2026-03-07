import { Router, Request, Response } from 'express';
import { messengerService } from './messenger.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { messageLimiter } from '../../middleware/rate-limit';
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

export default router;
