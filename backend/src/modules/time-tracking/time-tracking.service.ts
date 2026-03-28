import { prisma } from '../../config/database';

interface ReportGroup {
  name: string;
  totalMinutes: number;
  billableMinutes: number;
  entries: any[];
}

interface ReportResult {
  groups: ReportGroup[];
  totalMinutes: number;
  totalBillable: number;
}

// Simple in-memory billable rates store (per workspace)
const billableRatesStore: Record<string, { defaultRate: number; userRates: Record<string, number> }> = {};

function getEntryBaseWhere(userId: string, startDate: string, endDate: string) {
  return {
    user: {
      id: userId ? undefined : undefined,
    },
    startedAt: { gte: new Date(startDate) },
    endedAt: { lte: new Date(endDate) },
    durationMinutes: { not: null },
  };
}

class TimeTrackingService {
  // ======================== REPORTS ========================

  async getReport(
    userId: string,
    startDate: string,
    endDate: string,
    groupBy: 'user' | 'task' | 'project' | 'tag'
  ): Promise<ReportResult> {
    const entries = await prisma.timeEntry.findMany({
      where: {
        startedAt: { gte: new Date(startDate) },
        endedAt: { lte: new Date(endDate) },
        durationMinutes: { not: null },
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const groupMap = new Map<string, ReportGroup>();

    for (const entry of entries) {
      let key: string;
      let name: string;

      switch (groupBy) {
        case 'user':
          key = entry.userId;
          name = entry.user.displayName || entry.user.username;
          break;
        case 'task':
          key = entry.taskId;
          name = entry.task.title;
          break;
        case 'project':
          key = entry.task.projectId;
          name = entry.task.project?.name || 'No Project';
          break;
        case 'tag':
          const tags = (entry.tags as string[]) || ['untagged'];
          // For tag grouping, an entry can appear in multiple groups
          for (const tag of tags) {
            const tKey = tag;
            if (!groupMap.has(tKey)) {
              groupMap.set(tKey, { name: tag, totalMinutes: 0, billableMinutes: 0, entries: [] });
            }
            const g = groupMap.get(tKey)!;
            g.totalMinutes += entry.durationMinutes || 0;
            if (entry.isBillable) g.billableMinutes += entry.durationMinutes || 0;
            g.entries.push(entry);
          }
          continue;
        default:
          key = entry.userId;
          name = entry.user.displayName || entry.user.username;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { name, totalMinutes: 0, billableMinutes: 0, entries: [] });
      }
      const group = groupMap.get(key)!;
      group.totalMinutes += entry.durationMinutes || 0;
      if (entry.isBillable) group.billableMinutes += entry.durationMinutes || 0;
      group.entries.push(entry);
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
    const totalMinutes = groups.reduce((s, g) => s + g.totalMinutes, 0);
    const totalBillable = groups.reduce((s, g) => s + g.billableMinutes, 0);

    return { groups, totalMinutes, totalBillable };
  }

  async getReportSummary(userId: string, startDate: string, endDate: string) {
    const entries = await prisma.timeEntry.findMany({
      where: {
        startedAt: { gte: new Date(startDate) },
        endedAt: { lte: new Date(endDate) },
        durationMinutes: { not: null },
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
      },
    });

    let totalTracked = 0;
    let totalBillable = 0;
    let totalNonBillable = 0;
    const byUserMap = new Map<string, { name: string; minutes: number }>();

    for (const entry of entries) {
      const mins = entry.durationMinutes || 0;
      totalTracked += mins;
      if (entry.isBillable) {
        totalBillable += mins;
      } else {
        totalNonBillable += mins;
      }

      const uid = entry.userId;
      if (!byUserMap.has(uid)) {
        byUserMap.set(uid, { name: entry.user.displayName || entry.user.username, minutes: 0 });
      }
      byUserMap.get(uid)!.minutes += mins;
    }

    return {
      totalTracked,
      totalBillable,
      totalNonBillable,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.minutes - a.minutes),
    };
  }

  async getDetailedReport(userId: string, startDate: string, endDate: string) {
    const entries = await prisma.timeEntry.findMany({
      where: {
        startedAt: { gte: new Date(startDate) },
        endedAt: { lte: new Date(endDate) },
        durationMinutes: { not: null },
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return entries.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      taskTitle: e.task.title,
      userId: e.userId,
      userName: e.user.displayName || e.user.username,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationMinutes: e.durationMinutes,
      isBillable: e.isBillable,
      note: e.note,
      tags: e.tags,
    }));
  }

  async exportReport(userId: string, startDate: string, endDate: string, _format: string): Promise<string> {
    const entries = await this.getDetailedReport(userId, startDate, endDate);
    const header = 'Task,User,Date,Duration (min),Billable,Note';
    const rows = entries.map((e) => {
      const date = e.startedAt ? new Date(e.startedAt).toISOString().split('T')[0] : '';
      const note = (e.note || '').replace(/"/g, '""');
      return `"${e.taskTitle}","${e.userName}","${date}",${e.durationMinutes || 0},${e.isBillable ? 'Yes' : 'No'},"${note}"`;
    });
    return [header, ...rows].join('\n');
  }

  // ======================== TIMESHEET ========================

  async getTimesheet(userId: string, weekStart: string) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        startedAt: { gte: start, lt: end },
        durationMinutes: { not: null },
      },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days = [];
    let weekTotal = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayEntries = entries
        .filter((e) => {
          const eDate = new Date(e.startedAt).toISOString().split('T')[0];
          return eDate === dateStr;
        })
        .map((e) => ({
          id: e.id,
          taskId: e.taskId,
          taskTitle: e.task.title,
          minutes: e.durationMinutes || 0,
          note: e.note,
          isBillable: e.isBillable,
        }));

      const totalMinutes = dayEntries.reduce((s, e) => s + e.minutes, 0);
      weekTotal += totalMinutes;

      days.push({
        date: dateStr,
        dayName: dayNames[i],
        entries: dayEntries,
        totalMinutes,
      });
    }

    return { days, weekTotal };
  }

