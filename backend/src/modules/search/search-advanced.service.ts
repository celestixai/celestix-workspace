import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../utils/logger';
import { aiService } from '../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  preview?: string;
  module: string;
  timestamp: Date;
  link: string;
  relevanceScore: number;
  breadcrumb?: string;
}

interface AdvancedSearchParams {
  q: string;
  types?: string[];
  spaceId?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  priority?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  facets: {
    byType: Record<string, number>;
    bySpace: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HISTORY_KEY = (userId: string) => `search:history:${userId}`;
const SAVED_KEY = (userId: string) => `search:saved:${userId}`;
const MAX_HISTORY = 20;

function calculateRelevance(query: string, title: string, content?: string | null, tags?: string[]): number {
  const q = query.toLowerCase();
  const t = (title || '').toLowerCase();
  const c = (content || '').toLowerCase();

  if (t === q) return 10;
  if (t.startsWith(q)) return 9;
  if (t.includes(q)) return 8;
  if (tags?.some((tag) => tag.toLowerCase().includes(q))) return 3;
  if (c.includes(q)) return 5;
  return 1;
}

function shouldSearchType(types: string[] | undefined, type: string): boolean {
  return !types || types.length === 0 || types.includes(type);
}

function dateFilter(dateFrom?: string, dateTo?: string): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const f: { gte?: Date; lte?: Date } = {};
  if (dateFrom) f.gte = new Date(dateFrom);
  if (dateTo) f.lte = new Date(dateTo);
  return f;
}

// ---------------------------------------------------------------------------
// advancedSearch
// ---------------------------------------------------------------------------

export async function advancedSearch(
  workspaceId: string,
  userId: string,
  params: AdvancedSearchParams,
): Promise<SearchResponse> {
  const { q, types, spaceId, assigneeId, dateFrom, dateTo, status, priority, sortBy, page = 1, limit = 20 } = params;
  const results: SearchResultItem[] = [];
  const facets: SearchResponse['facets'] = { byType: {}, bySpace: {} };
  const searches: Promise<void>[] = [];
  const dtFilter = dateFilter(dateFrom, dateTo);

  // Store search in history (fire-and-forget)
  storeHistory(userId, q).catch(() => {});

  // --- Tasks ---
  if (shouldSearchType(types, 'tasks')) {
    searches.push(
      (async () => {
        const where: any = {
          project: { members: { some: { userId } } },
          title: { contains: q, mode: 'insensitive' },
          deletedAt: null,
        };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (assigneeId) where.assignees = { some: { userId: assigneeId } };
        if (dtFilter) where.updatedAt = dtFilter;

        const tasks = await prisma.task.findMany({
          where,
          include: { project: { select: { name: true } } },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        });
        tasks.forEach((t: any) => {
          const projName = t.project?.name || '';
          results.push({
            type: 'task',
            id: t.id,
            title: t.title,
            preview: `${projName} - ${t.status}`,
            module: 'tasks',
            timestamp: t.updatedAt,
            link: `/tasks/${t.projectId}/${t.id}`,
            relevanceScore: calculateRelevance(q, t.title, t.descriptionHtml),
            breadcrumb: projName,
          });
        });
      })(),
    );
  }

  // --- Documents ---
  if (shouldSearchType(types, 'docs') || shouldSearchType(types, 'documents')) {
    searches.push(
      prisma.document
        .findMany({
          where: {
            userId,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { contentHtml: { contains: q, mode: 'insensitive' } },
            ],
            ...(dtFilter ? { updatedAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        })
        .then((docs) =>
          docs.forEach((d) => {
            results.push({
              type: 'document',
              id: d.id,
              title: d.title,
              preview: `${d.wordCount} words`,
              module: 'documents',
              timestamp: d.updatedAt,
              link: `/documents/${d.id}`,
              relevanceScore: calculateRelevance(q, d.title, d.contentHtml),
              breadcrumb: 'Documents',
            });
          }),
        ),
    );
  }

  // --- Messages (workspace / WsMessage) ---
  if (shouldSearchType(types, 'messages')) {
    searches.push(
      prisma.wsMessage
        .findMany({
          where: {
            channel: { members: { some: { userId } } },
            content: { contains: q, mode: 'insensitive' },
            isDeleted: false,
            ...(dtFilter ? { createdAt: dtFilter } : {}),
          },
          include: {
            channel: { select: { id: true, name: true } },
            sender: { select: { displayName: true } },
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
        .then((msgs) =>
          msgs.forEach((m) => {
            results.push({
              type: 'message',
              id: m.id,
              title: `${m.sender.displayName} in #${m.channel.name}`,
              preview: m.content?.substring(0, 120),
              module: 'workspace',
              timestamp: m.createdAt,
              link: `/workspace/channel/${m.channelId}?msg=${m.id}`,
              relevanceScore: calculateRelevance(q, '', m.content),
              breadcrumb: `#${m.channel.name}`,
            });
          }),
        ),
    );
  }

  // --- Files ---
  if (shouldSearchType(types, 'files')) {
    searches.push(
      prisma.file
        .findMany({
          where: {
            userId,
            name: { contains: q, mode: 'insensitive' },
            isTrashed: false,
            ...(dtFilter ? { updatedAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        })
        .then((files) =>
          files.forEach((f) => {
            results.push({
              type: 'file',
              id: f.id,
              title: f.name,
              preview: `${f.type} - ${f.mimeType || 'folder'}`,
              module: 'files',
              timestamp: f.updatedAt,
              link: `/files/${f.id}`,
              relevanceScore: calculateRelevance(q, f.name),
              breadcrumb: 'Files',
            });
          }),
        ),
    );
  }

  // --- Contacts ---
  if (shouldSearchType(types, 'contacts')) {
    searches.push(
      prisma.contact
        .findMany({
          where: {
            userId,
            deletedAt: null,
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
            ],
            ...(dtFilter ? { updatedAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { displayName: 'asc' },
        })
        .then((contacts) =>
          contacts.forEach((c) => {
            results.push({
              type: 'contact',
              id: c.id,
              title: c.displayName,
              preview: c.company || undefined,
              module: 'contacts',
              timestamp: c.updatedAt,
              link: `/contacts/${c.id}`,
              relevanceScore: calculateRelevance(q, c.displayName, c.company),
              breadcrumb: 'Contacts',
            });
          }),
        ),
    );
  }

  // --- Notes ---
  if (shouldSearchType(types, 'notes')) {
    searches.push(
      prisma.note
        .findMany({
          where: {
            userId,
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { contentText: { contains: q, mode: 'insensitive' } },
            ],
            ...(dtFilter ? { updatedAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        })
        .then((notes) =>
          notes.forEach((n) => {
            results.push({
              type: 'note',
              id: n.id,
              title: n.title,
              preview: n.contentText?.substring(0, 120),
              module: 'notes',
              timestamp: n.updatedAt,
              link: `/notes/${n.id}`,
              relevanceScore: calculateRelevance(q, n.title, n.contentText),
              breadcrumb: 'Notes',
            });
          }),
        ),
    );
  }

  // --- Goals ---
  if (shouldSearchType(types, 'goals') && workspaceId) {
    searches.push(
      prisma.goal
        .findMany({
          where: {
            workspaceId,
            name: { contains: q, mode: 'insensitive' },
            ...(dtFilter ? { updatedAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        })
        .then((goals) =>
          goals.forEach((g) => {
            results.push({
              type: 'goal',
              id: g.id,
              title: g.name,
              preview: g.description?.substring(0, 120) || undefined,
              module: 'goals',
              timestamp: g.updatedAt,
              link: `/goals/${g.id}`,
              relevanceScore: calculateRelevance(q, g.name, g.description),
              breadcrumb: 'Goals',
            });
          }),
        ),
    );
  }

  // --- Posts (Social) ---
  if (shouldSearchType(types, 'posts')) {
    searches.push(
      prisma.socialPost
        .findMany({
          where: {
            community: { members: { some: { userId } } },
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { bodyHtml: { contains: q, mode: 'insensitive' } },
            ],
            ...(dtFilter ? { createdAt: dtFilter } : {}),
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { community: { select: { name: true } } },
        })
        .then((posts) =>
          posts.forEach((p) => {
            results.push({
              type: 'post',
              id: p.id,
              title: p.title || 'Post',
              preview: p.community.name,
              module: 'social',
              timestamp: p.createdAt,
              link: `/social/${p.communityId}`,
              relevanceScore: calculateRelevance(q, p.title || '', p.bodyHtml),
              breadcrumb: p.community.name,
            });
          }),
        ),
    );
  }

  await Promise.all(searches);

  // Build facets
  results.forEach((r) => {
    facets.byType[r.type] = (facets.byType[r.type] || 0) + 1;
  });

  // Sort
  if (sortBy === 'date') {
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } else if (sortBy === 'title') {
    results.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // relevance (default)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore || b.timestamp.getTime() - a.timestamp.getTime());
  }

  const total = results.length;
  const start = (page - 1) * limit;
  const paged = results.slice(start, start + limit);

  return { results: paged, total, facets };
}

// ---------------------------------------------------------------------------
// deepSearch
// ---------------------------------------------------------------------------

export async function deepSearch(
  workspaceId: string,
  userId: string,
  query: string,
): Promise<SearchResponse & { aiSummary?: string }> {
  // First, run broad DB search
  const base = await advancedSearch(workspaceId, userId, { q: query, limit: 50 });

  // Try AI-enhanced ranking
  try {
    const aiResult = await aiService.searchWorkspace(query, workspaceId);
    if (aiResult.success && aiResult.data) {
      // Merge AI-ranked results at the top
      const aiIds = new Set(aiResult.data.results.map((r: any) => r.id));
      const aiRanked = aiResult.data.results.map((r: any, idx: number) => {
        const existing = base.results.find((br) => br.id === r.id);
        if (existing) return { ...existing, relevanceScore: 100 - idx };
        return {
          type: r.type || 'item',
          id: r.id,
          title: r.title,
          preview: r.status || '',
          module: r.type || 'item',
          timestamp: new Date(),
          link: `/${r.type}s/${r.id}`,
          relevanceScore: 100 - idx,
          breadcrumb: '',
        } as SearchResultItem;
      });

      const remaining = base.results.filter((r) => !aiIds.has(r.id));
      const merged = [...aiRanked, ...remaining];

      return {
        results: merged.slice(0, 50),
        total: merged.length,
        facets: base.facets,
        aiSummary: `AI ranked ${aiRanked.length} top results for "${query}"`,
      };
    }
  } catch (err) {
    logger.warn({ err }, 'AI deep search ranking failed, falling back to DB results');
  }

  return base;
}

// ---------------------------------------------------------------------------
// Search history (Redis)
// ---------------------------------------------------------------------------

async function storeHistory(userId: string, query: string): Promise<void> {
  try {
    const key = HISTORY_KEY(userId);
    const raw = await redis.get(key);
    let history: { query: string; timestamp: string }[] = raw ? JSON.parse(raw) : [];
    // Remove duplicate
    history = history.filter((h) => h.query !== query);
    history.unshift({ query, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY);
    await redis.set(key, JSON.stringify(history), 'EX', 86400 * 30); // 30 days
  } catch {
    // non-critical
  }
}

export async function getSearchHistory(userId: string): Promise<{ query: string; timestamp: string }[]> {
  try {
    const raw = await redis.get(HISTORY_KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function deleteSearchHistory(userId: string): Promise<void> {
  try {
    await redis.del(HISTORY_KEY(userId));
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Saved searches (Redis)
// ---------------------------------------------------------------------------

export async function saveSearch(userId: string, name: string, query: Record<string, unknown>): Promise<{ id: string }> {
  const key = SAVED_KEY(userId);
  const raw = await redis.get(key);
  const saved: { id: string; name: string; query: Record<string, unknown>; createdAt: string }[] = raw ? JSON.parse(raw) : [];
  const id = uuidv4();
  saved.push({ id, name, query, createdAt: new Date().toISOString() });
  await redis.set(key, JSON.stringify(saved), 'EX', 86400 * 365); // 1 year
  return { id };
}

export async function getSavedSearches(
  userId: string,
): Promise<{ id: string; name: string; query: Record<string, unknown>; createdAt: string }[]> {
  try {
    const raw = await redis.get(SAVED_KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function deleteSavedSearch(userId: string, searchId: string): Promise<void> {
  try {
    const key = SAVED_KEY(userId);
    const raw = await redis.get(key);
    if (!raw) return;
    const saved = JSON.parse(raw) as any[];
    const filtered = saved.filter((s) => s.id !== searchId);
    await redis.set(key, JSON.stringify(filtered), 'EX', 86400 * 365);
  } catch {
    // non-critical
  }
}
