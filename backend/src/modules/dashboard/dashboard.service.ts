import { prisma } from '../../config/database';
import type { UpdateLayoutInput } from './dashboard.schema';

const DEFAULT_WIDGETS = [
  { type: 'upcoming-events', position: { x: 0, y: 0 }, size: { w: 6, h: 4 } },
  { type: 'my-tasks', position: { x: 6, y: 0 }, size: { w: 6, h: 4 } },
  { type: 'unread-emails', position: { x: 0, y: 4 }, size: { w: 4, h: 3 } },
  { type: 'recent-notes', position: { x: 4, y: 4 }, size: { w: 4, h: 3 } },
  { type: 'recent-activity', position: { x: 8, y: 4 }, size: { w: 4, h: 3 } },
];

export class DashboardService {
  // ==================================
  // LAYOUT
  // ==================================

  async getLayout(userId: string) {
    const layout = await prisma.dashboardLayout.findUnique({
      where: { userId },
    });

    if (!layout) {
      return { userId, widgets: DEFAULT_WIDGETS };
    }

    return layout;
  }

  async updateLayout(userId: string, widgets: UpdateLayoutInput['widgets']) {
    const layout = await prisma.dashboardLayout.upsert({
      where: { userId },
      create: {
        userId,
        widgets: JSON.parse(JSON.stringify(widgets)),
      },
      update: {
        widgets: JSON.parse(JSON.stringify(widgets)),
      },
    });

    return layout;
  }

  // ==================================
  // AGGREGATED DASHBOARD DATA
  // ==================================

  async getDashboardData(userId: string) {
    const now = new Date();

    const [upcomingEvents, myTasks, unreadEmailData, recentNotes, recentActivity] =
      await Promise.all([
        // Next 5 calendar events
        prisma.calendarEvent.findMany({
          where: {
            calendar: { userId },
            startAt: { gt: now },
          },
          orderBy: { startAt: 'asc' },
          take: 5,
          include: {
            calendar: { select: { id: true, name: true, color: true } },
            attendees: {
              include: {
                user: {
                  select: { id: true, displayName: true, avatarUrl: true, email: true },
                },
              },
            },
          },
        }),

        // Tasks assigned to user (not DONE), ordered by dueDate, limit 10
        prisma.task.findMany({
          where: {
            deletedAt: null,
            status: { not: 'DONE' },
            assignees: { some: { userId } },
          },
          orderBy: { dueDate: 'asc' },
          take: 10,
          include: {
            project: { select: { id: true, name: true, color: true } },
            assignees: {
              include: {
                user: {
                  select: { id: true, displayName: true, avatarUrl: true, email: true },
                },
              },
            },
            labels: { include: { label: true } },
          },
        }),

        // Unread emails: count + top 3
        Promise.all([
          prisma.email.count({
            where: { userId, folder: 'INBOX', isRead: false, deletedAt: null },
          }),
          prisma.email.findMany({
            where: { userId, folder: 'INBOX', isRead: false, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              fromAddress: true,
              fromName: true,
              subject: true,
              createdAt: true,
            },
          }),
        ]),

        // Last 3 edited notes
        prisma.note.findMany({
          where: { userId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            isPinned: true,
            isStarred: true,
            folderId: true,
            updatedAt: true,
          },
        }),

        // Last 10 notifications
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            sender: {
              select: { id: true, displayName: true, avatarUrl: true, email: true },
            },
          },
        }),
      ]);

    return {
      upcomingEvents,
      myTasks,
      unreadEmails: {
        count: unreadEmailData[0],
        emails: unreadEmailData[1],
      },
      recentNotes,
      recentActivity,
    };
  }
}
