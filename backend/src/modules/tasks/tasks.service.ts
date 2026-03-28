import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { checklistsService } from './checklists/checklists.service';
import { relationshipsService } from '../relationships/relationships.service';
import { config } from '../../config';
import { emitAutomationEvent } from '../automations/automation-events';
import { customFieldsService } from '../custom-fields/custom-fields.service';
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
  BulkActionInput,
  CreateSubtaskInput,
} from './tasks.schema';

// Helper to resolve workspace context from a task for automation events.
// Accepts either an object with listId or a taskId string.
async function resolveWorkspaceContext(taskOrId: { listId?: string | null } | string): Promise<{
  workspaceId?: string;
  spaceId?: string;
  listId?: string;
}> {
  let listId: string | null | undefined;
  if (typeof taskOrId === 'string') {
    const t = await prisma.task.findUnique({ where: { id: taskOrId }, select: { listId: true } });
    listId = t?.listId;
  } else {
    listId = taskOrId.listId;
  }
  if (!listId) return {};
  const list = await prisma.taskList.findUnique({
    where: { id: listId },
    select: { id: true, spaceId: true, space: { select: { workspaceId: true } } },
  });
  if (!list) return {};
  return {
    workspaceId: list.space.workspaceId,
    spaceId: list.spaceId,
    listId: list.id,
  };
}

// Shared select for user display in responses
const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

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

/**
 * Given a listId, atomically increment the space's taskIdCounter and return
 * the generated custom task ID (e.g. "ENG-001"), or null if no prefix is set.
 */
