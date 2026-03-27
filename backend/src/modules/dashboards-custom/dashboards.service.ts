import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateDashboardInput,
  UpdateDashboardInput,
  AddCardInput,
  UpdateCardInput,
  UpdateLayoutInput,
} from './dashboards.validation';
import type { DashboardCardType, SharePermission } from '@prisma/client';

const userSelect = { id: true, displayName: true, avatarUrl: true };

export class DashboardsCustomService {
  // ==========================================
  // DASHBOARD CRUD
  // ==========================================

  async getDashboards(workspaceId: string, userId: string) {
    return prisma.dashboardCustom.findMany({
      where: {
        workspaceId,
        OR: [
          { createdById: userId },
          { isPrivate: false },
          { shares: { some: { userId } } },
        ],
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { cards: true, shares: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDashboard(workspaceId: string, userId: string, data: CreateDashboardInput) {
    return prisma.dashboardCustom.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name,
        description: data.description,
        isPrivate: data.isPrivate ?? false,
      },
      include: {
        createdBy: { select: userSelect },
        cards: true,
        shares: true,
      },
    });
  }

  async getDashboard(dashboardId: string) {
    const dashboard = await prisma.dashboardCustom.findUnique({
      where: { id: dashboardId },
      include: {
        createdBy: { select: userSelect },
        cards: { orderBy: { createdAt: 'asc' } },
        shares: true,
      },
    });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }
    return dashboard;
  }

  async updateDashboard(dashboardId: string, data: UpdateDashboardInput) {
    const dashboard = await prisma.dashboardCustom.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }
    return prisma.dashboardCustom.update({
      where: { id: dashboardId },
      data: {
        name: data.name,
        description: data.description,
        isPrivate: data.isPrivate,
        isDefault: data.isDefault,
      },
      include: {
        createdBy: { select: userSelect },
        cards: true,
        shares: true,
      },
    });
  }

