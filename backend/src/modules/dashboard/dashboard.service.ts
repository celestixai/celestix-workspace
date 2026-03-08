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

  // ==================================
  // CROSS-MODULE ACTIVITY FEED
  // ==================================

  async getActivityFeed(userId: string, limit: number) {
    type ActivityItem = { type: string; module: string; id: string; title: string; preview?: string; timestamp: Date; link: string };
    const items: ActivityItem[] = [];
    const now = new Date();

    const [recentMessages, recentEmails, recentTasks, recentNotes, recentFormResponses, recentAppointments, recentVideos] =
      await Promise.all([
        // Recent workspace messages the user sent
        prisma.wsMessage.findMany({
          where: { senderId: userId, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { channel: { select: { name: true } } },
        }),

        // Recent emails sent
        prisma.email.findMany({
          where: { userId, folder: 'SENT', deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, subject: true, toAddresses: true, createdAt: true },
        }),

        // Recently updated tasks
        prisma.task.findMany({
          where: { assignees: { some: { userId } }, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: { project: { select: { name: true } } },
        }),

        // Recently edited notes
        prisma.note.findMany({
          where: { userId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, title: true, updatedAt: true },
        }),

        // Recent form responses
        prisma.formResponse.findMany({
          where: { form: { userId } },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          include: { form: { select: { title: true } } },
        }),

        // Recent appointments
        prisma.appointment.findMany({
          where: {
            OR: [
              { bookingPage: { userId } },
              { bookerEmail: { not: '' } },
            ],
            startTime: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { startTime: 'desc' },
          take: 5,
          include: { bookingPage: { select: { title: true } } },
        }),

        // Recent video uploads
        prisma.video.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, title: true, createdAt: true },
        }),
      ]);

    for (const m of recentMessages) {
      items.push({ type: 'message', module: 'workspace', id: m.id, title: `Sent message in #${m.channel.name}`, preview: m.content?.substring(0, 80), timestamp: m.createdAt, link: `/workspace/channel/${m.channelId}` });
    }
    for (const e of recentEmails) {
      items.push({ type: 'email_sent', module: 'email', id: e.id, title: `Sent: ${e.subject}`, timestamp: e.createdAt, link: `/email/${e.id}` });
    }
    for (const t of recentTasks) {
      items.push({ type: 'task_update', module: 'tasks', id: t.id, title: `Task: ${t.title}`, preview: `${t.project.name} — ${t.status}`, timestamp: t.updatedAt, link: `/tasks/${t.projectId}/${t.id}` });
    }
    for (const n of recentNotes) {
      items.push({ type: 'note_edit', module: 'notes', id: n.id, title: `Edited: ${n.title}`, timestamp: n.updatedAt, link: `/notes/${n.id}` });
    }
    for (const r of recentFormResponses) {
      items.push({ type: 'form_response', module: 'forms', id: r.id, title: `New response on "${r.form.title}"`, timestamp: r.submittedAt, link: `/forms/${r.formId}` });
    }
    for (const a of recentAppointments) {
      items.push({ type: 'appointment', module: 'bookings', id: a.id, title: `Booking: ${a.bookingPage.title}`, preview: a.bookerName || undefined, timestamp: a.startTime, link: `/bookings/${a.bookingPageId}` });
    }
    for (const v of recentVideos) {
      items.push({ type: 'video_upload', module: 'stream', id: v.id, title: `Uploaded: ${v.title}`, timestamp: v.createdAt, link: `/stream/${v.id}` });
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, limit);
  }

  // ==================================
  // QUICK ACTIONS
  // ==================================

  async getQuickActions(_userId: string) {
    return [
      { id: 'new-message', label: 'New Message', module: 'messenger', icon: 'message-circle' },
      { id: 'new-email', label: 'Compose Email', module: 'email', icon: 'mail' },
      { id: 'new-task', label: 'Create Task', module: 'tasks', icon: 'check-square' },
      { id: 'new-note', label: 'New Note', module: 'notes', icon: 'file-text' },
      { id: 'new-event', label: 'New Event', module: 'calendar', icon: 'calendar' },
      { id: 'new-meeting', label: 'Start Meeting', module: 'meetings', icon: 'video' },
      { id: 'new-form', label: 'Create Form', module: 'forms', icon: 'clipboard-list' },
      { id: 'new-whiteboard', label: 'New Whiteboard', module: 'whiteboard', icon: 'pen-tool' },
      { id: 'upload-file', label: 'Upload File', module: 'files', icon: 'upload' },
      { id: 'new-workflow', label: 'Create Workflow', module: 'workflows', icon: 'workflow' },
    ];
  }

  // ==================================
  // CROSS-MODULE STATS
  // ==================================

  async getStats(userId: string) {
    const [
      unreadEmails,
      openTasks,
      upcomingEvents,
      unreadMessages,
      totalContacts,
      totalNotes,
      totalFiles,
      pendingAppointments,
      formResponses,
      activeWorkflows,
    ] = await Promise.all([
      prisma.email.count({ where: { userId, folder: 'INBOX', isRead: false, deletedAt: null } }),
      prisma.task.count({ where: { assignees: { some: { userId } }, status: { not: 'DONE' }, deletedAt: null } }),
      prisma.calendarEvent.count({ where: { calendar: { userId }, startAt: { gt: new Date() } } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.contact.count({ where: { userId, deletedAt: null } }),
      prisma.note.count({ where: { userId, deletedAt: null } }),
      prisma.file.count({ where: { userId, isTrashed: false } }),
      prisma.appointment.count({ where: { bookingPage: { userId }, status: 'PENDING' } }),
      prisma.formResponse.count({ where: { form: { userId } } }),
      prisma.workflow.count({ where: { userId, isActive: true } }),
    ]);

    return {
      unreadEmails,
      openTasks,
      upcomingEvents,
      unreadMessages,
      totalContacts,
      totalNotes,
      totalFiles,
      pendingAppointments,
      formResponses,
      activeWorkflows,
    };
  }
}
