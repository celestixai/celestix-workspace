import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { setupPresenceHandlers } from './presence.socket';
import { setupMessengerHandlers } from './messenger.socket';
import { setupWorkspaceHandlers } from './workspace.socket';
import { setupMeetingsHandlers } from './meetings.socket';
import { setupNotificationsHandlers } from './notifications.socket';
import type { JwtPayload } from '../middleware/auth';

export let io: Server;

export function setupSocketIO(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      (socket as Socket & { userId: string }).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket & { userId?: string }) => {
    const userId = socket.userId;
    if (!userId) return;

    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Join personal room
    socket.join(`user:${userId}`);

    // Set up handlers
    setupPresenceHandlers(io, socket, userId);
    setupMessengerHandlers(io, socket, userId);
    setupWorkspaceHandlers(io, socket, userId);
    setupMeetingsHandlers(io, socket, userId);
    setupNotificationsHandlers(io, socket, userId);

    // Set user online
    await redis.set(`presence:${userId}`, 'ONLINE', 'EX', 300);
    io.emit('presence:update', { userId, status: 'ONLINE' });

    socket.on('disconnect', async () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');

      // Check if user has other connections
      const rooms = io.sockets.adapter.rooms.get(`user:${userId}`);
      if (!rooms || rooms.size === 0) {
        await redis.set(`presence:${userId}`, 'OFFLINE');
        io.emit('presence:update', { userId, status: 'OFFLINE' });

        // Update last seen in DB
        const { prisma } = await import('../config/database');
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'OFFLINE', lastSeenAt: new Date() },
        }).catch(() => {});
      }
    });
  });

  return io;
}