async function generateCustomTaskId(listId: string | null | undefined): Promise<string | null> {
  if (!listId) return null;

  const list = await prisma.taskList.findUnique({
    where: { id: listId },
    select: { spaceId: true },
  });
  if (!list) return null;

  const space = await prisma.space.findUnique({
    where: { id: list.spaceId },
    select: { id: true, taskIdPrefix: true },
  });
  if (!space?.taskIdPrefix) return null;

  // Atomically increment counter
  const updated = await prisma.space.update({
    where: { id: space.id },
    data: { taskIdCounter: { increment: 1 } },
    select: { taskIdCounter: true, taskIdPrefix: true },
  });

  return `${updated.taskIdPrefix}-${String(updated.taskIdCounter).padStart(3, '0')}`;
}

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

    // If parentTaskId provided, auto-set subtask fields
    let isSubtask = false;
    let depth = 0;
    let listId: string | undefined;

    if (input.parentTaskId) {
      const parent = await prisma.task.findFirst({
        where: { id: input.parentTaskId, deletedAt: null },
        select: { id: true, depth: true, listId: true, projectId: true },
      });
      if (!parent) {
        throw new AppError(404, 'Parent task not found', 'NOT_FOUND');
      }
      if (parent.projectId !== projectId) {
        throw new AppError(400, 'Parent task must be in the same project', 'INVALID_PARENT');
      }
      depth = parent.depth + 1;
      if (depth > 10) {
        throw new AppError(400, 'Maximum subtask depth of 10 levels exceeded', 'MAX_DEPTH_EXCEEDED');
      }
      isSubtask = true;
      listId = parent.listId ?? undefined;
    }

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

    // If listId provided directly in input, use it (hierarchy tasks)
    const effectiveListId = listId ?? (input as any).listId ?? undefined;

    // Generate custom task ID if the task belongs to a space with a prefix
    const customTaskId = await generateCustomTaskId(effectiveListId);

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
        isSubtask,
        depth,
        listId: effectiveListId,
        statusName: (input as any).statusName,
        statusColor: (input as any).statusColor,
        taskTypeId: (input as any).taskTypeId,
        customTaskId,
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

    // Auto-add creator as watcher
    await this.autoAddWatcher(task.id, userId);

    // Emit automation event for task creation
    resolveWorkspaceContext(task).then((ctx) => {
      if (ctx.workspaceId) {
        emitAutomationEvent({
          type: 'task_created',
          taskId: task.id,
          userId,
          data: {},
          workspaceId: ctx.workspaceId,
          spaceId: ctx.spaceId,
          listId: ctx.listId,
        });
      }
    }).catch(() => {});

    // Fire-and-forget: process AI custom fields for this task
    customFieldsService.processAIFieldsForTask(task.id).catch(() => {});

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

    // Compute subtask progress (recursive — all nested subtasks)
    const allSubtasks = await this.getAllSubtasksFlat(taskId);
    const subtaskCount = allSubtasks.length;
    const completedSubtaskCount = allSubtasks.filter((s) => s.status === 'DONE').length;
    const subtaskProgress = subtaskCount > 0
      ? { total: subtaskCount, completed: completedSubtaskCount, percentage: Math.round((completedSubtaskCount / subtaskCount) * 100) }
      : { total: 0, completed: 0, percentage: 0 };

    // Compute total time
    const totalMinutes = await this.computeTotalTime(taskId);

    // Compute checklist data
    const checklists = await checklistsService.getChecklists(taskId);
    const checklistProgress = await checklistsService.getChecklistProgress(taskId);

    // Get relationships and dependency warnings
    const [relationships, dependencyWarnings] = await Promise.all([
      relationshipsService.getRelationships(taskId),
      relationshipsService.getDependencyWarnings(taskId),
    ]);

    // Get watchers and check if current user is watching
    const [watchers, isWatching] = await Promise.all([
      this.getWatchers(taskId),
      this.isWatching(taskId, userId),
    ]);

    // Get workspace tags for this task
    const taskTags = await prisma.taskTag.findMany({
      where: { taskId },
      include: { tag: { select: { id: true, name: true, color: true } } },
    });
    const tags = taskTags.map((tt) => tt.tag);

    // Time estimate summary
    const estimatedMinutesTotal = task.timeEstimate ?? 0;
    const timePercentComplete = estimatedMinutesTotal > 0
      ? Math.round((totalMinutes / estimatedMinutesTotal) * 1000) / 10
      : 0;
    const timeSummary = {
      estimatedTotal: estimatedMinutesTotal,
      trackedTotal: totalMinutes,
      remaining: Math.max(0, estimatedMinutesTotal - totalMinutes),
      percentComplete: timePercentComplete,
    };

    return { ...task, subtaskCount, completedSubtaskCount, subtaskProgress, totalMinutes, timeSummary, checklists, checklistProgress, relationships, dependencyWarnings, watchers, isWatching, tags };
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
      // TODO: When status changes to DONE, notify tasks that were WAITING_ON this task
      // (wire up actual notifications once notification system supports it)
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
        startDate: input.startDate === null ? null : input.startDate ? new Date(input.startDate) : undefined,
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

    // Emit automation events for status and priority changes
    resolveWorkspaceContext(task).then((ctx) => {
      if (!ctx.workspaceId) return;
      for (const change of changes) {
        if (change.action === 'status_changed') {
          emitAutomationEvent({
            type: 'status_changed',
            taskId,
            userId,
            data: { fromStatus: change.oldValue, toStatus: change.newValue },
            workspaceId: ctx.workspaceId,
            spaceId: ctx.spaceId,
            listId: ctx.listId,
          });
        }
        if (change.action === 'priority_changed') {
          emitAutomationEvent({
            type: 'priority_changed',
            taskId,
            userId,
            data: { fromPriority: change.oldValue, toPriority: change.newValue },
            workspaceId: ctx.workspaceId,
            spaceId: ctx.spaceId,
            listId: ctx.listId,
          });
        }
      }
    }).catch(() => {});

    // Fire-and-forget: process AI custom fields for this task
    customFieldsService.processAIFieldsForTask(task.id).catch(() => {});

    return task;
  }

  async updateDates(userId: string, taskId: string, startDate?: string | null, dueDate?: string | null) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!existing) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, existing.projectId);

    const changes: Array<{ action: string; oldValue: string | null; newValue: string | null }> = [];

    if (startDate !== undefined) {
      const oldStart = existing.startDate?.toISOString() ?? null;
      const newStart = startDate;
      if (oldStart !== newStart) {
        changes.push({ action: 'start_date_changed', oldValue: oldStart, newValue: newStart ?? null });
      }
    }
    if (dueDate !== undefined) {
      const oldDue = existing.dueDate?.toISOString() ?? null;
      const newDue = dueDate;
      if (oldDue !== newDue) {
        changes.push({ action: 'due_date_changed', oldValue: oldDue, newValue: newDue ?? null });
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        startDate: startDate === null ? null : startDate ? new Date(startDate) : undefined,
        dueDate: dueDate === null ? null : dueDate ? new Date(dueDate) : undefined,
      },
      include: taskInclude,
    });

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

  async deleteTask(userId: string, taskId: string, promoteChildren = false) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!existing) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, existing.projectId);

    if (promoteChildren) {
      // Promote direct children to top-level tasks (or to the deleted task's parent)
      await prisma.task.updateMany({
        where: { parentTaskId: taskId, deletedAt: null },
        data: {
          parentTaskId: existing.parentTaskId,
          isSubtask: existing.parentTaskId ? true : false,
          depth: existing.depth,
        },
      });
      // Soft-delete only this task
      await prisma.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
    } else {
      // Soft-delete the task and ALL nested subtasks recursively
      const allSubtaskIds = (await this.getAllSubtasksFlat(taskId)).map((s) => s.id);
      await prisma.task.updateMany({
        where: {
          id: { in: [taskId, ...allSubtaskIds] },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

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
        // Auto-add assignee as watcher
        await this.autoAddWatcher(taskId, uid);
      }

      // Emit automation event for assignee change
      resolveWorkspaceContext(taskId).then((ctx) => {
        if (ctx.workspaceId) {
          emitAutomationEvent({
            type: 'assignee_changed',
            taskId,
            userId,
            data: { action: 'added', userIds: newIds },
            workspaceId: ctx.workspaceId,
            spaceId: ctx.spaceId,
            listId: ctx.listId,
          });
        }
      }).catch(() => {});
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

    // Emit automation event for assignee removal
    resolveWorkspaceContext(taskId).then((ctx) => {
      if (ctx.workspaceId) {
        emitAutomationEvent({
          type: 'assignee_changed',
          taskId,
          userId,
          data: { action: 'removed', userIds: [targetUserId] },
          workspaceId: ctx.workspaceId,
          spaceId: ctx.spaceId,
          listId: ctx.listId,
        });
      }
    }).catch(() => {});

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

    // Auto-add commenter as watcher
    await this.autoAddWatcher(taskId, userId);

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
  // BULK ACTION (v2 — flexible actions)
  // ==================================

  async bulkAction(
    userId: string,
    input: BulkActionInput,
  ): Promise<{ successCount: number; failedCount: number; failures: Array<{ taskId: string; error: string }> }> {
    const { taskIds, action, payload } = input;
    const failures: Array<{ taskId: string; error: string }> = [];
    let successCount = 0;

    for (const taskId of taskIds) {
      try {
        const task = await prisma.task.findFirst({
          where: { id: taskId, deletedAt: null },
        });
        if (!task) {
          failures.push({ taskId, error: 'Task not found' });
          continue;
        }

        // Verify membership once per unique project (cached implicitly by Prisma)
        await this.requireProjectMembership(userId, task.projectId);

        switch (action) {
          case 'update_status': {
            const statusName = (payload as any).statusName as string | undefined;
            const statusColor = (payload as any).statusColor as string | undefined;
            const statusEnum = (payload as any).status as string | undefined;
            const updateData: Record<string, unknown> = {};
            if (statusName !== undefined) updateData.statusName = statusName;
            if (statusColor !== undefined) updateData.statusColor = statusColor;
            if (statusEnum !== undefined) updateData.status = statusEnum;
            await prisma.task.update({ where: { id: taskId }, data: updateData });
            await this.logActivity(taskId, userId, 'status_changed', task.status, statusEnum ?? statusName ?? task.status);
            break;
          }
          case 'update_priority': {
            const priority = (payload as any).priority as string;
            await prisma.task.update({ where: { id: taskId }, data: { priority: priority as any } });
            await this.logActivity(taskId, userId, 'priority_changed', task.priority, priority);
            break;
          }
          case 'assign': {
            const assigneeId = (payload as any).assigneeId as string;
            const existing = await prisma.taskAssignee.findFirst({
              where: { taskId, userId: assigneeId },
            });
            if (!existing) {
              await prisma.taskAssignee.create({ data: { taskId, userId: assigneeId } });
            }
            break;
          }
          case 'unassign': {
            const unassignId = (payload as any).assigneeId as string;
            await prisma.taskAssignee.deleteMany({ where: { taskId, userId: unassignId } });
            break;
          }
          case 'add_label': {
            const labelId = (payload as any).labelId as string;
            const existingLabel = await prisma.taskLabel.findFirst({
              where: { taskId, labelId },
            });
            if (!existingLabel) {
              await prisma.taskLabel.create({ data: { taskId, labelId } });
            }
            break;
          }
          case 'remove_label': {
            const removeLabelId = (payload as any).labelId as string;
            await prisma.taskLabel.deleteMany({ where: { taskId, labelId: removeLabelId } });
            break;
          }
          case 'set_due_date': {
            const dueDate = (payload as any).dueDate as string | null;
            await prisma.task.update({
              where: { id: taskId },
              data: { dueDate: dueDate ? new Date(dueDate) : null },
            });
            await this.logActivity(taskId, userId, 'due_date_changed', task.dueDate?.toISOString() ?? null, dueDate);
            break;
          }
          case 'move': {
            const targetListId = (payload as any).targetListId as string;
            await prisma.task.update({
              where: { id: taskId },
              data: { listId: targetListId },
            });
            break;
          }
          case 'duplicate': {
            const customTaskId = await generateCustomTaskId(task.listId);
            await prisma.task.create({
              data: {
                projectId: task.projectId,
                listId: task.listId,
                title: `${task.title} (copy)`,
                descriptionHtml: task.descriptionHtml,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                position: task.position + 1,
                parentTaskId: task.parentTaskId,
                isSubtask: task.isSubtask,
                depth: task.depth,
                createdById: userId,
                statusName: task.statusName,
                statusColor: task.statusColor,
                customTaskId,
              },
            });
            break;
          }
          case 'delete': {
            await prisma.task.update({
              where: { id: taskId },
              data: { deletedAt: new Date() },
            });
            await this.logActivity(taskId, userId, 'deleted', null, null);
            break;
          }
          case 'archive': {
            await prisma.task.update({
              where: { id: taskId },
              data: { deletedAt: new Date() },
            });
            await this.logActivity(taskId, userId, 'archived', null, null);
            break;
          }
          case 'set_custom_field': {
            const fieldId = (payload as any).fieldId as string;
            const value = (payload as any).value;
            const fieldData: Record<string, unknown> = {};
            if (typeof value === 'string') fieldData.valueText = value;
            else if (typeof value === 'number') fieldData.valueNumber = value;
            else if (typeof value === 'boolean') fieldData.valueBoolean = value;
            else fieldData.valueJson = value;
            await prisma.customFieldValue.upsert({
              where: { fieldId_taskId: { fieldId, taskId } },
              create: { taskId, fieldId, ...fieldData },
              update: fieldData,
            });
            break;
          }
          default:
            failures.push({ taskId, error: `Unknown action: ${action}` });
            continue;
        }
        successCount++;
      } catch (err: any) {
        failures.push({ taskId, error: err.message ?? 'Unknown error' });
      }
    }

    return { successCount, failedCount: failures.length, failures };
  }

  // ==================================
  // SUBTASK OPERATIONS
  // ==================================

  async getSubtasks(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const subtasks = await prisma.task.findMany({
      where: { parentTaskId: taskId, deletedAt: null },
      include: taskInclude,
      orderBy: { position: 'asc' },
    });

    return subtasks;
  }

  async getAllSubtasksRecursive(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const flatList = await this.getAllSubtasksFlat(taskId);
    return flatList;
  }

  async createSubtask(userId: string, parentTaskId: string, input: CreateSubtaskInput) {
    const parent = await prisma.task.findFirst({
      where: { id: parentTaskId, deletedAt: null },
      select: { id: true, projectId: true, depth: true, listId: true },
    });
    if (!parent) {
      throw new AppError(404, 'Parent task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, parent.projectId);

    const newDepth = parent.depth + 1;
    if (newDepth > 10) {
      throw new AppError(400, 'Maximum subtask depth of 10 levels exceeded', 'MAX_DEPTH_EXCEEDED');
    }

    // Calculate position
    const lastSubtask = await prisma.task.findFirst({
      where: { parentTaskId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastSubtask?.position ?? 0) + 65536;

    // Generate custom task ID if the task belongs to a space with a prefix
    const customTaskId = await generateCustomTaskId(parent.listId);

    const subtask = await prisma.task.create({
      data: {
        projectId: parent.projectId,
        title: input.title,
        descriptionHtml: input.description,
        priority: input.priority ?? 'NONE',
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        statusName: input.statusName,
        parentTaskId,
        isSubtask: true,
        depth: newDepth,
        listId: parent.listId,
        position,
        status: 'TODO',
        createdById: userId,
        customTaskId,
        assignees: input.assigneeIds?.length
          ? { create: input.assigneeIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
      include: taskInclude,
    });

    await this.logActivity(subtask.id, userId, 'created', null, null);
    return subtask;
  }

  async convertToSubtask(userId: string, taskId: string, newParentTaskId: string) {
    if (taskId === newParentTaskId) {
      throw new AppError(400, 'A task cannot be a subtask of itself', 'SELF_REFERENCE');
    }

    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const parent = await prisma.task.findFirst({
      where: { id: newParentTaskId, deletedAt: null },
      select: { id: true, projectId: true, depth: true, listId: true },
    });
    if (!parent) {
      throw new AppError(404, 'Parent task not found', 'NOT_FOUND');
    }
    if (parent.projectId !== task.projectId) {
      throw new AppError(400, 'Parent task must be in the same project', 'INVALID_PARENT');
    }

    // Prevent circular: check if newParentTaskId is a descendant of taskId
    const isDescendant = await this.isDescendantOf(newParentTaskId, taskId);
    if (isDescendant) {
      throw new AppError(400, 'Cannot make a task a subtask of its own descendant (circular reference)', 'CIRCULAR_REFERENCE');
    }

    const newDepth = parent.depth + 1;
    if (newDepth > 10) {
      throw new AppError(400, 'Maximum subtask depth of 10 levels exceeded', 'MAX_DEPTH_EXCEEDED');
    }

    // Update this task
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        parentTaskId: newParentTaskId,
        isSubtask: true,
        depth: newDepth,
        listId: parent.listId,
      },
      include: taskInclude,
    });

    // Recursively update depth of all descendants
    await this.updateDescendantDepths(taskId, newDepth);

    await this.logActivity(taskId, userId, 'converted_to_subtask', null, newParentTaskId);
    return updated;
  }

  async convertToTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!task) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    await this.requireProjectMembership(userId, task.projectId);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        parentTaskId: null,
        isSubtask: false,
        depth: 0,
      },
      include: taskInclude,
    });

    // Recursively update depth of all descendants
    await this.updateDescendantDepths(taskId, 0);

    await this.logActivity(taskId, userId, 'converted_to_task', null, null);
    return updated;
  }

  async moveSubtask(userId: string, taskId: string, newParentTaskId: string) {
    if (taskId === newParentTaskId) {
      throw new AppError(400, 'A task cannot be a subtask of itself', 'SELF_REFERENCE');
    }

    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    const newParent = await prisma.task.findFirst({
      where: { id: newParentTaskId, deletedAt: null },
      select: { id: true, projectId: true, depth: true, listId: true },
    });
    if (!newParent) {
      throw new AppError(404, 'New parent task not found', 'NOT_FOUND');
    }
    if (newParent.projectId !== task.projectId) {
      throw new AppError(400, 'New parent must be in the same project', 'INVALID_PARENT');
    }

    // Prevent circular reference
    const isDescendant = await this.isDescendantOf(newParentTaskId, taskId);
    if (isDescendant) {
      throw new AppError(400, 'Cannot move a task under its own descendant (circular reference)', 'CIRCULAR_REFERENCE');
    }

    const newDepth = newParent.depth + 1;
    if (newDepth > 10) {
      throw new AppError(400, 'Maximum subtask depth of 10 levels exceeded', 'MAX_DEPTH_EXCEEDED');
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        parentTaskId: newParentTaskId,
        isSubtask: true,
        depth: newDepth,
      },
      include: taskInclude,
    });

    // Recursively update depth of all descendants
    await this.updateDescendantDepths(taskId, newDepth);

    await this.logActivity(taskId, userId, 'moved_subtask', null, newParentTaskId);
    return updated;
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

  /**
   * Get all subtasks recursively as a flat list (used internally and for the recursive endpoint).
   */
  private async getAllSubtasksFlat(taskId: string): Promise<Array<{ id: string; title: string; status: string; depth: number; parentTaskId: string | null }>> {
    const result: Array<{ id: string; title: string; status: string; depth: number; parentTaskId: string | null }> = [];
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await prisma.task.findMany({
        where: { parentTaskId: currentId, deletedAt: null },
        select: { id: true, title: true, status: true, depth: true, parentTaskId: true },
        orderBy: { position: 'asc' },
      });

      for (const child of children) {
        result.push(child);
        queue.push(child.id);
      }
    }

    return result;
  }

  /**
   * Check if `potentialDescendantId` is a descendant of `ancestorId` in the subtask tree.
   */
  private async isDescendantOf(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [ancestorId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = await prisma.task.findMany({
        where: { parentTaskId: currentId, deletedAt: null },
        select: { id: true },
      });

      for (const child of children) {
        if (child.id === potentialDescendantId) return true;
        queue.push(child.id);
      }
    }

    return false;
  }

  /**
   * Recursively update the depth of all descendants when a task moves.
   */
  private async updateDescendantDepths(parentId: string, parentDepth: number): Promise<void> {
    const children = await prisma.task.findMany({
      where: { parentTaskId: parentId, deletedAt: null },
      select: { id: true },
    });

    for (const child of children) {
      const childDepth = parentDepth + 1;
      await prisma.task.update({
        where: { id: child.id },
        data: { depth: childDepth },
      });
      await this.updateDescendantDepths(child.id, childDepth);
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

  // ==========================================
  // TASK WATCHERS
  // ==========================================

  async watchTask(taskId: string, userId: string) {
    await this.getTaskOrThrow(taskId);
    const existing = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    if (existing) return existing;
    return prisma.taskWatcher.create({ data: { taskId, userId } });
  }

  async unwatchTask(taskId: string, userId: string) {
    const existing = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    if (!existing) {
      throw new AppError(404, 'Not watching this task', 'NOT_FOUND');
    }
    await prisma.taskWatcher.delete({ where: { id: existing.id } });
  }

  async getWatchers(taskId: string) {
    await this.getTaskOrThrow(taskId);
    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
    });
    return watchers.map((w) => ({ watcherId: w.id, userId: w.userId, createdAt: w.createdAt, displayName: w.user.displayName, avatarUrl: w.user.avatarUrl, username: w.user.username }));
  }

  async isWatching(taskId: string, userId: string): Promise<boolean> {
    const watcher = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    return !!watcher;
  }

  async autoAddWatcher(taskId: string, userId: string) {
    const existing = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
    if (!existing) {
      await prisma.taskWatcher.create({ data: { taskId, userId } });
    }
  }

  // ==================================
  // COVER IMAGE
  // ==================================

  async setCoverImage(userId: string, taskId: string, file: Express.Multer.File) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Build a URL path relative to storage
    const relativePath = `covers/${path.basename(file.path)}`;
    const urlPath = `/storage/${relativePath}`;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { coverImageUrl: urlPath, coverImageColor: null },
      include: taskInclude,
    });

    return updated;
  }

  async removeCoverImage(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Optionally delete the file from disk
    const existing = await prisma.task.findUnique({ where: { id: taskId }, select: { coverImageUrl: true } });
    if (existing?.coverImageUrl && existing.coverImageUrl.startsWith('/storage/covers/')) {
      const filePath = path.resolve(config.storage.path, existing.coverImageUrl.replace('/storage/', ''));
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { coverImageUrl: null },
      include: taskInclude,
    });

    return updated;
  }

  async setCoverColor(userId: string, taskId: string, color: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Validate hex color
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new AppError(400, 'Invalid hex color format', 'INVALID_COLOR');
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { coverImageColor: color, coverImageUrl: null },
      include: taskInclude,
    });

    return updated;
  }

  // ==================================
  // TIME ESTIMATES
  // ==================================

  async setTimeEstimate(userId: string, taskId: string, minutes: number) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    if (minutes < 0) {
      throw new AppError(400, 'Minutes must be non-negative', 'INVALID_INPUT');
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { timeEstimate: minutes },
      include: taskInclude,
    });

    return updated;
  }

  async setUserTimeEstimate(userId: string, taskId: string, targetUserId: string, minutes: number) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    if (minutes < 0) {
      throw new AppError(400, 'Minutes must be non-negative', 'INVALID_INPUT');
    }

    const estimate = await prisma.taskTimeEstimate.upsert({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      create: { taskId, userId: targetUserId, estimatedMinutes: minutes },
      update: { estimatedMinutes: minutes },
      include: { user: { select: userSelect } },
    });

    return estimate;
  }

  async removeUserTimeEstimate(userId: string, taskId: string, targetUserId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    await prisma.taskTimeEstimate.deleteMany({
      where: { taskId, userId: targetUserId },
    });
  }

  async getTimeSummary(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.requireProjectMembership(userId, task.projectId);

    // Get task-level estimate
    const taskData = await prisma.task.findUnique({
      where: { id: taskId },
      select: { timeEstimate: true },
    });

    // Get per-user estimates
    const userEstimates = await prisma.taskTimeEstimate.findMany({
      where: { taskId },
      include: { user: { select: userSelect } },
    });

    // Get tracked time per user
    const timeEntries = await prisma.timeEntry.findMany({
      where: { taskId, endedAt: { not: null } },
      include: { user: { select: userSelect } },
    });

    // Aggregate tracked time per user
    const trackedByUser: Record<string, { userId: string; displayName: string; minutes: number }> = {};
    let trackedTotal = 0;
    for (const entry of timeEntries) {
      const mins = entry.durationMinutes ?? 0;
      trackedTotal += mins;
      if (!trackedByUser[entry.userId]) {
        trackedByUser[entry.userId] = {
          userId: entry.userId,
          displayName: entry.user.displayName,
          minutes: 0,
        };
      }
      trackedByUser[entry.userId].minutes += mins;
    }

    const estimatedTotal = taskData?.timeEstimate ?? 0;
    const remaining = Math.max(0, estimatedTotal - trackedTotal);
    const percentComplete = estimatedTotal > 0
      ? Math.round((trackedTotal / estimatedTotal) * 1000) / 10
      : 0;

    return {
      estimated: {
        total: estimatedTotal,
        perUser: userEstimates.map((ue) => ({
          userId: ue.userId,
          displayName: ue.user.displayName,
          minutes: ue.estimatedMinutes,
        })),
      },
      tracked: {
        total: trackedTotal,
        perUser: Object.values(trackedByUser),
      },
      remaining,
      percentComplete,
    };
  }
}

export const tasksService = new TasksService();
