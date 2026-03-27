import { InboxItemType, InboxCategory, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// Smart categorization rules
const PRIMARY_TYPES: InboxItemType[] = [
  'TASK_ASSIGNED',
  'TASK_MENTIONED',
  'COMMENT_ASSIGNED',
  'DUE_DATE_REMINDER',
];

const OTHER_TYPES: InboxItemType[] = [
  'STATUS_CHANGED',
  'WATCHER_UPDATE',
  'COMMENT_MENTION',
];

function categorize(itemType: InboxItemType): InboxCategory {
  if (PRIMARY_TYPES.includes(itemType)) return 'PRIMARY';
  if (OTHER_TYPES.includes(itemType)) return 'OTHER';
  return 'PRIMARY'; // default for CUSTOM_REMINDER, FOLLOW_UP
}

export class InboxService {
  async getInboxItems(
    userId: string,
    category?: InboxCategory,
    limit = 50,
    cursor?: string,
  ) {
    const where: Prisma.InboxItemWhereInput = {
      userId,
      isActioned: false,
    };
    if (category) {
      if (category === 'LATER') {
        where.OR = [{ category: 'LATER' }, { isSnoozed: true }];
      } else {
        where.category = category;
        where.isSnoozed = false;
      }
    }

    const items = await prisma.inboxItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async getCounts(userId: string) {
    const [primary, other, later, saved, unread] = await Promise.all([
      prisma.inboxItem.count({ where: { userId, category: 'PRIMARY', isActioned: false, isSnoozed: false } }),
      prisma.inboxItem.count({ where: { userId, category: 'OTHER', isActioned: false, isSnoozed: false } }),
      prisma.inboxItem.count({ where: { userId, OR: [{ category: 'LATER' }, { isSnoozed: true }], isActioned: false } }),
      prisma.inboxItem.count({ where: { userId, isSaved: true, isActioned: false } }),
      prisma.inboxItem.count({ where: { userId, isRead: false, isActioned: false } }),
    ]);
    return { primary, other, later, saved, unread };
  }

  async markRead(itemId: string, userId: string) {
    return prisma.inboxItem.updateMany({
      where: { id: itemId, userId },
      data: { isRead: true },
    });
  }

  async markActioned(itemId: string, userId: string) {
    return prisma.inboxItem.updateMany({
      where: { id: itemId, userId },
      data: { isActioned: true, isRead: true },
    });
  }

  async snooze(itemId: string, userId: string, until: Date) {
    return prisma.inboxItem.updateMany({
      where: { id: itemId, userId },
      data: { isSnoozed: true, snoozeUntil: until, category: 'LATER' },
    });
  }

  async save(itemId: string, userId: string) {
    const item = await prisma.inboxItem.findFirst({ where: { id: itemId, userId } });
    if (!item) return null;
    return prisma.inboxItem.update({
      where: { id: itemId },
      data: { isSaved: !item.isSaved },
    });
  }

  async deleteItem(itemId: string, userId: string) {
    return prisma.inboxItem.deleteMany({
      where: { id: itemId, userId },
    });
  }

  async clearAllRead(userId: string) {
    return prisma.inboxItem.deleteMany({
      where: { userId, isRead: true, isActioned: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.inboxItem.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async createInboxItem(
    userId: string,
    data: {
      itemType: InboxItemType;
      title: string;
      preview?: string;
      sourceType?: string;
      sourceId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const category = categorize(data.itemType);
    return prisma.inboxItem.create({
      data: {
        userId,
        itemType: data.itemType,
        title: data.title,
        preview: data.preview,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        metadata: data.metadata,
        category,
      },
    });
  }

  // ==========================================
  // Event Hooks (called from other services)
  // ==========================================

  /** Hook: task was assigned to a user */
  async onTaskAssigned(assigneeId: string, taskId: string, taskTitle: string, assignedByName: string) {
    return this.createInboxItem(assigneeId, {
      itemType: 'TASK_ASSIGNED',
      title: `${assignedByName} assigned you to "${taskTitle}"`,
      preview: taskTitle,
      sourceType: 'task',
      sourceId: taskId,
    });
  }

  /** Hook: task status changed — notify watchers */
  async onTaskStatusChanged(watcherIds: string[], taskId: string, taskTitle: string, newStatus: string) {
    const items = watcherIds.map((userId) =>
      this.createInboxItem(userId, {
        itemType: 'STATUS_CHANGED',
        title: `"${taskTitle}" moved to ${newStatus}`,
        preview: `Status changed to ${newStatus}`,
        sourceType: 'task',
        sourceId: taskId,
      }),
    );
    return Promise.allSettled(items);
  }

  /** Hook: user was mentioned in a comment */
  async onCommentMention(mentionedUserId: string, taskId: string, taskTitle: string, authorName: string, commentPreview: string) {
    return this.createInboxItem(mentionedUserId, {
      itemType: 'COMMENT_MENTION',
      title: `${authorName} mentioned you in "${taskTitle}"`,
      preview: commentPreview.substring(0, 200),
      sourceType: 'task',
      sourceId: taskId,
    });
  }
}

export const inboxService = new InboxService();
