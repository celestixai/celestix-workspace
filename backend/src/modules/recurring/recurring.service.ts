import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { Prisma, RecurrenceFrequency, ScheduleStatus } from '@prisma/client';
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from './recurring.validation';

/**
 * Calculate the next run date given a schedule's frequency, interval, and
 * anchor date.  The `from` parameter is the reference point (usually the
 * current nextRunAt or "now").
 */
export function calculateNextRunAt(
  frequency: RecurrenceFrequency,
  interval: number,
  from: Date,
  daysOfWeek?: number[] | null,
  dayOfMonth?: number | null,
): Date {
  const d = new Date(from);

  switch (frequency) {
    case 'DAILY': {
      d.setDate(d.getDate() + interval);
      return d;
    }

    case 'WEEKLY': {
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Find the next matching day-of-week after `from`
        const sorted = [...daysOfWeek].sort((a, b) => a - b);
        const currentDay = d.getDay();
        const next = sorted.find((day) => day > currentDay);
        if (next !== undefined) {
          d.setDate(d.getDate() + (next - currentDay));
        } else {
          // Wrap to the first day of next week cycle
          const daysUntilFirstDay = 7 - currentDay + sorted[0];
          d.setDate(d.getDate() + daysUntilFirstDay);
        }
        return d;
      }
      d.setDate(d.getDate() + 7 * interval);
      return d;
    }

    case 'BIWEEKLY': {
      d.setDate(d.getDate() + 14);
      return d;
    }

    case 'MONTHLY': {
      d.setMonth(d.getMonth() + interval);
      if (dayOfMonth) {
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dayOfMonth, maxDay));
      }
      return d;
    }

    case 'QUARTERLY': {
      d.setMonth(d.getMonth() + 3);
      if (dayOfMonth) {
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dayOfMonth, maxDay));
      }
      return d;
    }

    case 'YEARLY': {
      d.setFullYear(d.getFullYear() + interval);
      return d;
    }

    case 'CUSTOM':
    default: {
      // Custom falls back to daily * interval
      d.setDate(d.getDate() + interval);
      return d;
    }
  }
}

/**
 * Compute the next N upcoming dates for preview purposes.
 */
function previewDates(
  frequency: RecurrenceFrequency,
  interval: number,
  startFrom: Date,
  daysOfWeek?: number[] | null,
  dayOfMonth?: number | null,
  count = 5,
): Date[] {
  const dates: Date[] = [];
  let cursor = new Date(startFrom);
  for (let i = 0; i < count; i++) {
    cursor = calculateNextRunAt(frequency, interval, cursor, daysOfWeek, dayOfMonth);
    dates.push(new Date(cursor));
  }
  return dates;
}

// =====================
// Service methods
// =====================

export async function makeTaskRecurring(
  taskId: string,
  _userId: string,
  config: CreateRecurrenceInput,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
  });
  if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');

  // Check if already has a schedule
  const existing = await prisma.recurringSchedule.findUnique({ where: { taskId } });
  if (existing) throw new AppError(409, 'Task already has a recurring schedule', 'CONFLICT');

  const startDate = new Date(config.startDate);
  const nextRunAt = calculateNextRunAt(
    config.frequency as RecurrenceFrequency,
    config.interval ?? 1,
    startDate,
    config.daysOfWeek,
    config.dayOfMonth,
  );

  const schedule = await prisma.recurringSchedule.create({
    data: {
      taskId,
      frequency: config.frequency as RecurrenceFrequency,
      interval: config.interval ?? 1,
      daysOfWeek: config.daysOfWeek ?? undefined,
      dayOfMonth: config.dayOfMonth ?? undefined,
      monthOfYear: config.monthOfYear ?? undefined,
      startDate,
      endDate: config.endDate ? new Date(config.endDate) : undefined,
      maxOccurrences: config.maxOccurrences ?? undefined,
      nextRunAt,
      createBefore: config.createBefore ?? 0,
      timezone: config.timezone ?? 'UTC',
    },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      isRecurring: true,
      recurrenceConfig: config as any,
      recurringScheduleId: schedule.id,
    },
  });

  return schedule;
}

