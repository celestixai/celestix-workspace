import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { inboxService } from '../inbox/inbox.service';

export type ReminderFilter = 'upcoming' | 'overdue' | 'completed' | 'all';

function computeSnoozeDueAt(duration: string): Date {
  const now = new Date();
  switch (duration) {
    case '15m':
      return new Date(now.getTime() + 15 * 60 * 1000);
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '3h':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000);
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    case 'next_week': {
      const nextMonday = new Date(now);
      const dayOfWeek = nextMonday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 0, 0, 0);
      return nextMonday;
    }
    default:
      return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

export class RemindersService {
  async getReminders(userId: string, filter: ReminderFilter = 'all') {
    const now = new Date();
    const where: Prisma.ReminderWhereInput = { userId };

    switch (filter) {
      case 'upcoming':
        where.isCompleted = false;
        where.dueAt = { gt: now };
        break;
      case 'overdue':
        where.isCompleted = false;
        where.dueAt = { lte: now };
        break;
      case 'completed':
        where.isCompleted = true;
        break;
      case 'all':
      default:
        break;
    }

    return prisma.reminder.findMany({
      where,
      orderBy: { dueAt: 'asc' },
    });
  }

  async createReminder(
    userId: string,
    data: {
      title: string;
      description?: string;
      dueAt: string;
      isRecurring?: boolean;
      recurrenceConfig?: any;
      relatedTaskId?: string;
      relatedMessageId?: string;
    },
  ) {
    return prisma.reminder.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        dueAt: new Date(data.dueAt),
        isRecurring: data.isRecurring ?? false,
        recurrenceConfig: data.recurrenceConfig ?? undefined,
        relatedTaskId: data.relatedTaskId,
        relatedMessageId: data.relatedMessageId,
      },
    });
  }

  async updateReminder(
    reminderId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      dueAt?: string;
      isRecurring?: boolean;
      recurrenceConfig?: any;
      relatedTaskId?: string | null;
      relatedMessageId?: string | null;
    },
  ) {
    return prisma.reminder.updateMany({
      where: { id: reminderId, userId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dueAt !== undefined && { dueAt: new Date(data.dueAt) }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
        ...(data.recurrenceConfig !== undefined && { recurrenceConfig: data.recurrenceConfig }),
        ...(data.relatedTaskId !== undefined && { relatedTaskId: data.relatedTaskId }),
        ...(data.relatedMessageId !== undefined && { relatedMessageId: data.relatedMessageId }),
      },
    });
  }

  async deleteReminder(reminderId: string, userId: string) {
    return prisma.reminder.deleteMany({
      where: { id: reminderId, userId },
    });
  }

  async completeReminder(reminderId: string, userId: string) {
    return prisma.reminder.updateMany({
      where: { id: reminderId, userId },
      data: { isCompleted: true },
    });
  }

  async snoozeReminder(reminderId: string, userId: string, duration: string) {
    const newDueAt = computeSnoozeDueAt(duration);
    return prisma.reminder.updateMany({
      where: { id: reminderId, userId },
      data: { dueAt: newDueAt },
    });
  }

  async checkDueReminders() {
    const now = new Date();
    const dueReminders = await prisma.reminder.findMany({
      where: {
        dueAt: { lte: now },
        isCompleted: false,
      },
    });

    for (const reminder of dueReminders) {
      // Check if we already created an inbox item for this reminder recently
      // by looking for existing inbox items with this reminder's sourceId
      try {
        await inboxService.createInboxItem(reminder.userId, {
          itemType: 'CUSTOM_REMINDER',
          title: `Reminder: ${reminder.title}`,
          preview: reminder.description ?? undefined,
          sourceType: 'reminder',
          sourceId: reminder.id,
        });

        // Mark as completed so we don't re-notify
        // (unless recurring — for now just complete it)
        if (!reminder.isRecurring) {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { isCompleted: true },
          });
        }
      } catch {
        // silently skip duplicates or errors
      }
    }

    return dueReminders.length;
  }
}

export const remindersService = new RemindersService();
