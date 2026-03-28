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
import searchAdvancedRoutes from './modules/search/search-advanced.routes';
import adminRoutes from './modules/admin/admin.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import formsRoutes from './modules/forms/forms.routes';
import listsRoutes from './modules/lists/lists.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import loopRoutes from './modules/loop/loop.routes';
import whiteboardRoutes from './modules/whiteboard/whiteboard.routes';
import streamRoutes from './modules/stream/stream.routes';
import workflowsRoutes from './modules/workflows/workflows.routes';
import documentsRoutes from './modules/documents/documents.routes';
import docsEnhancedRoutes from './modules/docs-enhanced/docs-enhanced.routes';
import spreadsheetsRoutes from './modules/spreadsheets/spreadsheets.routes';
import presentationsRoutes from './modules/presentations/presentations.routes';
import pdfRoutes from './modules/pdf/pdf.routes';
import diagramsRoutes from './modules/diagrams/diagrams.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import todoRoutes from './modules/todo/todo.routes';
import videoEditorRoutes from './modules/video-editor/video-editor.routes';
import designerRoutes from './modules/designer/designer.routes';
import sitesRoutes from './modules/sites/sites.routes';
import socialRoutes from './modules/social/social.routes';
import spacesRoutes from './modules/spaces/spaces.routes';
import foldersRoutes from './modules/folders/folders.routes';
import taskListsRoutes from './modules/task-lists/task-lists.routes';
import sharingRoutes from './modules/sharing/sharing.routes';
import customFieldsRoutes from './modules/custom-fields/custom-fields.routes';
import taskTypesRoutes from './modules/task-types/task-types.routes';
import recurringRoutes from './modules/recurring/recurring.routes';
import templatesRoutes from './modules/templates/templates.routes';
import tagsRoutes from './modules/tags/tags.routes';
import viewsRoutes from './modules/views/views.routes';
import automationsRoutes from './modules/automations/automations.routes';
import goalsRoutes from './modules/goals/goals.routes';
import dashboardsCustomRoutes from './modules/dashboards-custom/dashboards.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import remindersRoutes from './modules/reminders/reminders.routes';
import clipsRoutes from './modules/clips/clips.routes';
import sprintsEnhancedRoutes from './modules/sprints-enhanced/sprints.routes';
import timeTrackingRoutes from './modules/time-tracking/time-tracking.routes';
import schedulesRoutes from './modules/schedules/schedules.routes';
import aiRoutes from './modules/ai/ai.routes';
import integrationsRoutes from './modules/integrations/integrations.routes';
import teamsRoutes from './modules/teams/teams.routes';
import profilesRoutes from './modules/profiles/profiles.routes';
import { startRecurringScheduler, stopRecurringScheduler } from './modules/recurring/recurring.scheduler';
import { remindersService } from './modules/reminders/reminders.service';
import { sprintsEnhancedService } from './modules/sprints-enhanced/sprints.service';
import { initStorage, isSupabaseConfigured, getSignedUrl } from './config/supabase-storage';

const app = express();
const server = createServer(app);

// Setup Socket.IO
setupSocketIO(server);

// Ensure storage directories exist
const storagePath = path.resolve(config.storage.path);
fs.mkdirSync(path.join(storagePath, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'users'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'attachments'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'videos'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'clips'), { recursive: true });

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

// Static file serving for uploads — redirect to Supabase signed URLs in production
if (isSupabaseConfigured()) {
  app.use('/storage', async (req, res, next) => {
    try {
      // Strip leading slash to get the Supabase path
      const storagePath = req.path.replace(/^\//, '');
      if (!storagePath) return next();
      const signedUrl = await getSignedUrl(storagePath, 3600);
      res.redirect(signedUrl);
    } catch {
      // Fall through to static serving if Supabase fails
      next();
    }
  });
}

// Static file serving for uploads (local fallback)
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
app.use('/api/v1/search', searchAdvancedRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/forms', formsRoutes);
app.use('/api/v1/lists', listsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/loop', loopRoutes);
app.use('/api/v1/whiteboard', whiteboardRoutes);
app.use('/api/v1/stream', streamRoutes);
app.use('/api/v1/workflows', workflowsRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/docs', docsEnhancedRoutes);
app.use('/api/v1/spreadsheets', spreadsheetsRoutes);
app.use('/api/v1/presentations', presentationsRoutes);
app.use('/api/v1/pdf', pdfRoutes);
app.use('/api/v1/diagrams', diagramsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/todo', todoRoutes);
app.use('/api/v1/video-editor', videoEditorRoutes);
app.use('/api/v1/designer', designerRoutes);
app.use('/api/v1/sites', sitesRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/spaces', spacesRoutes);
app.use('/api/v1/folders', foldersRoutes);
app.use('/api/v1/task-lists', taskListsRoutes);
app.use('/api/v1/sharing', sharingRoutes);
app.use('/api/v1/custom-fields', customFieldsRoutes);
app.use('/api/v1/task-types', taskTypesRoutes);
app.use('/api/v1/recurring', recurringRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/tags', tagsRoutes);
app.use('/api/v1/views', viewsRoutes);
app.use('/api/v1/automations', automationsRoutes);
app.use('/api/v1/goals', goalsRoutes);
app.use('/api/v1/dashboards-custom', dashboardsCustomRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/reminders', remindersRoutes);
app.use('/api/v1/clips', clipsRoutes);
app.use('/api/v1/sprints', sprintsEnhancedRoutes);
app.use('/api/v1/time-tracking', timeTrackingRoutes);
app.use('/api/v1/schedules', schedulesRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/profiles', profilesRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // 1. Start listening FIRST so Railway health checks pass immediately
    server.listen(config.port, () => {
      logger.info(`Celestix Workspace backend running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });

    // 2. Initialize Supabase Storage bucket (non-blocking)
    initStorage().catch((err) =>
      logger.warn(`Supabase storage init issue: ${err.message} — falling back to local disk`),
    );

    // 3. Test database connection (with timeout) — non-blocking
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB connect timeout')), 15000))
    ]).then(() => logger.info('Database connected'))
      .catch((err) => logger.warn(`Database connection issue: ${err.message} — will retry on first query`));

    // 4. Connect redis (with timeout — lazyConnect mode) — non-blocking
    try {
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
      ]);
      logger.info('Redis connected');
    } catch {
      logger.warn('Redis not available — running without Redis');
    }

    // 5. Start schedulers (skip in test)
    if (config.env !== 'test') {
      startRecurringScheduler(60);

      // Start reminders scheduler — check every 60 seconds
      remindersService.checkDueReminders().catch((err) =>
        logger.error({ err }, 'Reminders check error on startup'),
      );
      setInterval(() => {
        remindersService.checkDueReminders().catch((err) =>
          logger.error({ err }, 'Reminders check error'),
        );
      }, 60 * 1000);

      // Sprint daily snapshot — run at midnight, check every 15 minutes
      const runSprintSnapshots = () => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() < 15) {
          sprintsEnhancedService.recordAllActiveSnapshots().catch((err) =>
            logger.error({ err }, 'Sprint snapshot error'),
          );
        }
      };
      setInterval(runSprintSnapshots, 15 * 60 * 1000);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopRecurringScheduler();
  await prisma.$disconnect();
  redis.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopRecurringScheduler();
  await prisma.$disconnect();
  redis.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

start();

export { app, server };