export async function getRecurrence(taskId: string) {
  const schedule = await prisma.recurringSchedule.findUnique({
    where: { taskId },
  });
  if (!schedule) throw new AppError(404, 'No recurring schedule for this task', 'NOT_FOUND');

  const upcoming = previewDates(
    schedule.frequency,
    schedule.interval,
    schedule.nextRunAt,
    schedule.daysOfWeek as number[] | null,
    schedule.dayOfMonth,
    5,
  );

  return { ...schedule, upcomingDates: upcoming.map((d) => d.toISOString()) };
}

export async function updateRecurrence(taskId: string, config: UpdateRecurrenceInput) {
  const schedule = await prisma.recurringSchedule.findUnique({ where: { taskId } });
  if (!schedule) throw new AppError(404, 'No recurring schedule for this task', 'NOT_FOUND');

  const frequency = (config.frequency as RecurrenceFrequency) ?? schedule.frequency;
  const interval = config.interval ?? schedule.interval;
  const daysOfWeek = config.daysOfWeek !== undefined ? config.daysOfWeek : (schedule.daysOfWeek as number[] | null);
  const dayOfMonth = config.dayOfMonth !== undefined ? config.dayOfMonth : schedule.dayOfMonth;

  const nextRunAt = calculateNextRunAt(frequency, interval, new Date(), daysOfWeek, dayOfMonth);

  const updated = await prisma.recurringSchedule.update({
    where: { taskId },
    data: {
      ...(config.frequency && { frequency: config.frequency as RecurrenceFrequency }),
      ...(config.interval !== undefined && { interval: config.interval }),
      ...(config.daysOfWeek !== undefined && { daysOfWeek: config.daysOfWeek }),
      ...(config.dayOfMonth !== undefined && { dayOfMonth: config.dayOfMonth }),
      ...(config.monthOfYear !== undefined && { monthOfYear: config.monthOfYear }),
      ...(config.startDate && { startDate: new Date(config.startDate) }),
      ...(config.endDate !== undefined && {
        endDate: config.endDate ? new Date(config.endDate) : null,
      }),
      ...(config.maxOccurrences !== undefined && { maxOccurrences: config.maxOccurrences }),
      ...(config.createBefore !== undefined && { createBefore: config.createBefore }),
      ...(config.timezone && { timezone: config.timezone }),
      nextRunAt,
    },
  });

  // Keep the task's recurrenceConfig in sync
  await prisma.task.update({
    where: { id: taskId },
    data: { recurrenceConfig: { ...((await prisma.task.findUnique({ where: { id: taskId }, select: { recurrenceConfig: true } }))?.recurrenceConfig as any ?? {}), ...config } },
  });

  return updated;
}

export async function deleteRecurrence(taskId: string) {
  const schedule = await prisma.recurringSchedule.findUnique({ where: { taskId } });
  if (!schedule) throw new AppError(404, 'No recurring schedule for this task', 'NOT_FOUND');

  await prisma.recurringSchedule.delete({ where: { taskId } });
  await prisma.task.update({
    where: { id: taskId },
    data: { isRecurring: false, recurrenceConfig: Prisma.DbNull, recurringScheduleId: null },
  });

  return { deleted: true };
}

export async function pauseRecurrence(taskId: string) {
  const schedule = await prisma.recurringSchedule.findUnique({ where: { taskId } });
  if (!schedule) throw new AppError(404, 'No recurring schedule for this task', 'NOT_FOUND');
  if (schedule.status !== 'ACTIVE') throw new AppError(400, 'Schedule is not active', 'BAD_REQUEST');

  return prisma.recurringSchedule.update({
    where: { taskId },
    data: { status: 'PAUSED' },
  });
}

export async function resumeRecurrence(taskId: string) {
  const schedule = await prisma.recurringSchedule.findUnique({ where: { taskId } });
  if (!schedule) throw new AppError(404, 'No recurring schedule for this task', 'NOT_FOUND');
  if (schedule.status !== 'PAUSED') throw new AppError(400, 'Schedule is not paused', 'BAD_REQUEST');

  const nextRunAt = calculateNextRunAt(
    schedule.frequency,
    schedule.interval,
    new Date(),
    schedule.daysOfWeek as number[] | null,
    schedule.dayOfMonth,
  );

  return prisma.recurringSchedule.update({
    where: { taskId },
    data: { status: 'ACTIVE', nextRunAt },
  });
}

