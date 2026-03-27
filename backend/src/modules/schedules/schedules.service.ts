import { prisma } from '../../config/database';

class SchedulesService {
  // ======================== WORK SCHEDULES ========================

  async getSchedules(workspaceId: string) {
    return prisma.workSchedule.findMany({
      where: { workspaceId },
      include: {
        userAssignments: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSchedule(workspaceId: string, data: {
    name: string;
    isDefault?: boolean;
    workDays: number[];
    workHoursPerDay?: number;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  }) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.workSchedule.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.workSchedule.create({
      data: {
        workspaceId,
        name: data.name,
        isDefault: data.isDefault || false,
        workDays: data.workDays,
        workHoursPerDay: data.workHoursPerDay ?? 8,
        startTime: data.startTime ?? '09:00',
        endTime: data.endTime ?? '17:00',
        timezone: data.timezone ?? 'UTC',
      },
    });
  }

  async updateSchedule(scheduleId: string, data: {
    name?: string;
    isDefault?: boolean;
    workDays?: number[];
    workHoursPerDay?: number;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  }) {
    const schedule = await prisma.workSchedule.findUniqueOrThrow({ where: { id: scheduleId } });

    if (data.isDefault) {
      await prisma.workSchedule.updateMany({
        where: { workspaceId: schedule.workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.workSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.workDays !== undefined ? { workDays: data.workDays } : {}),
        ...(data.workHoursPerDay !== undefined ? { workHoursPerDay: data.workHoursPerDay } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      },
    });
  }

  async deleteSchedule(scheduleId: string) {
    const assignedCount = await prisma.userWorkSchedule.count({
      where: { scheduleId },
    });
    if (assignedCount > 0) {
      throw new Error('Cannot delete schedule with assigned users. Remove assignments first.');
    }
    return prisma.workSchedule.delete({ where: { id: scheduleId } });
  }

  async assignUserSchedule(userId: string, scheduleId: string, effectiveFrom: string) {
    // Close any existing open assignment for this user in this schedule
    await prisma.userWorkSchedule.updateMany({
      where: { userId, effectiveTo: null },
      data: { effectiveTo: new Date(effectiveFrom) },
    });

    return prisma.userWorkSchedule.create({
      data: {
        userId,
        scheduleId,
        effectiveFrom: new Date(effectiveFrom),
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        schedule: true,
      },
    });
  }

  async getUserSchedule(userId: string) {
    const now = new Date();
    const assignment = await prisma.userWorkSchedule.findFirst({
      where: {
        userId,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    return assignment?.schedule || null;
  }

  async isWorkingDay(userId: string, date: Date): Promise<boolean> {
    const schedule = await this.getUserSchedule(userId);
    if (!schedule) return true; // default: assume working day
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon ... 6=Sat
    const workDays = schedule.workDays as number[];
    return workDays.includes(dayOfWeek);
  }

  async getWorkingHours(userId: string, date: Date): Promise<number> {
    const isWorking = await this.isWorkingDay(userId, date);
    if (!isWorking) return 0;

    // Check for time off
    const timeOff = await prisma.timeOff.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (timeOff) {
      if (timeOff.isHalfDay) {
        const schedule = await this.getUserSchedule(userId);
        return (schedule?.workHoursPerDay ?? 8) / 2;
      }
      return 0; // Full day off
    }

    const schedule = await this.getUserSchedule(userId);
    return schedule?.workHoursPerDay ?? 8;
  }

  // ======================== TIME OFF ========================

  async requestTimeOff(userId: string, data: {
    type: 'VACATION' | 'SICK' | 'PERSONAL' | 'HOLIDAY' | 'OTHER';
    startDate: string;
    endDate: string;
    isHalfDay?: boolean;
    note?: string;
  }) {
    return prisma.timeOff.create({
      data: {
        userId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isHalfDay: data.isHalfDay || false,
        note: data.note || null,
        status: 'APPROVED', // Auto-approve by default
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async getTimeOff(filters: { userId?: string; startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate) where.startDate = { gte: new Date(filters.startDate) };
    if (filters.endDate) where.endDate = { lte: new Date(filters.endDate) };

    return prisma.timeOff.findMany({
      where,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        approvedBy: { select: { id: true, displayName: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async approveTimeOff(timeOffId: string, approverId: string) {
    return prisma.timeOff.update({
      where: { id: timeOffId },
      data: { status: 'APPROVED', approvedById: approverId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async rejectTimeOff(timeOffId: string, approverId: string) {
    return prisma.timeOff.update({
      where: { id: timeOffId },
      data: { status: 'REJECTED', approvedById: approverId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async cancelTimeOff(timeOffId: string, userId: string) {
    const timeOff = await prisma.timeOff.findUniqueOrThrow({ where: { id: timeOffId } });
    if (timeOff.userId !== userId) {
      throw new Error('You can only cancel your own time off requests');
    }
    return prisma.timeOff.delete({ where: { id: timeOffId } });
  }

  async getTeamAvailability(workspaceId: string, date: Date) {
    // Get all workspace members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get time off for that day
    const timeOffRecords = await prisma.timeOff.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
        userId: { in: members.map((m) => m.userId) },
      },
    });

    const timeOffMap = new Map<string, { type: string; isHalfDay: boolean }>();
    for (const t of timeOffRecords) {
      timeOffMap.set(t.userId, { type: t.type, isHalfDay: t.isHalfDay });
    }

    const availability = await Promise.all(
      members.map(async (m) => {
        const schedule = await this.getUserSchedule(m.userId);
        const workDays = schedule ? (schedule.workDays as number[]) : [1, 2, 3, 4, 5];
        const isWorkDay = workDays.includes(date.getDay());
        const off = timeOffMap.get(m.userId);

        let status: 'available' | 'off' | 'half-day' | 'non-working';
        if (!isWorkDay) {
          status = 'non-working';
        } else if (off && !off.isHalfDay) {
          status = 'off';
        } else if (off && off.isHalfDay) {
          status = 'half-day';
        } else {
          status = 'available';
        }

        return {
          userId: m.userId,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          status,
          timeOffType: off?.type || null,
          schedule: schedule
            ? { startTime: schedule.startTime, endTime: schedule.endTime }
            : null,
        };
      })
    );

    return availability;
  }
}

export const schedulesService = new SchedulesService();
