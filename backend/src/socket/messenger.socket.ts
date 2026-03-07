import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';

export function setupMessengerHandlers(io: Server, socket: Socket, userId: string) {
  // Join chat rooms
  socket.on('messenger:join', (chatId: string) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on('messenger:leave', (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  // Typing indicator
  socket.on('messenger:typing', async (data: { chatId: string; isTyping: boolean }) => {
    const key = `typing:${data.chatId}:${userId}`;
    if (data.isTyping) {
      await redis.set(key, '1', 'EX', 3);
    } else {
      await redis.del(key);
    }
    socket.to(`chat:${data.chatId}`).emit('messenger:typing', {
      chatId: data.chatId,
      userId,
      isTyping: data.isTyping,
    });
  });

  // New message — broadcast to chat room
  socket.on('messenger:message', (data: { chatId: string; message: unknown }) => {
    socket.to(`chat:${data.chatId}`).emit('messenger:message', data);
  });

  // Message edited
  socket.on('messenger:message-edit', (data: { chatId: string; messageId: string; content: string; contentHtml?: string }) => {
    socket.to(`chat:${data.chatId}`).emit('messenger:message-edit', data);
  });

  // Message deleted
  socket.on('messenger:message-delete', (data: { chatId: string; messageId: string }) => {
    socket.to(`chat:${data.chatId}`).emit('messenger:message-delete', data);
  });

  // Reaction
  socket.on('messenger:reaction', (data: { chatId: string; messageId: string; emoji: string; action: 'add' | 'remove' }) => {
    socket.to(`chat:${data.chatId}`).emit('messenger:reaction', { ...data, userId });
  });

  // Read receipt
  socket.on('messenger:read', (data: { chatId: string; messageId: string }) => {
    socket.to(`chat:${data.chatId}`).emit('messenger:read', { ...data, userId });
  });
}
