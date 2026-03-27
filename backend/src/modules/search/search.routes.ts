import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { cacheResponse } from '../../middleware/cache';

const router = Router();

// GET /api/v1/search?q=...&category=...
router.get('/', authenticate, cacheResponse(15, 'search'), async (req: Request, res: Response) => {
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

  // Forms
  if (!category || category === 'forms') {
    searches.push(
      prisma.form.findMany({
        where: {
          userId,
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((forms) =>
        forms.forEach((f) =>
          results.push({
            type: 'form',
            id: f.id,
            title: f.title,
            preview: f.description || undefined,
            module: 'forms',
            timestamp: f.updatedAt,
            link: `/forms/${f.id}`,
          })
        )
      )
    );
  }

  // Lists
  if (!category || category === 'lists') {
    searches.push(
      prisma.cxList.findMany({
        where: {
          userId,
          name: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((lists) =>
        lists.forEach((l) =>
          results.push({
            type: 'list',
            id: l.id,
            title: l.name,
            preview: l.description || undefined,
            module: 'lists',
            timestamp: l.updatedAt,
            link: `/lists/${l.id}`,
          })
        )
      )
    );
  }

  // Bookings
  if (!category || category === 'bookings') {
    searches.push(
      prisma.bookingPage.findMany({
        where: {
          userId,
          name: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((pages) =>
        pages.forEach((p) =>
          results.push({
            type: 'booking',
            id: p.id,
            title: p.name,
            preview: p.description || undefined,
            module: 'bookings',
            timestamp: p.updatedAt,
            link: `/bookings/${p.id}`,
          })
        )
      )
    );
  }

  // Videos (Stream)
  if (!category || category === 'videos') {
    searches.push(
      prisma.video.findMany({
        where: {
          userId,
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }).then((videos) =>
        videos.forEach((v) =>
          results.push({
            type: 'video',
            id: v.id,
            title: v.title,
            preview: v.description || undefined,
            module: 'stream',
            timestamp: v.createdAt,
            link: `/stream/${v.id}`,
          })
        )
      )
    );
  }

  // Whiteboards
  if (!category || category === 'whiteboards') {
    searches.push(
      prisma.whiteboard.findMany({
        where: {
          OR: [
            { userId },
            { collaborators: { some: { userId } } },
          ],
          name: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((boards) =>
        boards.forEach((b) =>
          results.push({
            type: 'whiteboard',
            id: b.id,
            title: b.name,
            module: 'whiteboard',
            timestamp: b.updatedAt,
            link: `/whiteboard/${b.id}`,
          })
        )
      )
    );
  }

  // Workflows
  if (!category || category === 'workflows') {
    searches.push(
      prisma.workflow.findMany({
        where: {
          userId,
          name: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((flows) =>
        flows.forEach((w) =>
          results.push({
            type: 'workflow',
            id: w.id,
            title: w.name,
            preview: w.description || undefined,
            module: 'workflows',
            timestamp: w.updatedAt,
            link: `/workflows/${w.id}`,
          })
        )
      )
    );
  }

  // Documents
  if (!category || category === 'documents') {
    searches.push(
      prisma.document.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((docs) =>
        docs.forEach((d) =>
          results.push({
            type: 'document', id: d.id, title: d.title,
            preview: `${d.wordCount} words`,
            module: 'documents', timestamp: d.updatedAt, link: `/documents/${d.id}`,
          })
        )
      )
    );
  }

  // Spreadsheets
  if (!category || category === 'spreadsheets') {
    searches.push(
      prisma.spreadsheet.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((sheets) =>
        sheets.forEach((s) =>
          results.push({
            type: 'spreadsheet', id: s.id, title: s.title,
            module: 'spreadsheets', timestamp: s.updatedAt, link: `/spreadsheets/${s.id}`,
          })
        )
      )
    );
  }

  // Presentations
  if (!category || category === 'presentations') {
    searches.push(
      prisma.presentation.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((pres) =>
        pres.forEach((p) =>
          results.push({
            type: 'presentation', id: p.id, title: p.title,
            preview: `${p.theme} theme`,
            module: 'presentations', timestamp: p.updatedAt, link: `/presentations/${p.id}`,
          })
        )
      )
    );
  }

  // Diagrams
  if (!category || category === 'diagrams') {
    searches.push(
      prisma.diagram.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((diags) =>
        diags.forEach((d) =>
          results.push({
            type: 'diagram', id: d.id, title: d.title,
            preview: d.type,
            module: 'diagrams', timestamp: d.updatedAt, link: `/diagrams/${d.id}`,
          })
        )
      )
    );
  }

  // To Do items
  if (!category || category === 'todo') {
    searches.push(
      prisma.todoItem.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { list: { select: { name: true } } },
      }).then((items) =>
        items.forEach((t) =>
          results.push({
            type: 'todo', id: t.id, title: t.title,
            preview: t.list.name,
            module: 'todo', timestamp: t.createdAt, link: `/todo/${t.listId}`,
          })
        )
      )
    );
  }

  // Designs
  if (!category || category === 'designs') {
    searches.push(
      prisma.design.findMany({
        where: { userId, title: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((designs) =>
        designs.forEach((d) =>
          results.push({
            type: 'design', id: d.id, title: d.title,
            module: 'designer', timestamp: d.updatedAt, link: `/designer/${d.id}`,
          })
        )
      )
    );
  }

  // Sites
  if (!category || category === 'sites') {
    searches.push(
      prisma.site.findMany({
        where: { createdBy: userId, name: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }).then((sites) =>
        sites.forEach((s) =>
          results.push({
            type: 'site', id: s.id, title: s.name,
            preview: s.description || undefined,
            module: 'sites', timestamp: s.updatedAt, link: `/sites/${s.id}`,
          })
        )
      )
    );
  }

  // Social posts
  if (!category || category === 'social') {
    searches.push(
      prisma.socialPost.findMany({
        where: {
          community: { members: { some: { userId } } },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { bodyHtml: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { community: { select: { name: true } } },
      }).then((posts) =>
        posts.forEach((p) =>
          results.push({
            type: 'social_post', id: p.id, title: p.title || 'Post',
            preview: p.community.name,
            module: 'social', timestamp: p.createdAt, link: `/social/${p.communityId}`,
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
