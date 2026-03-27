import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true, bio: true };

class ProfilesService {
  async getProfile(userId: string, _viewerId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        timezone: true,
        status: true,
        customStatus: true,
        customStatusEmoji: true,
        lastSeenAt: true,
        createdAt: true,
        teamMemberships: {
          include: {
            team: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        },
        workspaceMembers: {
          select: { role: true, workspace: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'NOT_FOUND');
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Gather stats in parallel
    const [activeTasks, completedTasks, totalTimeTracked, goalsInProgress] = await Promise.all([
      prisma.taskAssignee.count({
        where: {
          userId,
          task: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } },
        },
      }),
      prisma.taskAssignee.count({
        where: {
          userId,
          task: {
            status: 'DONE',
            updatedAt: { gte: thirtyDaysAgo },
          },
        },
      }),
      prisma.timeEntry.aggregate({
        where: {
          userId,
          startedAt: { gte: thirtyDaysAgo },
        },
        _sum: { durationMinutes: true },
      }),
      prisma.goalMember.count({
        where: {
          userId,
        },
      }),
    ]);

    return {
      ...user,
      stats: {
        activeTasks,
        completedTasks,
        totalTimeTracked: (totalTimeTracked._sum?.durationMinutes ?? 0) * 60,
        goalsInProgress,
      },
    };
  }

  async getProfileActivity(userId: string, limit: number = 20) {
    // Fetch recent task comments + task completions as activity
    const [recentComments, recentCompletions] = await Promise.all([
      prisma.taskComment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          task: { select: { id: true, title: true } },
          user: { select: userSelect },
        },
      }),
      prisma.taskAssignee.findMany({
        where: {
          userId,
          task: { status: 'DONE' },
        },
        orderBy: { task: { updatedAt: 'desc' } },
        take: limit,
        include: {
          task: { select: { id: true, title: true, updatedAt: true } },
        },
      }),
    ]);

    // Merge and sort by date
    const activity: Array<{
      type: string;
      description: string;
      taskId?: string;
      taskTitle?: string;
      timestamp: Date;
      user?: { id: string; displayName: string; avatarUrl: string | null; email: string };
    }> = [];

    for (const comment of recentComments) {
      activity.push({
        type: 'comment',
        description: `Commented on "${comment.task.title}"`,
        taskId: comment.task.id,
        taskTitle: comment.task.title,
        timestamp: comment.createdAt,
        user: comment.user as any,
      });
    }

    for (const assignment of recentCompletions) {
      activity.push({
        type: 'task_completed',
        description: `Completed "${assignment.task.title}"`,
        taskId: assignment.task.id,
        taskTitle: assignment.task.title,
        timestamp: assignment.task.updatedAt,
      });
    }

    activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return activity.slice(0, limit);
  }

  async getProfileTasks(userId: string, filters?: { status?: string; priority?: string; listId?: string }) {
    const where: any = {
      assignees: { some: { userId } },
    };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.listId) {
      where.listId = filters.listId;
    }

    return prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        assignees: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
        list: { select: { id: true, name: true } },
      },
    });
  }

  async getProfileGoals(userId: string) {
    return prisma.goal.findMany({
      where: {
        members: { some: { userId } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        targets: true,
        members: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
        _count: { select: { targets: true, members: true } },
      },
    });
  }
}

export const profilesService = new ProfilesService();
