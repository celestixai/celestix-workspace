import { Prisma } from '@prisma/client';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';

export class NotificationsService {
  async create(data: {
    userId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.notification.create({ data });
  }

  async getNotifications(userId: string, page = 1, limit = 50, unreadOnly = false) {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: { total, page, limit, hasMore: page * limit < total },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async clearAll(userId: string) {
    return prisma.notification.deleteMany({ where: { userId } });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }
}

export const notificationsService = new NotificationsService();