export async function getUpcoming(userId: string, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const schedules = await prisma.recurringSchedule.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: { lte: cutoff },
      task: {
        deletedAt: null,
        createdById: userId,
      },
    },
    include: {
      task: { select: { id: true, title: true, projectId: true, listId: true } },
    },
    orderBy: { nextRunAt: 'asc' },
  });

  return schedules;
}

/**
 * Main scheduler function — finds all active schedules that are due and
 * creates new task instances from the template task.
 */
export async function processRecurringTasks() {
  const now = new Date();

  const dueSchedules = await prisma.recurringSchedule.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: { lte: now },
    },
    include: {
      task: {
        include: {
          assignees: true,
          labels: true,
        },
      },
    },
  });

  const results: { scheduleId: string; newTaskId: string | null; error?: string }[] = [];

  for (const schedule of dueSchedules) {
    try {
      const template = schedule.task;
      if (!template || template.deletedAt) {
        // Template task deleted; mark schedule as completed
        await prisma.recurringSchedule.update({
          where: { id: schedule.id },
          data: { status: 'COMPLETED' },
        });
        results.push({ scheduleId: schedule.id, newTaskId: null, error: 'Template task deleted' });
        continue;
      }

      // Calculate the due date for the new instance
      const instanceDueDate = new Date(schedule.nextRunAt);

      // Generate a custom task ID if applicable
      let customTaskId: string | null = null;
      if (template.listId) {
        const list = await prisma.taskList.findUnique({
          where: { id: template.listId },
          select: { spaceId: true },
        });
        if (list) {
          const space = await prisma.space.findUnique({
            where: { id: list.spaceId },
            select: { id: true, taskIdPrefix: true },
          });
          if (space?.taskIdPrefix) {
            const updated = await prisma.space.update({
              where: { id: space.id },
              data: { taskIdCounter: { increment: 1 } },
              select: { taskIdCounter: true, taskIdPrefix: true },
            });
            customTaskId = `${updated.taskIdPrefix}-${String(updated.taskIdCounter).padStart(3, '0')}`;
          }
        }
      }

      // Create the new task instance
      const newTask = await prisma.task.create({
        data: {
          projectId: template.projectId,
          title: template.title,
          descriptionHtml: template.descriptionHtml,
          status: 'TODO',
          priority: template.priority,
          dueDate: instanceDueDate,
          listId: template.listId,
          taskTypeId: template.taskTypeId,
          createdById: template.createdById,
          recurrenceParentId: template.id,
          customTaskId,
          statusName: template.statusName,
          statusColor: template.statusColor,
          assignees: template.assignees.length > 0
            ? { create: template.assignees.map((a) => ({ userId: a.userId })) }
            : undefined,
          labels: template.labels.length > 0
            ? { create: template.labels.map((l) => ({ labelId: l.labelId })) }
            : undefined,
        },
      });

      // Update schedule: nextRunAt, occurrenceCount, check limits
      const newOccurrenceCount = schedule.occurrenceCount + 1;
      const nextRunAt = calculateNextRunAt(
        schedule.frequency,
        schedule.interval,
        schedule.nextRunAt,
        schedule.daysOfWeek as number[] | null,
        schedule.dayOfMonth,
      );

      let newStatus: ScheduleStatus = 'ACTIVE';
      if (schedule.maxOccurrences && newOccurrenceCount >= schedule.maxOccurrences) {
        newStatus = 'COMPLETED';
      }
      if (schedule.endDate && nextRunAt > schedule.endDate) {
        newStatus = 'COMPLETED';
      }

      await prisma.recurringSchedule.update({
        where: { id: schedule.id },
        data: {
          occurrenceCount: newOccurrenceCount,
          nextRunAt,
          status: newStatus,
        },
      });

      results.push({ scheduleId: schedule.id, newTaskId: newTask.id });
    } catch (err: any) {
      results.push({ scheduleId: schedule.id, newTaskId: null, error: err.message });
    }
  }

  return { processed: results.length, results };
}
