import { Server, Socket } from 'socket.io';
import { redis } from '../config/redis';
import { prisma } from '../config/database';

export function setupPresenceHandlers(io: Server, socket: Socket, userId: string) {
  // Update status
  socket.on('presence:status', async (data: { status: string; customStatus?: string; customStatusEmoji?: string }) => {
    const { status, customStatus, customStatusEmoji } = data;

    await redis.set(`presence:${userId}`, status, 'EX', 300);
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: status as 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE' | 'INVISIBLE',
        customStatus,
        customStatusEmoji,
      },
    }).catch(() => {});

    if (status !== 'INVISIBLE') {
      io.emit('presence:update', { userId, status, customStatus, customStatusEmoji });
    }
  });

  // Heartbeat — keep presence alive
  socket.on('presence:heartbeat', async () => {
    const currentStatus = await redis.get(`presence:${userId}`);
    if (currentStatus) {
      await redis.set(`presence:${userId}`, currentStatus, 'EX', 300);
    }
  });

  // Get online users
  socket.on('presence:get-online', async (callback: (users: Array<{ userId: string; status: string }>) => void) => {
    const keys = await redis.keys('presence:*');
    const users: Array<{ userId: string; status: string }> = [];

    for (const key of keys) {
      const status = await redis.get(key);
      const uid = key.replace('presence:', '');
      if (status && status !== 'INVISIBLE') {
        users.push({ userId: uid, status });
      }
    }

    if (typeof callback === 'function') callback(users);
  });
}
