import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateGoalFolderInput,
  UpdateGoalFolderInput,
  CreateGoalInput,
  UpdateGoalInput,
  CreateTargetInput,
  UpdateTargetInput,
} from './goals.validation';
import type { GoalRole } from '@prisma/client';

const userSelect = { id: true, displayName: true, avatarUrl: true };

class GoalsService {
  // ==========================================
  // GOAL FOLDERS
  // ==========================================

  async getGoalFolders(workspaceId: string) {
    return prisma.goalFolder.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { goals: true } },
      },
    });
  }

  async createGoalFolder(workspaceId: string, userId: string, data: CreateGoalFolderInput) {
    return prisma.goalFolder.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name,
        color: data.color,
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { goals: true } },
      },
    });
  }

  async updateGoalFolder(folderId: string, data: UpdateGoalFolderInput) {
    const folder = await prisma.goalFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'Goal folder not found', 'NOT_FOUND');
    }

    return prisma.goalFolder.update({
      where: { id: folderId },
      data: {
        name: data.name,
        color: data.color,
        position: data.position,
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { goals: true } },
      },
    });
  }

  async deleteGoalFolder(folderId: string) {
    const folder = await prisma.goalFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'Goal folder not found', 'NOT_FOUND');
    }

    // Move goals to unfiled (set folderId to null)
    await prisma.goal.updateMany({
      where: { folderId },
      data: { folderId: null },
    });

    await prisma.goalFolder.delete({ where: { id: folderId } });
  }

  // ==========================================
  // GOALS
  // ==========================================

  async getGoals(workspaceId: string, folderId?: string) {
    const where: any = { workspaceId };
    if (folderId !== undefined) {
      where.folderId = folderId === 'null' ? null : folderId;
    }

    const goals = await prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        folder: { select: { id: true, name: true, color: true } },
        createdBy: { select: userSelect },
        targets: true,
        members: {
          include: { user: { select: userSelect } },
        },
      },
    });

    return goals.map((goal) => ({
      ...goal,
      progress: this.calculateGoalProgress(goal.targets),
    }));
  }

  async createGoal(userId: string, data: CreateGoalInput) {
    const goal = await prisma.goal.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        color: data.color,
        folderId: data.folderId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        isPrivate: data.isPrivate ?? false,
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        folder: { select: { id: true, name: true, color: true } },
        createdBy: { select: userSelect },
        targets: true,
        members: {
          include: { user: { select: userSelect } },
        },
      },
    });

    return {
      ...goal,
      progress: this.calculateGoalProgress(goal.targets),
    };
  }

  async getGoal(goalId: string) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        folder: { select: { id: true, name: true, color: true } },
        createdBy: { select: userSelect },
        targets: true,
        members: {
          include: { user: { select: userSelect } },
        },
      },
    });

    if (!goal) {
      throw new AppError(404, 'Goal not found', 'NOT_FOUND');
    }

    const targets = await Promise.all(
      goal.targets.map(async (target) => ({
        ...target,
        progress: await this.calculateTargetProgress(target),
      }))
    );

    return {
      ...goal,
      targets,
      progress: this.calculateGoalProgress(goal.targets),
    };
  }

  async updateGoal(goalId: string, data: UpdateGoalInput) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'NOT_FOUND');
    }

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        folderId: data.folderId,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
        isPrivate: data.isPrivate,
      },
      include: {
        folder: { select: { id: true, name: true, color: true } },
        createdBy: { select: userSelect },
        targets: true,
        members: {
          include: { user: { select: userSelect } },
        },
      },
    });

    return {
      ...updated,
      progress: this.calculateGoalProgress(updated.targets),
    };
  }

  async deleteGoal(goalId: string) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'NOT_FOUND');
    }

    // Cascade deletes targets and members
    await prisma.goal.delete({ where: { id: goalId } });
  }

  // ==========================================
  // TARGETS
  // ==========================================

  async addTarget(goalId: string, data: CreateTargetInput) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'NOT_FOUND');
    }

    return prisma.goalTarget.create({
      data: {
        goalId,
        name: data.name,
        targetType: data.targetType,
        targetValue: data.targetValue ?? 100,
        unit: data.unit,
        listId: data.listId,
      },
    });
  }

  async updateTarget(targetId: string, data: UpdateTargetInput) {
    const target = await prisma.goalTarget.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new AppError(404, 'Target not found', 'NOT_FOUND');
    }

    return prisma.goalTarget.update({
      where: { id: targetId },
      data: {
        name: data.name,
        currentValue: data.currentValue,
        targetValue: data.targetValue,
      },
    });
  }

  async deleteTarget(targetId: string) {
    const target = await prisma.goalTarget.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new AppError(404, 'Target not found', 'NOT_FOUND');
    }

    await prisma.goalTarget.delete({ where: { id: targetId } });
  }

  async updateTargetProgress(targetId: string, value: number) {
    const target = await prisma.goalTarget.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new AppError(404, 'Target not found', 'NOT_FOUND');
    }

    return prisma.goalTarget.update({
      where: { id: targetId },
      data: { currentValue: value },
    });
  }

  async calculateTaskCompletionProgress(listId: string): Promise<number> {
    const items = await prisma.listItem.findMany({
      where: { listId },
      select: { values: true },
    });

    if (items.length === 0) return 0;

    // ListItem stores data as JSON in "values" — look for a status/completed field
    const doneCount = items.filter((item) => {
      const vals = item.values as Record<string, any> | null;
      if (!vals) return false;
      // Check common completion indicators in the JSON values
      if (vals.status === 'DONE' || vals.status === 'done' || vals.status === 'completed') return true;
      if (vals.completed === true) return true;
      return false;
    }).length;

    return (doneCount / items.length) * 100;
  }

  // ==========================================
  // MEMBERS
  // ==========================================

  async addMember(goalId: string, userId: string, role: GoalRole = 'CONTRIBUTOR') {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'NOT_FOUND');
    }

    const existing = await prisma.goalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
    });
    if (existing) {
      throw new AppError(409, 'User is already a member of this goal', 'DUPLICATE');
    }

    return prisma.goalMember.create({
      data: { goalId, userId, role },
      include: { user: { select: userSelect } },
    });
  }

  async removeMember(goalId: string, userId: string) {
    const member = await prisma.goalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
    });
    if (!member) {
      throw new AppError(404, 'Member not found', 'NOT_FOUND');
    }

    await prisma.goalMember.delete({ where: { id: member.id } });
  }

  async updateMemberRole(goalId: string, userId: string, role: GoalRole) {
    const member = await prisma.goalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
    });
    if (!member) {
      throw new AppError(404, 'Member not found', 'NOT_FOUND');
    }

    return prisma.goalMember.update({
      where: { id: member.id },
      data: { role },
      include: { user: { select: userSelect } },
    });
  }

  // ==========================================
  // PROGRESS CALCULATION
  // ==========================================

  private async calculateTargetProgress(target: {
    targetType: string;
    currentValue: number;
    targetValue: number;
    listId: string | null;
  }): Promise<number> {
    switch (target.targetType) {
      case 'NUMBER':
      case 'CURRENCY':
        return target.targetValue > 0
          ? Math.min((target.currentValue / target.targetValue) * 100, 100)
          : 0;
      case 'TRUE_FALSE':
        return target.currentValue > 0 ? 100 : 0;
      case 'TASK_COMPLETION':
        if (target.listId) {
          return this.calculateTaskCompletionProgress(target.listId);
        }
        return 0;
      case 'AUTOMATIC':
        return target.targetValue > 0
          ? Math.min((target.currentValue / target.targetValue) * 100, 100)
          : 0;
      default:
        return 0;
    }
  }

  private calculateGoalProgress(
    targets: Array<{ targetType: string; currentValue: number; targetValue: number; listId: string | null }>
  ): number {
    if (targets.length === 0) return 0;

    const progressValues = targets.map((target) => {
      switch (target.targetType) {
        case 'NUMBER':
        case 'CURRENCY':
        case 'AUTOMATIC':
          return target.targetValue > 0
            ? Math.min((target.currentValue / target.targetValue) * 100, 100)
            : 0;
        case 'TRUE_FALSE':
          return target.currentValue > 0 ? 100 : 0;
        case 'TASK_COMPLETION':
          // For synchronous calculation, use stored currentValue
          return target.targetValue > 0
            ? Math.min((target.currentValue / target.targetValue) * 100, 100)
            : 0;
        default:
          return 0;
      }
    });

    const total = progressValues.reduce((sum, val) => sum + val, 0);
    return Math.round((total / targets.length) * 100) / 100;
  }
}

export const goalsService = new GoalsService();
