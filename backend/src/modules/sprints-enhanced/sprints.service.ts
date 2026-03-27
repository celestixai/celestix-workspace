import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateFolderInput,
  UpdateFolderInput,
  CreateSprintInput,
  UpdateSprintInput,
  CompleteSprintInput,
} from './sprints.validation';

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  storyPoints: true,
  statusName: true,
  statusColor: true,
  dueDate: true,
  assignees: {
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  },
};

class SprintsEnhancedService {
  // ==========================================
  // SPRINT FOLDERS
  // ==========================================

  async getSprintFolders(spaceId: string) {
    return prisma.sprintFolder.findMany({
      where: { spaceId },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { sprints: true } },
      },
    });
  }

  async createSprintFolder(spaceId: string, data: CreateFolderInput) {
    return prisma.sprintFolder.create({
      data: {
        spaceId,
        name: data.name,
        description: data.description,
        defaultDuration: data.defaultDuration,
      },
      include: {
        _count: { select: { sprints: true } },
      },
    });
  }

  async updateSprintFolder(folderId: string, data: UpdateFolderInput) {
    const folder = await prisma.sprintFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'Sprint folder not found', 'NOT_FOUND');
    }

    return prisma.sprintFolder.update({
      where: { id: folderId },
      data: {
        name: data.name,
        description: data.description,
        defaultDuration: data.defaultDuration,
        isActive: data.isActive,
        position: data.position,
      },
      include: {
        _count: { select: { sprints: true } },
      },
    });
  }

  async deleteSprintFolder(folderId: string) {
    const folder = await prisma.sprintFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'Sprint folder not found', 'NOT_FOUND');
    }

    // Clear sprintId on tasks belonging to sprints in this folder
    const sprintIds = await prisma.sprintEnhanced.findMany({
      where: { sprintFolderId: folderId },
      select: { id: true },
    });
    if (sprintIds.length > 0) {
      await prisma.task.updateMany({
        where: { sprintId: { in: sprintIds.map((s) => s.id) } },
        data: { sprintId: null },
      });
    }

    // Cascade deletes sprints + history points
    await prisma.sprintFolder.delete({ where: { id: folderId } });
  }

  // ==========================================
  // SPRINTS
  // ==========================================

  async getSprints(folderId: string) {
    return prisma.sprintEnhanced.findMany({
      where: { sprintFolderId: folderId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { tasks: true } },
      },
    });
  }

  async createSprint(folderId: string, data: CreateSprintInput) {
    const folder = await prisma.sprintFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'Sprint folder not found', 'NOT_FOUND');
    }

    return prisma.sprintEnhanced.create({
      data: {
        sprintFolderId: folderId,
        name: data.name,
        goal: data.goal,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        listId: data.listId,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });
  }

  async getSprint(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({
      where: { id: sprintId },
      include: {
        folder: { select: { id: true, name: true, spaceId: true } },
        _count: { select: { tasks: true } },
      },
    });

    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    // Get task stats
    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { status: true, storyPoints: true, statusName: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const task of tasks) {
      const key = task.statusName || task.status;
      statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
    }

    return {
      ...sprint,
      totalTasks,
      completedTasks,
      totalPoints,
      completedPoints,
      statusBreakdown,
    };
  }

  async updateSprint(sprintId: string, data: UpdateSprintInput) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    return prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: {
        name: data.name,
        goal: data.goal,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        listId: data.listId,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });
  }

  async startSprint(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }
    if (sprint.status !== 'PLANNING') {
      throw new AppError(400, 'Only PLANNING sprints can be started', 'INVALID_STATE');
    }

    // Check no other active sprint in the same folder
    const activeExists = await prisma.sprintEnhanced.findFirst({
      where: { sprintFolderId: sprint.sprintFolderId, status: 'ACTIVE' },
    });
    if (activeExists) {
      throw new AppError(400, 'Another sprint is already active in this folder', 'CONFLICT');
    }

    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { status: true, storyPoints: true },
    });

    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    const updated = await prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: {
        status: 'ACTIVE',
        totalPoints,
        completedPoints,
      },
      include: { _count: { select: { tasks: true } } },
    });

    // Record initial history point
    await prisma.sprintHistoryPoint.create({
      data: {
        sprintId,
        date: new Date(),
        remainingPoints: totalPoints - completedPoints,
        completedPoints,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'DONE').length,
      },
    });

    return updated;
  }

  async completeSprint(sprintId: string, data?: CompleteSprintInput) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }
    if (sprint.status !== 'ACTIVE') {
      throw new AppError(400, 'Only ACTIVE sprints can be completed', 'INVALID_STATE');
    }

    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { id: true, status: true, storyPoints: true },
    });

    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    // Calculate velocity (completed points)
    const velocity = completedPoints;

    const updated = await prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: {
        status: 'COMPLETE',
        completedPoints,
        totalPoints,
        velocity,
      },
      include: { _count: { select: { tasks: true } } },
    });

    // Move incomplete tasks to next sprint if specified
    if (data?.moveIncompleteToSprintId) {
      const incompleteTasks = tasks.filter((t) => t.status !== 'DONE');
      if (incompleteTasks.length > 0) {
        await prisma.task.updateMany({
          where: { id: { in: incompleteTasks.map((t) => t.id) } },
          data: { sprintId: data.moveIncompleteToSprintId },
        });

        // Update the next sprint's totalPoints
        const nextTasks = await prisma.task.findMany({
          where: { sprintId: data.moveIncompleteToSprintId, deletedAt: null },
          select: { storyPoints: true },
        });
        const nextTotal = nextTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
        await prisma.sprintEnhanced.update({
          where: { id: data.moveIncompleteToSprintId },
          data: { totalPoints: nextTotal },
        });
      }
    }

    // Record final history point
    await prisma.sprintHistoryPoint.create({
      data: {
        sprintId,
        date: new Date(),
        remainingPoints: totalPoints - completedPoints,
        completedPoints,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'DONE').length,
      },
    });

    return updated;
  }

  // ==========================================
  // SPRINT TASKS
  // ==========================================

  async addTasksToSprint(sprintId: string, taskIds: string[]) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { sprintId },
    });

    // Recalculate totalPoints
    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { storyPoints: true, status: true },
    });

    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    await prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: { totalPoints, completedPoints },
    });

    return { added: taskIds.length, totalPoints, completedPoints };
  }

  async removeTaskFromSprint(sprintId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, sprintId },
    });
    if (!task) {
      throw new AppError(404, 'Task not found in sprint', 'NOT_FOUND');
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { sprintId: null },
    });

    // Recalculate
    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { storyPoints: true, status: true },
    });

    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    await prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: { totalPoints, completedPoints },
    });

    return { removed: true };
  }

  async getSprintTasks(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    return prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: taskSelect,
      orderBy: { position: 'asc' },
    });
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  async getBurndownData(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    const points = await prisma.sprintHistoryPoint.findMany({
      where: { sprintId },
      orderBy: { date: 'asc' },
    });

    // Calculate ideal burndown line
    const startDate = sprint.startDate.getTime();
    const endDate = sprint.endDate.getTime();
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const initialPoints = points.length > 0 ? points[0].remainingPoints + points[0].completedPoints : sprint.totalPoints;

    const idealLine: Array<{ date: string; points: number }> = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate + i * 24 * 60 * 60 * 1000);
      idealLine.push({
        date: date.toISOString().split('T')[0],
        points: Math.max(0, initialPoints - (initialPoints / totalDays) * i),
      });
    }

    const actualLine = points.map((p) => ({
      date: p.date.toISOString().split('T')[0],
      points: p.remainingPoints,
    }));

    return { idealLine, actualLine, totalPoints: initialPoints };
  }

  async getBurnupData(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    const points = await prisma.sprintHistoryPoint.findMany({
      where: { sprintId },
      orderBy: { date: 'asc' },
    });

    return points.map((p) => ({
      date: p.date.toISOString().split('T')[0],
      completedPoints: p.completedPoints,
      totalPoints: p.remainingPoints + p.completedPoints,
      totalTasks: p.totalTasks,
      completedTasks: p.completedTasks,
    }));
  }

  async getVelocityData(folderId: string) {
    const sprints = await prisma.sprintEnhanced.findMany({
      where: {
        sprintFolderId: folderId,
        status: { in: ['COMPLETE', 'CLOSED'] },
      },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        name: true,
        velocity: true,
        completedPoints: true,
        totalPoints: true,
        startDate: true,
        endDate: true,
      },
    });

    return sprints.map((s) => ({
      sprintId: s.id,
      name: s.name,
      velocity: s.velocity ?? s.completedPoints,
      completedPoints: s.completedPoints,
      totalPoints: s.totalPoints,
      startDate: s.startDate.toISOString().split('T')[0],
      endDate: s.endDate.toISOString().split('T')[0],
    }));
  }

  async getSprintReport(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({
      where: { id: sprintId },
      include: { folder: { select: { id: true, name: true } } },
    });
    if (!sprint) {
      throw new AppError(404, 'Sprint not found', 'NOT_FOUND');
    }

    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { id: true, status: true, storyPoints: true, createdAt: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    // Tasks added after sprint start
    const addedDuringSprint = tasks.filter(
      (t) => t.createdAt > sprint.startDate
    ).length;

    const carryover = totalTasks - completedTasks;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        folder: sprint.folder,
      },
      totalTasks,
      completedTasks,
      carryover,
      addedDuringSprint,
      totalPoints,
      completedPoints,
      velocity: sprint.velocity ?? completedPoints,
      completionPercent,
    };
  }

  async recordDailySnapshot(sprintId: string) {
    const sprint = await prisma.sprintEnhanced.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.status !== 'ACTIVE') return;

    const tasks = await prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { status: true, storyPoints: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    await prisma.sprintHistoryPoint.create({
      data: {
        sprintId,
        date: new Date(),
        remainingPoints: totalPoints - completedPoints,
        completedPoints,
        totalTasks,
        completedTasks,
      },
    });

    // Update sprint totals
    await prisma.sprintEnhanced.update({
      where: { id: sprintId },
      data: { totalPoints, completedPoints },
    });
  }

  async recordAllActiveSnapshots() {
    const activeSprints = await prisma.sprintEnhanced.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const sprint of activeSprints) {
      await this.recordDailySnapshot(sprint.id).catch(() => {
        // Silently skip individual failures
      });
    }
  }
}

export const sprintsEnhancedService = new SprintsEnhancedService();