  async deleteDashboard(dashboardId: string) {
    const dashboard = await prisma.dashboardCustom.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }
    await prisma.dashboardCustom.delete({ where: { id: dashboardId } });
    return { success: true };
  }

  async duplicateDashboard(dashboardId: string, userId: string) {
    const source = await prisma.dashboardCustom.findUnique({
      where: { id: dashboardId },
      include: { cards: true },
    });
    if (!source) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }

    const duplicate = await prisma.dashboardCustom.create({
      data: {
        workspaceId: source.workspaceId,
        createdById: userId,
        name: `${source.name} (Copy)`,
        description: source.description,
        isPrivate: source.isPrivate,
        layout: source.layout ?? undefined,
        cards: {
          create: source.cards.map((card) => ({
            cardType: card.cardType,
            title: card.title,
            config: card.config ?? undefined,
            position: card.position ?? undefined,
          })),
        },
      },
      include: {
        createdBy: { select: userSelect },
        cards: true,
        shares: true,
      },
    });
    return duplicate;
  }

  // ==========================================
  // CARDS
  // ==========================================

  async addCard(dashboardId: string, data: AddCardInput) {
    const dashboard = await prisma.dashboardCustom.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }
    return prisma.dashboardCardCustom.create({
      data: {
        dashboardId,
        cardType: data.cardType as DashboardCardType,
        title: data.title,
        config: data.config ?? undefined,
        position: data.position ?? undefined,
      },
    });
  }

  async updateCard(cardId: string, data: UpdateCardInput) {
    const card = await prisma.dashboardCardCustom.findUnique({ where: { id: cardId } });
    if (!card) {
      throw new AppError(404, 'Card not found', 'NOT_FOUND');
    }
    return prisma.dashboardCardCustom.update({
      where: { id: cardId },
      data: {
        title: data.title,
        config: data.config !== undefined ? data.config : undefined,
        position: data.position !== undefined ? data.position : undefined,
      },
    });
  }

  async deleteCard(cardId: string) {
    const card = await prisma.dashboardCardCustom.findUnique({ where: { id: cardId } });
    if (!card) {
      throw new AppError(404, 'Card not found', 'NOT_FOUND');
    }
    await prisma.dashboardCardCustom.delete({ where: { id: cardId } });
    return { success: true };
  }

  async updateLayout(dashboardId: string, data: UpdateLayoutInput) {
    const dashboard = await prisma.dashboardCustom.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }

    const updates = data.cards.map((card) =>
      prisma.dashboardCardCustom.update({
        where: { id: card.id },
        data: { position: card.position },
      })
    );

    await prisma.$transaction(updates);

    return prisma.dashboardCardCustom.findMany({
      where: { dashboardId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==========================================
  // CARD DATA (Computed)
  // ==========================================

  async getCardData(cardId: string) {
    const card = await prisma.dashboardCardCustom.findUnique({
      where: { id: cardId },
      include: { dashboard: true },
    });
    if (!card) {
      throw new AppError(404, 'Card not found', 'NOT_FOUND');
    }

    const config = (card.config ?? {}) as Record<string, any>;
    const workspaceId = card.dashboard.workspaceId;

    switch (card.cardType) {
      case 'STATUS_CHART':
        return this.getStatusChartData(workspaceId, config);
      case 'PRIORITY_CHART':
        return this.getPriorityChartData(workspaceId, config);
      case 'ASSIGNEE_WORKLOAD':
        return this.getAssigneeWorkloadData(workspaceId, config);
      case 'TIME_TRACKING':
        return this.getTimeTrackingData(workspaceId, config);
      case 'DUE_DATE_OVERVIEW':
        return this.getDueDateOverviewData(workspaceId, config);
      case 'TASK_LIST':
        return this.getTaskListData(workspaceId, config);
      case 'GOAL_PROGRESS':
        return this.getGoalProgressData(workspaceId, config);
      case 'KPI_CARD':
        return this.getKpiCardData(workspaceId, config);
      case 'TEXT_BLOCK':
        return { content: config.content ?? '' };
      case 'EMBED':
        return { url: config.url ?? '' };
      case 'RECENT_ACTIVITY':
        return this.getRecentActivityData(workspaceId, config);
      case 'PIE_CHART':
      case 'LINE_CHART':
      case 'BAR_CHART':
        return this.getGenericChartData(workspaceId, config, card.cardType);
      default:
        return { message: 'Card type data not yet implemented' };
    }
  }

  // ---- Data helpers ----

  private async getStatusChartData(workspaceId: string, config: Record<string, any>) {
    const where: any = { list: { space: { workspaceId } } };
    if (config.listId) where.listId = config.listId;
    if (config.spaceId) where.list = { spaceId: config.spaceId };

    const groups = await prisma.task.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const statusColors: Record<string, string> = {
      BACKLOG: '#9CA3AF',
      TODO: '#3B82F6',
      IN_PROGRESS: '#F59E0B',
      REVIEW: '#8B5CF6',
      DONE: '#10B981',
    };

    return {
      labels: groups.map((g) => g.status),
      values: groups.map((g) => g._count.id),
      colors: groups.map((g) => statusColors[g.status] ?? '#6B7280'),
    };
  }

  private async getPriorityChartData(workspaceId: string, config: Record<string, any>) {
    const where: any = { list: { space: { workspaceId } } };
    if (config.listId) where.listId = config.listId;
    if (config.spaceId) where.list = { spaceId: config.spaceId };

    const groups = await prisma.task.groupBy({
      by: ['priority'],
      where,
      _count: { id: true },
    });

    const priorityColors: Record<string, string> = {
      URGENT: '#EF4444',
      HIGH: '#F97316',
      MEDIUM: '#F59E0B',
      LOW: '#3B82F6',
      NONE: '#9CA3AF',
    };

    return {
      labels: groups.map((g) => g.priority),
      values: groups.map((g) => g._count.id),
      colors: groups.map((g) => priorityColors[g.priority] ?? '#6B7280'),
    };
  }

  private async getAssigneeWorkloadData(workspaceId: string, config: Record<string, any>) {
    const where: any = { task: { list: { space: { workspaceId } } } };
    if (config.listId) where.task = { listId: config.listId };

    const assignees = await prisma.taskAssignee.findMany({
      where,
      include: { user: { select: userSelect } },
    });

    const countMap = new Map<string, { name: string; count: number }>();
    for (const a of assignees) {
      const existing = countMap.get(a.userId);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(a.userId, { name: a.user.displayName, count: 1 });
      }
    }

    return { users: Array.from(countMap.values()).sort((a, b) => b.count - a.count) };
  }

  private async getTimeTrackingData(workspaceId: string, config: Record<string, any>) {
    const where: any = { task: { list: { space: { workspaceId } } } };
    if (config.listId) where.task = { listId: config.listId };

    const entries = await prisma.timeEntry.findMany({
      where,
      include: { user: { select: userSelect } },
    });

    let totalMinutes = 0;
    const byUser = new Map<string, { name: string; minutes: number }>();

    for (const entry of entries) {
      const mins = entry.durationMinutes ?? 0;
      totalMinutes += mins;
      const existing = byUser.get(entry.userId);
      if (existing) {
        existing.minutes += mins;
      } else {
        byUser.set(entry.userId, { name: entry.user.displayName, minutes: mins });
      }
    }

    return { totalMinutes, byUser: Array.from(byUser.values()) };
  }

  private async getDueDateOverviewData(workspaceId: string, config: Record<string, any>) {
    const where: any = { list: { space: { workspaceId } }, status: { not: 'DONE' } };
    if (config.listId) where.listId = config.listId;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000);

    const [overdue, dueToday, dueThisWeek, noDueDate] = await Promise.all([
      prisma.task.count({ where: { ...where, dueDate: { lt: startOfDay } } }),
      prisma.task.count({ where: { ...where, dueDate: { gte: startOfDay, lt: endOfDay } } }),
      prisma.task.count({ where: { ...where, dueDate: { gte: endOfDay, lt: endOfWeek } } }),
      prisma.task.count({ where: { ...where, dueDate: null } }),
    ]);

    return { overdue, dueToday, dueThisWeek, noDueDate };
  }

  private async getTaskListData(workspaceId: string, config: Record<string, any>) {
    const where: any = { list: { space: { workspaceId } } };
    if (config.listId) where.listId = config.listId;
    if (config.status) where.status = config.status;
    if (config.priority) where.priority = config.priority;
    if (config.assigneeId) where.assignees = { some: { userId: config.assigneeId } };

    const tasks = await prisma.task.findMany({
      where,
      take: config.limit ?? 20,
      orderBy: { createdAt: 'desc' },
      include: {
        assignees: { include: { user: { select: userSelect } } },
      },
    });

    return { tasks };
  }

  private async getGoalProgressData(workspaceId: string, _config: Record<string, any>) {
    const goals = await prisma.goal.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        color: true,
        targets: {
          select: { currentValue: true, targetValue: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      goals: goals.map((g) => {
        const totalTarget = g.targets.reduce((s, t) => s + t.targetValue, 0);
        const totalCurrent = g.targets.reduce((s, t) => s + t.currentValue, 0);
        const progress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
        return { name: g.name, progress, color: g.color };
      }),
    };
  }

  private async getKpiCardData(workspaceId: string, config: Record<string, any>) {
    const metric = config.metric ?? 'total_tasks';
    const where: any = { list: { space: { workspaceId } } };
    if (config.listId) where.listId = config.listId;

    let value: number;
    let label: string;

    switch (metric) {
      case 'total_tasks':
        value = await prisma.task.count({ where });
        label = 'Total Tasks';
        break;
      case 'overdue_tasks': {
        const now = new Date();
        value = await prisma.task.count({
          where: { ...where, status: { not: 'DONE' }, dueDate: { lt: now } },
        });
        label = 'Overdue Tasks';
        break;
      }
      case 'completed_tasks':
        value = await prisma.task.count({ where: { ...where, status: 'DONE' } });
        label = 'Completed Tasks';
        break;
      case 'in_progress_tasks':
        value = await prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } });
        label = 'In Progress';
        break;
      default:
        value = 0;
        label = metric;
    }

    return { value, label };
  }

  private async getRecentActivityData(workspaceId: string, config: Record<string, any>) {
    const limit = config.limit ?? 20;

    const tasks = await prisma.task.findMany({
      where: { list: { space: { workspaceId } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdBy: { select: userSelect },
      },
    });

    return {
      activities: tasks.map((t) => ({
        type: 'task_update',
        taskId: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
        user: t.createdBy,
      })),
    };
  }

  private async getGenericChartData(
    workspaceId: string,
    config: Record<string, any>,
    chartType: string
  ) {
    // Default: group by status for generic chart types
    const groupBy = config.groupBy ?? 'status';
    const where: any = { list: { space: { workspaceId } } };
    if (config.listId) where.listId = config.listId;

    if (groupBy === 'priority') {
      return this.getPriorityChartData(workspaceId, config);
    }

    // Default to status grouping
    const data = await this.getStatusChartData(workspaceId, config);
    return { ...data, chartType };
  }

  // ==========================================
  // SHARING
  // ==========================================

  async shareDashboard(dashboardId: string, userId: string, permission: SharePermission = 'VIEW') {
    const dashboard = await prisma.dashboardCustom.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found', 'NOT_FOUND');
    }

    return prisma.dashboardShareCustom.create({
      data: {
        dashboardId,
        userId,
        permission,
      },
    });
  }

  async removeDashboardShare(shareId: string) {
    const share = await prisma.dashboardShareCustom.findUnique({ where: { id: shareId } });
    if (!share) {
      throw new AppError(404, 'Share not found', 'NOT_FOUND');
    }
    await prisma.dashboardShareCustom.delete({ where: { id: shareId } });
    return { success: true };
  }
}
