import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskPositionInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateCommentInput,
  UpdateCommentInput,
  LogTimeEntryInput,
  TaskFiltersInput,
  BulkUpdateTasksInput,
} from './tasks.schema';

// Shared select for user display in responses
const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

// Full task include used across many methods
const taskInclude = {
  createdBy: { select: userSelect },
  assignees: { include: { user: { select: userSelect } } },
  labels: { include: { label: true } },
  subtasks: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true },
    orderBy: { position: 'asc' as const },
  },
  parentTask: { select: { id: true, title: true } },
  dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
  dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
  _count: { select: { comments: true, timeEntries: true } },
} as const;

export class TasksService {
  // ==================================
  // PROJECT CRUD
  // ==================================

  async createProject(userId: string, input: CreateProjectInput) {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color ?? '#4F8EF7',
        columnOrder: input.columnOrder ?? ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
        createdById: userId,
        members: {
          create: [
            { userId, role: 'OWNER' },
            ...(input.memberIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        members: { include: { user: { select: userSelect } } },
        labels: true,
        _count: { select: { tasks: true } },
      },
    });

    return project;
  }

  async getProjects(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: { select: userSelect } } },
        labels: true,
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects;
  }

  async getProject(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: { select: userSelect } } },
        labels: true,
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });

    if (!project) {
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }

    return project;
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN']);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        columnOrder: input.columnOrder,
      },
      include: {
        members: { include: { user: { select: userSelect } } },
        labels: true,
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });

    return project;
  }

  async deleteProject(userId: string, projectId: string) {
    await this.requireProjectRole(userId, projectId, ['OWNER']);

    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }

  // ==================================
  // PROJECT MEMBERS
  // ==================================

  async addProjectMember(userId: string, projectId: string, targetUserId: string, role: string) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN']);

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (existing) {
      throw new AppError(409, 'User is already a member', 'ALREADY_MEMBER');
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId: targetUserId, role: role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' },
      include: { user: { select: userSelect } },
    });

    return member;
  }

  async updateProjectMember(userId: string, projectId: string, targetUserId: string, role: string) {
    await this.requireProjectRole(userId, projectId, ['OWNER']);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) {
      throw new AppError(404, 'Member not found', 'NOT_FOUND');
    }

    return prisma.projectMember.update({
      where: { id: member.id },
      data: { role: role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' },
      include: { user: { select: userSelect } },
    });
  }

  async removeProjectMember(userId: string, projectId: string, targetUserId: string) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN']);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) {
      throw new AppError(404, 'Member not found', 'NOT_FOUND');
    }
    if (member.role === 'OWNER') {
      throw new AppError(400, 'Cannot remove the project owner', 'CANNOT_REMOVE_OWNER');
    }

    await prisma.projectMember.delete({ where: { id: member.id } });
  }

  // ==================================
  // TASK CRUD
  // ==================================

  async createTask(userId: string, projectId: string, input: CreateTaskInput) {
    await this.requireProjectMembership(userId, projectId);

    // Calculate position: place at end of the status column
    let position = input.position;
    if (position === undefined) {
      const lastTask = await prisma.task.findFirst({
        where: {
          projectId,
          status: input.status ?? 'TODO',
          parentTaskId: input.parentTaskId ?? null,
          deletedAt: null,
        },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastTask?.position ?? 0) + 65536;
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title: input.title,
        descriptionHtml: input.descriptionHtml,
        status: input.status ?? 'TODO',
        priority: input.priority ?? 'NONE',
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        parentTaskId: input.parentTaskId,
        position,
        estimatedMinutes: input.estimatedMinutes,
        createdById: userId,
        assignees: input.assigneeIds?.length
          ? { create: input.assigneeIds.map((uid) => ({ userId: uid })) }
          : undefined,
        labels: input.labelIds?.length
          ? { create: input.labelIds.map((lid) => ({ labelId: lid })) }
          : undefined,
      },
      include: taskInclude,
    });

    // Log activity
    await this.logActivity(task.id, userId, 'created', null, null);

    return task;
  }

  async getTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: taskInclude,
    });

    if (!task) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, task.projectId);

    // Compute subtask progress
    const subtaskProgress = this.computeSubtaskProgress(task.subtasks);

    // Compute total time
    const totalMinutes = await this.computeTotalTime(taskId);

    return { ...task, subtaskProgress, totalMinutes };
  }

  async updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!existing) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, existing.projectId);

    // Track changes for activity log
    const changes: Array<{ action: string; oldValue: string | null; newValue: string | null }> = [];

    if (input.status !== undefined && input.status !== existing.status) {
      changes.push({ action: 'status_changed', oldValue: existing.status, newValue: input.status });
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      changes.push({ action: 'priority_changed', oldValue: existing.priority, newValue: input.priority });
    }
    if (input.title !== undefined && input.title !== existing.title) {
      changes.push({ action: 'title_changed', oldValue: existing.title, newValue: input.title });
    }
    if (input.dueDate !== undefined) {
      const oldDue = existing.dueDate?.toISOString() ?? null;
      const newDue = input.dueDate;
      if (oldDue !== newDue) {
        changes.push({ action: 'due_date_changed', oldValue: oldDue, newValue: newDue ?? null });
      }
    }
    if (input.estimatedMinutes !== undefined) {
      const oldEst = existing.estimatedMinutes?.toString() ?? null;
      const newEst = input.estimatedMinutes?.toString() ?? null;
      if (oldEst !== newEst) {
        changes.push({ action: 'estimate_changed', oldValue: oldEst, newValue: newEst });
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        descriptionHtml: input.descriptionHtml,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
        parentTaskId: input.parentTaskId,
        position: input.position,
        estimatedMinutes: input.estimatedMinutes,
      },
      include: taskInclude,
    });

    // Bulk-create activity entries
    if (changes.length > 0) {
      await prisma.taskActivity.createMany({
        data: changes.map((c) => ({
          taskId,
          userId,
          action: c.action,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      });
    }

    return task;
  }

  async deleteTask(userId: string, taskId: string) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!existing) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, existing.projectId);

    // Soft-delete the task and all its subtasks
    await prisma.task.updateMany({
      where: {
        OR: [{ id: taskId }, { parentTaskId: taskId }],
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    await this.logActivity(taskId, userId, 'deleted', null, null);
  }

  // ==================================
  // DRAG-AND-DROP POSITION UPDATE
  // ==================================

  async updateTaskPosition(userId: string, taskId: string, input: UpdateTaskPositionInput) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!existing) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, existing.projectId);

    const data: Record<string, unknown> = { position: input.position };
    if (input.status && input.status !== existing.status) {
      data.status = input.status;
      await this.logActivity(taskId, userId, 'status_changed', existing.status, input.status);
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: taskInclude,
    });

    return task;
  }

  // ==================================
  // ASSIGNEES
  // ==================================

  async assignUsers(userId: string, taskId: string, userIds: string[]) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Filter out already-assigned users
    const existing = await prisma.taskAssignee.findMany({
      where: { taskId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((a) => a.userId));
    const newIds = userIds.filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: newIds.map((uid) => ({ taskId, userId: uid })),
      });

      for (const uid of newIds) {
        const user = await prisma.user.findUnique({ where: { id: uid }, select: { displayName: true } });
        await this.logActivity(taskId, userId, 'assignee_added', null, user?.displayName ?? uid);
      }
    }

    return prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  }

  async unassignUser(userId: string, taskId: string, targetUserId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const assignee = await prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });
    if (!assignee) {
      throw new AppError(404, 'User is not assigned to this task', 'NOT_FOUND');
    }

    await prisma.taskAssignee.delete({ where: { id: assignee.id } });

    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { displayName: true } });
    await this.logActivity(taskId, userId, 'assignee_removed', user?.displayName ?? targetUserId, null);

    return prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  }

  // ==================================
  // LABELS
  // ==================================

  async createLabel(userId: string, projectId: string, input: CreateLabelInput) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN', 'MEMBER']);

    const label = await prisma.projectLabel.create({
      data: {
        projectId,
        name: input.name,
        color: input.color ?? '#4F8EF7',
      },
    });

    return label;
  }

  async updateLabel(userId: string, projectId: string, labelId: string, input: UpdateLabelInput) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN', 'MEMBER']);

    const label = await prisma.projectLabel.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) {
      throw new AppError(404, 'Label not found', 'NOT_FOUND');
    }

    return prisma.projectLabel.update({
      where: { id: labelId },
      data: { name: input.name, color: input.color },
    });
  }

  async deleteLabel(userId: string, projectId: string, labelId: string) {
    await this.requireProjectRole(userId, projectId, ['OWNER', 'ADMIN']);

    const label = await prisma.projectLabel.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) {
      throw new AppError(404, 'Label not found', 'NOT_FOUND');
    }

    await prisma.projectLabel.delete({ where: { id: labelId } });
  }

  async assignLabels(userId: string, taskId: string, labelIds: string[]) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Validate labels belong to the same project
    const labels = await prisma.projectLabel.findMany({
      where: { id: { in: labelIds }, projectId: task.projectId },
    });
    if (labels.length !== labelIds.length) {
      throw new AppError(400, 'One or more labels do not belong to this project', 'INVALID_LABELS');
    }

    // Filter out already-assigned labels
    const existing = await prisma.taskLabel.findMany({
      where: { taskId, labelId: { in: labelIds } },
      select: { labelId: true },
    });
    const existingSet = new Set(existing.map((l) => l.labelId));
    const newIds = labelIds.filter((id) => !existingSet.has(id));

    if (newIds.length > 0) {
      await prisma.taskLabel.createMany({
        data: newIds.map((lid) => ({ taskId, labelId: lid })),
      });
    }

    return prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  }

  async removeLabel(userId: string, taskId: string, labelId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const taskLabel = await prisma.taskLabel.findUnique({
      where: { taskId_labelId: { taskId, labelId } },
    });
    if (!taskLabel) {
      throw new AppError(404, 'Label not assigned to this task', 'NOT_FOUND');
    }

    await prisma.taskLabel.delete({ where: { id: taskLabel.id } });

    return prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  }

  // ==================================
  // COMMENTS
  // ==================================

  async getComments(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    return prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(userId: string, taskId: string, input: CreateCommentInput) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        bodyHtml: input.bodyHtml,
      },
      include: { user: { select: userSelect } },
    });

    await this.logActivity(taskId, userId, 'comment_added', null, null);

    return comment;
  }

  async updateComment(userId: string, commentId: string, input: UpdateCommentInput) {
    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }
    if (comment.userId !== userId) {
      throw new AppError(403, 'Cannot edit others\' comments', 'FORBIDDEN');
    }

    return prisma.taskComment.update({
      where: { id: commentId },
      data: { bodyHtml: input.bodyHtml },
      include: { user: { select: userSelect } },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: { select: { projectId: true } } },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    // Allow comment owner or project owner/admin to delete
    if (comment.userId !== userId) {
      await this.requireProjectRole(userId, comment.task.projectId, ['OWNER', 'ADMIN']);
    }

    await prisma.taskComment.delete({ where: { id: commentId } });
  }

  // ==================================
  // ACTIVITY LOG
  // ==================================

  async getActivities(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const activities = await prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Attach user info to each activity
    const userIds = [...new Set(activities.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: userSelect,
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return activities.map((a) => ({
      ...a,
      user: userMap.get(a.userId) ?? null,
    }));
  }

  // ==================================
  // TIME TRACKING
  // ==================================

  async startTimer(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Check for an existing running timer for this user on any task
    const running = await prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
    });
    if (running) {
      // Auto-stop the running timer
      const durationMinutes = Math.round(
        (Date.now() - running.startedAt.getTime()) / 60000
      );
      await prisma.timeEntry.update({
        where: { id: running.id },
        data: { endedAt: new Date(), durationMinutes },
      });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        startedAt: new Date(),
      },
    });

    return entry;
  }

  async stopTimer(userId: string, taskId: string) {
    const running = await prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
    if (!running) {
      throw new AppError(400, 'No running timer found', 'NO_RUNNING_TIMER');
    }

    const endedAt = new Date();
    const durationMinutes = Math.round(
      (endedAt.getTime() - running.startedAt.getTime()) / 60000
    );

    const entry = await prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt, durationMinutes: Math.max(durationMinutes, 1) },
    });

    return entry;
  }

  async logTimeEntry(userId: string, taskId: string, input: LogTimeEntryInput) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const startedAt = new Date(input.startedAt);
    let endedAt: Date | undefined;
    let durationMinutes: number | undefined;

    if (input.endedAt) {
      endedAt = new Date(input.endedAt);
      durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
      if (durationMinutes <= 0) {
        throw new AppError(400, 'End time must be after start time', 'INVALID_TIME_RANGE');
      }
    } else if (input.durationMinutes) {
      durationMinutes = input.durationMinutes;
      endedAt = new Date(startedAt.getTime() + durationMinutes * 60000);
    } else {
      throw new AppError(400, 'Provide either endedAt or durationMinutes', 'INVALID_INPUT');
    }

    const entry = await prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        startedAt,
        endedAt,
        durationMinutes,
      },
    });

    return entry;
  }

  async getTimeEntries(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const entries = await prisma.timeEntry.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
      orderBy: { startedAt: 'desc' },
    });

    const totalMinutes = await this.computeTotalTime(taskId);

    return { entries, totalMinutes };
  }

  async deleteTimeEntry(userId: string, entryId: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new AppError(404, 'Time entry not found', 'NOT_FOUND');
    }
    if (entry.userId !== userId) {
      throw new AppError(403, 'Cannot delete others\' time entries', 'FORBIDDEN');
    }

    await prisma.timeEntry.delete({ where: { id: entryId } });
  }

  // ==================================
  // DEPENDENCIES
  // ==================================

  async addDependency(userId: string, taskId: string, dependsOnId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    if (taskId === dependsOnId) {
      throw new AppError(400, 'A task cannot depend on itself', 'SELF_DEPENDENCY');
    }

    // Verify the dependency target exists in the same project
    const depTask = await prisma.task.findFirst({
      where: { id: dependsOnId, projectId: task.projectId, deletedAt: null },
    });
    if (!depTask) {
      throw new AppError(404, 'Dependency task not found in the same project', 'NOT_FOUND');
    }

    // Check for circular dependency: would adding this create a cycle?
    const wouldCycle = await this.checkCircularDependency(dependsOnId, taskId);
    if (wouldCycle) {
      throw new AppError(400, 'This would create a circular dependency', 'CIRCULAR_DEPENDENCY');
    }

    const dep = await prisma.taskDependency.create({
      data: { taskId, dependsOnId },
      include: { dependsOn: { select: { id: true, title: true, status: true } } },
    });

    await this.logActivity(taskId, userId, 'dependency_added', null, depTask.title);

    return dep;
  }

  async removeDependency(userId: string, taskId: string, dependsOnId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const dep = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnId: { taskId, dependsOnId } },
    });
    if (!dep) {
      throw new AppError(404, 'Dependency not found', 'NOT_FOUND');
    }

    await prisma.taskDependency.delete({ where: { id: dep.id } });
  }

  // ==================================
  // TASK LISTING WITH FILTERS/SORT
  // ==================================

  async getTasks(userId: string, projectId: string, filters: TaskFiltersInput) {
    await this.requireProjectMembership(userId, projectId);

    const where: Record<string, unknown> = {
      projectId,
      deletedAt: null,
    };

    // Status filter
    if (filters.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    // Priority filter
    if (filters.priority) {
      where.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
    }

    // Assignee filter
    if (filters.assigneeId) {
      where.assignees = { some: { userId: filters.assigneeId } };
    }

    // Label filter
    if (filters.labelId) {
      where.labels = { some: { labelId: filters.labelId } };
    }

    // Due date range filter
    if (filters.dueDateFrom || filters.dueDateTo) {
      const dueDateFilter: Record<string, Date> = {};
      if (filters.dueDateFrom) dueDateFilter.gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo) dueDateFilter.lte = new Date(filters.dueDateTo);
      where.dueDate = dueDateFilter;
    }

    // Parent task filter (null = top-level only)
    if (filters.parentTaskId !== undefined) {
      where.parentTaskId = filters.parentTaskId;
    }

    // Search filter
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    // Build sort
    const orderBy = this.buildOrderBy(filters.sortBy ?? 'position', filters.sortOrder ?? 'asc');

    // Cursor pagination
    let cursor: { id: string } | undefined;
    let skip: number | undefined;
    if (filters.cursor) {
      cursor = { id: filters.cursor };
      skip = 1;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy,
      take: (filters.limit ?? 50) + 1,
      cursor,
      skip,
    });

    const hasMore = tasks.length > (filters.limit ?? 50);
    if (hasMore) tasks.pop();

    return {
      tasks,
      hasMore,
      cursor: tasks.length > 0 ? tasks[tasks.length - 1].id : undefined,
    };
  }

  // ==================================
  // BOARD VIEW (grouped by status)
  // ==================================

  async getBoardView(userId: string, projectId: string, filters?: TaskFiltersInput) {
    const project = await this.getProject(userId, projectId);
    const columnOrder = project.columnOrder as string[];

    const baseWhere: Record<string, unknown> = {
      projectId,
      deletedAt: null,
      parentTaskId: null, // Board view shows top-level tasks only
    };

    // Apply filters
    if (filters?.priority) {
      baseWhere.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
    }
    if (filters?.assigneeId) {
      baseWhere.assignees = { some: { userId: filters.assigneeId } };
    }
    if (filters?.labelId) {
      baseWhere.labels = { some: { labelId: filters.labelId } };
    }
    if (filters?.search) {
      baseWhere.title = { contains: filters.search, mode: 'insensitive' };
    }

    const columns = await Promise.all(
      columnOrder.map(async (status) => {
        const tasks = await prisma.task.findMany({
          where: { ...baseWhere, status: status as 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' },
          include: taskInclude,
          orderBy: { position: 'asc' },
        });

        return {
          status,
          tasks,
          count: tasks.length,
        };
      })
    );

    return {
      columns,
      columnOrder,
    };
  }

  // ==================================
  // LIST VIEW (flat list)
  // ==================================

  async getListView(userId: string, projectId: string, filters: TaskFiltersInput) {
    return this.getTasks(userId, projectId, {
      ...filters,
      parentTaskId: filters.parentTaskId !== undefined ? filters.parentTaskId : null,
    });
  }

  // ==================================
  // BULK OPERATIONS
  // ==================================

  async bulkUpdateTasks(userId: string, projectId: string, input: BulkUpdateTasksInput) {
    await this.requireProjectMembership(userId, projectId);

    // Verify all tasks belong to the project
    const tasks = await prisma.task.findMany({
      where: { id: { in: input.taskIds }, projectId, deletedAt: null },
      select: { id: true, status: true, priority: true },
    });

    if (tasks.length !== input.taskIds.length) {
      throw new AppError(400, 'One or more tasks not found in this project', 'INVALID_TASKS');
    }

    const updateData: Record<string, unknown> = {};
    if (input.status) updateData.status = input.status;
    if (input.priority) updateData.priority = input.priority;

    // Bulk update fields
    if (Object.keys(updateData).length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: input.taskIds } },
        data: updateData,
      });

      // Log activities
      const activities: Array<{
        taskId: string;
        userId: string;
        action: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      for (const task of tasks) {
        if (input.status && input.status !== task.status) {
          activities.push({
            taskId: task.id,
            userId,
            action: 'status_changed',
            oldValue: task.status,
            newValue: input.status,
          });
        }
        if (input.priority && input.priority !== task.priority) {
          activities.push({
            taskId: task.id,
            userId,
            action: 'priority_changed',
            oldValue: task.priority,
            newValue: input.priority,
          });
        }
      }

      if (activities.length > 0) {
        await prisma.taskActivity.createMany({ data: activities });
      }
    }

    // Bulk add assignee
    if (input.assigneeId) {
      const existingAssignees = await prisma.taskAssignee.findMany({
        where: { taskId: { in: input.taskIds }, userId: input.assigneeId },
        select: { taskId: true },
      });
      const existingSet = new Set(existingAssignees.map((a) => a.taskId));
      const newAssignments = input.taskIds
        .filter((tid) => !existingSet.has(tid))
        .map((tid) => ({ taskId: tid, userId: input.assigneeId! }));

      if (newAssignments.length > 0) {
        await prisma.taskAssignee.createMany({ data: newAssignments });
      }
    }

    // Bulk add label
    if (input.labelId) {
      const existingLabels = await prisma.taskLabel.findMany({
        where: { taskId: { in: input.taskIds }, labelId: input.labelId },
        select: { taskId: true },
      });
      const existingSet = new Set(existingLabels.map((l) => l.taskId));
      const newLabels = input.taskIds
        .filter((tid) => !existingSet.has(tid))
        .map((tid) => ({ taskId: tid, labelId: input.labelId! }));

      if (newLabels.length > 0) {
        await prisma.taskLabel.createMany({ data: newLabels });
      }
    }

    // Return updated tasks
    return prisma.task.findMany({
      where: { id: { in: input.taskIds } },
      include: taskInclude,
    });
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireProjectMembership(userId: string, projectId: string) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this project', 'FORBIDDEN');
    }
    return membership;
  }

  private async requireProjectRole(userId: string, projectId: string, roles: string[]) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this project', 'FORBIDDEN');
    }
    if (!roles.includes(membership.role)) {
      throw new AppError(403, `Requires one of: ${roles.join(', ')}`, 'INSUFFICIENT_ROLE');
    }
    return membership;
  }

  private async getTaskOrThrow(taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, projectId: true, title: true, status: true, priority: true },
    });
    if (!task) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }
    return task;
  }

  private async logActivity(
    taskId: string,
    userId: string,
    action: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    await prisma.taskActivity.create({
      data: { taskId, userId, action, oldValue, newValue },
    });
  }

  private computeSubtaskProgress(subtasks: Array<{ id: string; status: string }>) {
    if (subtasks.length === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = subtasks.filter((s) => s.status === 'DONE').length;
    return {
      total: subtasks.length,
      completed,
      percentage: Math.round((completed / subtasks.length) * 100),
    };
  }

  private async computeTotalTime(taskId: string): Promise<number> {
    const result = await prisma.timeEntry.aggregate({
      where: { taskId, endedAt: { not: null } },
      _sum: { durationMinutes: true },
    });
    return result._sum.durationMinutes ?? 0;
  }

  private buildOrderBy(sortBy: string, sortOrder: string) {
    const order = sortOrder as 'asc' | 'desc';

    switch (sortBy) {
      case 'priority':
        return { priority: order };
      case 'dueDate':
        return { dueDate: order };
      case 'createdAt':
        return { createdAt: order };
      case 'title':
        return { title: order };
      case 'position':
      default:
        return { position: order };
    }
  }

  private async checkCircularDependency(startId: string, targetId: string): Promise<boolean> {
    // BFS to check if targetId is reachable from startId through dependencies
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await prisma.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnId: true },
      });

      for (const dep of deps) {
        if (!visited.has(dep.dependsOnId)) {
          queue.push(dep.dependsOnId);
        }
      }
    }

    return false;
  }
}

export const tasksService = new TasksService();
