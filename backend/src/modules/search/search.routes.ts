import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/v1/search?q=...&category=...
router.get('/', authenticate, async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  const category = req.query.category as string;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!query || query.length < 2) {
    res.json({ success: true, data: { results: [] } });
    return;
  }

  const userId = req.user!.id;
  const searchTerm = `%${query}%`;
  const results: Array<{ type: string; id: string; title: string; preview?: string; module: string; timestamp: Date; link: string }> = [];

  const searches = [];

  // Messages
  if (!category || category === 'messages') {
    searches.push(
      prisma.message.findMany({
        where: {
          chat: { members: { some: { userId } } },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        include: {
          chat: { select: { id: true, name: true, type: true } },
          sender: { select: { displayName: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }).then((msgs) =>
        msgs.forEach((m) =>
          results.push({
            type: 'message',
            id: m.id,
            title: `${m.sender.displayName} in ${m.chat.name || 'Direct Message'}`,
            preview: m.content?.substring(0, 100),
            module: 'messenger',
            timestamp: m.createdAt,
            link: `/messenger/${m.chatId}?msg=${m.id}`,
          })
        )
      )
    );
  }

  // Workspace messages
  if (!category || category === 'workspace') {
    searches.push(
      prisma.wsMessage.findMany({
        where: {
          channel: { members: { some: { userId } } },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        include: {
          channel: { select: { id: true, name: true } },
          sender: { select: { displayName: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }).then((msgs) =>
        msgs.forEach((m) =>
          results.push({
            type: 'workspace_message',
            id: m.id,
            title: `${m.sender.displayName} in #${m.channel.name}`,
            preview: m.content?.substring(0, 100),
            module: 'workspace',
            timestamp: m.createdAt,
            link: `/workspace/channel/${m.channelId}?msg=${m.id}`,
          })
        )
      )
    );
  }

  // Emails
  if (!category || category === 'emails') {
    searches.push(
      prisma.email.findMany({
        where: {
          userId,
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { bodyText: { contains: query, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }).then((emails) =>
        emails.forEach((e) =>
          results.push({
            type: 'email',
            id: e.id,
            title: e.subject,
            preview: e.bodyText?.substring(0, 100),
            module: 'email',
            timestamp: e.createdAt,
            link: `/email/${e.id}`,
          })
        )
      )
    );
  }

  // Files
  if (!category || category === 'files') {
    searches.push(
      prisma.file.findMany({
        where: {
          userId,
          name: { contains: query, mode: 'insensitive' },
          isTrashed: false,
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((files) =>
        files.forEach((f) =>
          results.push({
            type: 'file',
            id: f.id,
            title: f.name,
            preview: `${f.type} - ${f.mimeType || 'folder'}`,
            module: 'files',
            timestamp: f.updatedAt,
            link: `/files/${f.id}`,
          })
        )
      )
    );
  }

  // Contacts
  if (!category || category === 'contacts') {
    searches.push(
      prisma.contact.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { company: { contains: query, mode: 'insensitive' } },
            { emails: { some: { email: { contains: query, mode: 'insensitive' } } } },
          ],
        },
        take: limit,
        orderBy: { displayName: 'asc' },
      }).then((contacts) =>
        contacts.forEach((c) =>
          results.push({
            type: 'contact',
            id: c.id,
            title: c.displayName,
            preview: c.company || undefined,
            module: 'contacts',
            timestamp: c.updatedAt,
            link: `/contacts/${c.id}`,
          })
        )
      )
    );
  }

  // Tasks
  if (!category || category === 'tasks') {
    searches.push(
      prisma.task.findMany({
        where: {
          project: { members: { some: { userId } } },
          title: { contains: query, mode: 'insensitive' },
          deletedAt: null,
        },
        include: { project: { select: { name: true } } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((tasks) =>
        tasks.forEach((t) =>
          results.push({
            type: 'task',
            id: t.id,
            title: t.title,
            preview: `${t.project.name} - ${t.status}`,
            module: 'tasks',
            timestamp: t.updatedAt,
            link: `/tasks/${t.projectId}/${t.id}`,
          })
        )
      )
    );
  }

  // Notes
  if (!category || category === 'notes') {
    searches.push(
      prisma.note.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { contentText: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((notes) =>
        notes.forEach((n) =>
          results.push({
            type: 'note',
            id: n.id,
            title: n.title,
            preview: n.contentText?.substring(0, 100),
            module: 'notes',
            timestamp: n.updatedAt,
            link: `/notes/${n.id}`,
          })
        )
      )
    );
  }

  // Calendar events
  if (!category || category === 'calendar') {
    searches.push(
      prisma.calendarEvent.findMany({
        where: {
          calendar: { userId },
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { startAt: 'desc' },
      }).then((events) =>
        events.forEach((e) =>
          results.push({
            type: 'event',
            id: e.id,
            title: e.title,
            preview: e.location || undefined,
            module: 'calendar',
            timestamp: e.startAt,
            link: `/calendar?event=${e.id}`,
          })
        )
      )
    );
  }

  await Promise.all(searches);

  // Sort by timestamp (most recent first)
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  res.json({ success: true, data: { results: results.slice(0, limit * 2) } });
});

export default router;