  async addTimesheetEntry(
    userId: string,
    date: string,
    taskId: string,
    minutes: number,
    note?: string,
    isBillable?: boolean
  ) {
    const startedAt = new Date(date);
    startedAt.setHours(9, 0, 0, 0);
    const endedAt = new Date(startedAt.getTime() + minutes * 60 * 1000);

    return prisma.timeEntry.create({
      data: {
        userId,
        taskId,
        startedAt,
        endedAt,
        durationMinutes: minutes,
        note: note || null,
        isBillable: isBillable || false,
      },
      include: {
        task: { select: { id: true, title: true } },
      },
    });
  }

  async updateTimesheetEntry(entryId: string, minutes: number, note?: string) {
    const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
    const endedAt = new Date(existing.startedAt.getTime() + minutes * 60 * 1000);

    return prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        durationMinutes: minutes,
        endedAt,
        ...(note !== undefined ? { note } : {}),
      },
      include: {
        task: { select: { id: true, title: true } },
      },
    });
  }

  // ======================== BILLING ========================

  async getBillingReport(userId: string, startDate: string, endDate: string) {
    const entries = await prisma.timeEntry.findMany({
      where: {
        startedAt: { gte: new Date(startDate) },
        endedAt: { lte: new Date(endDate) },
        durationMinutes: { not: null },
        isBillable: true,
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const byUserMap = new Map<
      string,
      { name: string; hours: number; rate: number; amount: number }
    >();
    let totalBillable = 0;
    let totalAmount = 0;

    for (const entry of entries) {
      const hours = (entry.durationMinutes || 0) / 60;
      const rate = entry.billableRate || 0;
      const amount = entry.billableAmount || hours * rate;

      totalBillable += hours;
      totalAmount += amount;

      const uid = entry.userId;
      if (!byUserMap.has(uid)) {
        byUserMap.set(uid, {
          name: entry.user.displayName || entry.user.username,
          hours: 0,
          rate,
          amount: 0,
        });
      }
      const u = byUserMap.get(uid)!;
      u.hours += hours;
      u.amount += amount;
    }

    return {
      totalBillable,
      totalAmount,
      byUser: Array.from(byUserMap.values()),
      entries: entries.map((e) => ({
        id: e.id,
        taskTitle: e.task.title,
        userName: e.user.displayName || e.user.username,
        hours: (e.durationMinutes || 0) / 60,
        rate: e.billableRate || 0,
        amount: e.billableAmount || ((e.durationMinutes || 0) / 60) * (e.billableRate || 0),
      })),
    };
  }

  async setBillableRates(
    workspaceId: string,
    defaultRate: number,
    userRates?: Array<{ userId: string; rate: number }>
  ) {
    const rates: Record<string, number> = {};
    if (userRates) {
      for (const ur of userRates) {
        rates[ur.userId] = ur.rate;
      }
    }
    billableRatesStore[workspaceId || 'default'] = { defaultRate, userRates: rates };
    return billableRatesStore[workspaceId || 'default'];
  }

  getBillableRates(workspaceId: string) {
    return billableRatesStore[workspaceId || 'default'] || { defaultRate: 0, userRates: {} };
  }
}

export const timeTrackingService = new TimeTrackingService();
