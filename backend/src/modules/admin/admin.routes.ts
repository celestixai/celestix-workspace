import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

// GET /api/v1/admin/stats
router.get('/stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const [totalUsers, activeUsers, totalMessages, totalEmails, totalFiles, totalTasks] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { status: { not: 'OFFLINE' }, deletedAt: null } }),
    prisma.message.count(),
    prisma.email.count(),
    prisma.file.count({ where: { type: 'FILE', isTrashed: false } }),
    prisma.task.count({ where: { deletedAt: null } }),
  ]);

  // Calculate total storage
  const storageResult = await prisma.user.aggregate({
    _sum: { storageUsed: true },
  });

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalMessages,
      totalEmails,
      totalFiles,
      totalTasks,
      totalStorageUsed: Number(storageResult._sum.storageUsed || 0),
    },
  });
});

// GET /api/v1/admin/users
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = req.query.search as string;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        isAdmin: true,
        storageUsed: true,
        storageQuota: true,
        createdAt: true,
        lastSeenAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users.map((u) => ({
      ...u,
      storageUsed: Number(u.storageUsed),
      storageQuota: Number(u.storageQuota),
    })),
    pagination: { total, page, limit, hasMore: page * limit < total },
  });
});

// PATCH /api/v1/admin/users/:userId
router.patch('/users/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { isAdmin, storageQuota } = req.body;
  const data: Record<string, unknown> = {};

  if (typeof isAdmin === 'boolean') {
    // Prevent last admin from demoting themselves
    if (!isAdmin && req.params.userId === req.user!.id) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true, deletedAt: null } });
      if (adminCount <= 1) {
        res.status(400).json({ success: false, error: 'Cannot remove the last admin', code: 'LAST_ADMIN' });
        return;
      }
    }
    data.isAdmin = isAdmin;
  }
  if (storageQuota) data.storageQuota = BigInt(storageQuota);

  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: data as never,
    select: { id: true, email: true, username: true, displayName: true, isAdmin: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SETTINGS_CHANGED',
      targetId: req.params.userId,
      details: data as Prisma.InputJsonValue,
    },
  });

  res.json({ success: true, data: user });
});

// POST /api/v1/admin/users/:userId/disable
router.post('/users/:userId/disable', authenticate, requireAdmin, async (req: Request, res: Response) => {
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'USER_DISABLED',
      targetId: req.params.userId,
    },
  });

  res.json({ success: true, data: { disabled: true } });
});

// POST /api/v1/admin/users/:userId/enable
router.post('/users/:userId/enable', authenticate, requireAdmin, async (req: Request, res: Response) => {
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { deletedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'USER_ENABLED',
      targetId: req.params.userId,
    },
  });

  res.json({ success: true, data: { enabled: true } });
});

// GET /api/v1/admin/audit-log
router.get('/audit-log', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: { total, page, limit, hasMore: page * limit < total },
  });
});

// GET /api/v1/admin/settings
router.get('/settings', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const settings = await prisma.systemSetting.findMany();
  const settingsMap: Record<string, string> = {};
  settings.forEach((s) => { settingsMap[s.key] = s.value; });
  res.json({ success: true, data: settingsMap });
});

// PUT /api/v1/admin/settings
router.put('/settings', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const entries = Object.entries(req.body) as Array<[string, string]>;
  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SETTINGS_CHANGED',
      details: req.body,
    },
  });

  res.json({ success: true, data: { updated: true } });
});

export default router;
