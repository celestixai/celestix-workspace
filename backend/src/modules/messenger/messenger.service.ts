import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateChatInput, SendMessageInput, EditMessageInput } from './messenger.schema';

export class MessengerService {
  async createChat(userId: string, input: CreateChatInput) {
    if (input.type === 'DIRECT') {
      if (input.memberIds.length !== 1) {
        throw new AppError(400, 'Direct chats require exactly one other member', 'INVALID_INPUT');
      }
      // Check if DM already exists between these users
      const existingChat = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: input.memberIds[0] } } },
          ],
        },
        include: {
          members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } },
        },
      });
      if (existingChat) return existingChat;
    }

    // For channels, generate an invite link automatically
    const inviteLink = input.type === 'CHANNEL'
      ? `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`
      : undefined;

    const chat = await prisma.chat.create({
      data: {
        type: input.type,
        name: input.name,
        description: input.description,
        inviteLink,
        members: {
          create: [
            { userId, role: input.type === 'DIRECT' ? 'MEMBER' : 'OWNER' },
            ...input.memberIds
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, status: true } } } },
      },
    });

    return chat;
  }

  async getChats(userId: string) {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true, status: true, lastSeenAt: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
            sender: { select: { displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add unread count for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const membership = chat.members.find((m) => m.userId === userId);
        let unreadCount = 0;
        if (membership?.lastReadMessageId) {
          const lastReadMessage = await prisma.message.findUnique({
            where: { id: membership.lastReadMessageId },
            select: { createdAt: true },
          });
          if (lastReadMessage) {
            unreadCount = await prisma.message.count({
              where: {
                chatId: chat.id,
                createdAt: { gt: lastReadMessage.createdAt },
                senderId: { not: userId },
                isDeleted: false,
              },
            });
          }
        } else {
          unreadCount = await prisma.message.count({
            where: {
              chatId: chat.id,
              senderId: { not: userId },
              isDeleted: false,
            },
          });
        }
        return { ...chat, unreadCount };
      })
    );

    return chatsWithUnread;
  }

  async getChat(userId: string, chatId: string) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true, status: true, lastSeenAt: true, email: true },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new AppError(404, 'Chat not found', 'NOT_FOUND');
    }

    return chat;
  }

  async getMessages(userId: string, chatId: string, cursor?: string, limit = 50, search?: string) {
    // Verify membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this chat', 'FORBIDDEN');
    }

    const where: Record<string, unknown> = {
      chatId,
      isDeleted: false,
    };

    if (cursor) {
      const cursorMsg = await prisma.message.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (cursorMsg) {
        where.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, displayName: true } },
          },
        },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        readReceipts: {
          select: { userId: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    return {
      messages: messages.reverse(),
      hasMore,
      cursor: messages.length > 0 ? messages[0].id : undefined,
    };
  }

  async sendMessage(userId: string, chatId: string, input: SendMessageInput) {
    // Verify membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this chat', 'FORBIDDEN');
    }

    if (!input.content && !input.attachments?.length) {
      throw new AppError(400, 'Message must have content or attachments', 'INVALID_INPUT');
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: input.content,
        contentHtml: input.contentHtml,
        replyToId: input.replyToId,
        forwardedFromId: input.forwardedFromId,
        attachments: input.attachments as unknown as undefined,
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, displayName: true } },
          },
        },
        reactions: true,
      },
    });

    // Update chat's updatedAt
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

    // Mark as read for sender
    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadMessageId: message.id },
    });

    return message;
  }

  async editMessage(userId: string, messageId: string, input: EditMessageInput) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');
    if (message.senderId !== userId) throw new AppError(403, 'Cannot edit others\' messages', 'FORBIDDEN');

    const hoursSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 48) {
      throw new AppError(400, 'Can only edit messages within 48 hours', 'EDIT_EXPIRED');
    }

    // Store version history
    if (message.content) {
      await prisma.messageVersion.create({
        data: { messageId, content: message.content },
      });
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { content: input.content, contentHtml: input.contentHtml, isEdited: true },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async deleteMessage(userId: string, messageId: string, forAll: boolean) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { members: true } } },
    });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    const membership = message.chat.members.find((m) => m.userId === userId);
    const isOwnerOrAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

    if (message.senderId !== userId && !isOwnerOrAdmin) {
      throw new AppError(403, 'Cannot delete this message', 'FORBIDDEN');
    }

    if (forAll) {
      const hoursSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 48 && !isOwnerOrAdmin) {
        throw new AppError(400, 'Can only delete for all within 48 hours', 'DELETE_EXPIRED');
      }
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedForAll: forAll, content: null, contentHtml: null, attachments: Prisma.JsonNull },
    });
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return { action: 'removed' as const, emoji };
    }

    // Check max 3 reactions per user per message
    const count = await prisma.messageReaction.count({ where: { messageId, userId } });
    if (count >= 3) {
      throw new AppError(400, 'Maximum 3 reactions per message', 'MAX_REACTIONS');
    }

    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    return { action: 'added' as const, emoji };
  }

  async pinMessage(userId: string, messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { members: true } } },
    });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    const membership = message.chat.members.find((m) => m.userId === userId);
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Only admins can pin messages', 'FORBIDDEN');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
    });
  }

  async getPinnedMessages(chatId: string) {
    return prisma.message.findMany({
      where: { chatId, isPinned: true, isDeleted: false },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, chatId: string, messageId: string) {
    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadMessageId: messageId },
    });

    await prisma.messageReadReceipt.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: { readAt: new Date() },
    });
  }

  async updateChat(userId: string, chatId: string, data: { name?: string; description?: string }) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } },
    });
    if (!chat) throw new AppError(403, 'Not authorized to update this chat', 'FORBIDDEN');

    return prisma.chat.update({ where: { id: chatId }, data });
  }

  async addMembers(userId: string, chatId: string, userIds: string[]) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, type: { in: ['GROUP', 'CHANNEL'] }, members: { some: { userId } } },
    });
    if (!chat) throw new AppError(404, 'Chat not found', 'NOT_FOUND');

    const newMembers = await Promise.all(
      userIds.map((uid) =>
        prisma.chatMember.upsert({
          where: { chatId_userId: { chatId, userId: uid } },
          create: { chatId, userId: uid, role: 'MEMBER' },
          update: {},
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        })
      )
    );

    return newMembers;
  }

  async removeMember(userId: string, chatId: string, targetUserId: string) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } },
    });
    if (!chat) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId: targetUserId } },
    });
  }

  async leaveChat(userId: string, chatId: string) {
    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId } },
    });
  }

  async generateInviteLink(userId: string, chatId: string) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } },
    });
    if (!chat) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    const inviteLink = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    await prisma.chat.update({ where: { id: chatId }, data: { inviteLink } });
    return inviteLink;
  }

  async joinViaInvite(userId: string, inviteLink: string) {
    const chat = await prisma.chat.findUnique({ where: { inviteLink } });
    if (!chat) throw new AppError(404, 'Invalid invite link', 'NOT_FOUND');

    return prisma.chatMember.upsert({
      where: { chatId_userId: { chatId: chat.id, userId } },
      create: { chatId: chat.id, userId, role: 'MEMBER' },
      update: {},
    });
  }
}

export const messengerService = new MessengerService();
