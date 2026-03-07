import 'dotenv/config';
import 'express-async-errors';

// Fix BigInt JSON serialization (Prisma returns BigInt for some aggregate fields)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { setupSocketIO } from './socket';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { globalLimiter } from './middleware/rate-limit';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import messengerRoutes from './modules/messenger/messenger.routes';
import workspaceRoutes from './modules/workspace/workspace.routes';
import emailRoutes from './modules/email/email.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import filesRoutes from './modules/files/files.routes';
import notesRoutes from './modules/notes/notes.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import meetingsRoutes from './modules/meetings/meetings.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import searchRoutes from './modules/search/search.routes';
import adminRoutes from './modules/admin/admin.routes';

const app = express();
const server = createServer(app);

// Setup Socket.IO
setupSocketIO(server);

// Ensure storage directories exist
const storagePath = path.resolve(config.storage.path);
fs.mkdirSync(path.join(storagePath, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'users'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'attachments'), { recursive: true });

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Electron app, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin) || config.cors.origins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(globalLimiter);

// Static file serving for uploads
app.use('/storage', express.static(storagePath));

// Request logging
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'Request');
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/messenger', messengerRoutes);
app.use('/api/v1/workspace', workspaceRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/meetings', meetingsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Test redis connection
    try {
      await redis.ping();
      logger.info('Redis connected');
    } catch {
      logger.warn('Redis not available — running without Redis');
    }

    server.listen(config.port, () => {
      logger.info(`Celestix Workspace backend running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  redis.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  redis.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

start();

export { app, server };
