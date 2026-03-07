import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';

export function setupWorkspaceHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('workspace:join-channel', (channelId: string) => {
    socket.join(`ws-channel:${channelId}`);
  });

  socket.on('workspace:leave-channel', (channelId: string) => {
    socket.leave(`ws-channel:${channelId}`);
  });

  socket.on('workspace:typing', async (data: { channelId: string; isTyping: boolean }) => {
    const key = `ws-typing:${data.channelId}:${userId}`;
    if (data.isTyping) {
      await redis.set(key, '1', 'EX', 3);
    } else {
      await redis.del(key);
    }
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:typing', {
      channelId: data.channelId,
      userId,
      isTyping: data.isTyping,
    });
  });

  socket.on('workspace:message', (data: { channelId: string; message: unknown }) => {
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:message', data);
  });

  socket.on('workspace:message-edit', (data: { channelId: string; messageId: string; content: string }) => {
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:message-edit', data);
  });

  socket.on('workspace:message-delete', (data: { channelId: string; messageId: string }) => {
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:message-delete', data);
  });

  socket.on('workspace:reaction', (data: { channelId: string; messageId: string; emoji: string; action: 'add' | 'remove' }) => {
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:reaction', { ...data, userId });
  });

  // Thread
  socket.on('workspace:join-thread', (threadId: string) => {
    socket.join(`ws-thread:${threadId}`);
  });

  socket.on('workspace:leave-thread', (threadId: string) => {
    socket.leave(`ws-thread:${threadId}`);
  });

  socket.on('workspace:thread-message', (data: { threadId: string; channelId: string; message: unknown }) => {
    socket.to(`ws-thread:${data.threadId}`).emit('workspace:thread-message', data);
    // Notify channel about thread reply
    socket.to(`ws-channel:${data.channelId}`).emit('workspace:thread-reply', {
      channelId: data.channelId,
      parentMessageId: data.threadId,
      message: data.message,
    });
  });
}
