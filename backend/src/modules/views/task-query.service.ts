import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { TaskQueryInput } from './views.validation';

// Shared user select
const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

// Standard task include for query results
const taskInclude = {
  createdBy: { select: userSelect },
  assignees: { include: { user: { select: userSelect } } },
  labels: { include: { label: true } },
  subtasks: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true, statusName: true },
    orderBy: { position: 'asc' as const },
  },
  parentTask: { select: { id: true, title: true } },
  list: { select: { id: true, name: true, spaceId: true } },
  taskTypeRelation: { select: { id: true, name: true, icon: true, color: true } },
  customFieldValues: {
    include: { field: { select: { id: true, name: true, fieldType: true } } },
  },
  workspaceTags: { include: { tag: true } },
  _count: { select: { comments: true, subtasks: true } },
} as const;

interface TaskGroup {
  name: string;
  value: string | null;
  count: number;
  tasks: any[];
}

interface QueryResult {
  tasks?: any[];
  groups?: TaskGroup[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class TaskQueryService {
  /**
   * Main entry point: execute a task query with location scoping, filters,
   * sorting, grouping, and pagination.
   */
  async executeQuery(params: TaskQueryInput): Promise<QueryResult> {
    const {
      locationType,
      locationId,
      workspaceId,
      filters,
      sorts,
      groupBy,
      search,
      showSubtasks = true,
      showClosedTasks = false,
      page = 1,
      limit = 50,
    } = params;

    // 1. Resolve location scope to get list IDs
    const listIds = await this.resolveLocationScope(locationType, locationId, workspaceId);

    // 2. Build the base where clause
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
    };

    // Scope to lists
    if (listIds !== null) {
      where.listId = { in: listIds };
    }

    // Subtask handling
    if (!showSubtasks) {
      where.OR = [
        { isSubtask: false },
        { parentTaskId: null },
      ];
    }

    // Closed task handling — filter out DONE/CLOSED status groups
    if (!showClosedTasks) {
      // We need to exclude tasks whose statusName maps to DONE or CLOSED status groups.
      // Since the task stores statusName directly, we look up the statuses in the
      // lists' status definitions and exclude those in DONE/CLOSED groups.
      if (listIds && listIds.length > 0) {
        const closedStatuses = await prisma.listStatus.findMany({
          where: {
            listId: { in: listIds },
            statusGroup: { in: ['DONE', 'CLOSED'] },
          },
          select: { name: true },
        });
        const closedNames = [...new Set(closedStatuses.map((s) => s.name))];
        if (closedNames.length > 0) {
          where.statusName = { notIn: closedNames };
        }
      }
      // Also exclude the built-in DONE status
      where.status = { not: 'DONE' };
    }

    // 3. Apply filters from the filter JSON
    if (filters) {
      this.applyFilters(where, filters);
    }

    // Search
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    // Date range (for calendar/gantt views)
    if (params.startDate || params.endDate) {
      where.dueDate = {};
      if (params.startDate) {
        where.dueDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.dueDate.lte = new Date(params.endDate);
      }
    }

    // 4. Build orderBy
    const orderBy = this.buildOrderBy(sorts);

    // 5. If groupBy is set, return grouped results
    if (groupBy) {
      return this.executeGroupedQuery(where, orderBy, groupBy, page, limit);
    }

    // 6. Execute paginated query
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      hasMore: skip + tasks.length < total,
    };
  }

  /**
   * Resolve location to an array of list IDs that contain the tasks.
   * Returns null if no location scoping is needed (all workspace tasks).
   */
  private async resolveLocationScope(
    locationType?: string,
    locationId?: string,
    workspaceId?: string,
  ): Promise<string[] | null> {
    if (!locationType || !locationId) {
      // No location specified — if we have workspaceId, get all lists in workspace
      if (workspaceId) {
        const spaces = await prisma.space.findMany({
          where: { workspaceId, deletedAt: null },
          select: { id: true },
        });
        const spaceIds = spaces.map((s) => s.id);
        if (spaceIds.length === 0) return [];

        const lists = await prisma.taskList.findMany({
          where: { spaceId: { in: spaceIds }, deletedAt: null },
          select: { id: true },
        });
        return lists.map((l) => l.id);
      }
      return null;
    }

    switch (locationType) {
      case 'LIST': {
        return [locationId];
      }

      case 'FOLDER': {
        // Get all lists in this folder (including subfolder lists)
        const listIds = await this.getListsInFolder(locationId);
        return listIds;
      }

      case 'SPACE': {
        // Get all lists in the space
        const lists = await prisma.taskList.findMany({
          where: { spaceId: locationId, deletedAt: null },
          select: { id: true },
        });
        return lists.map((l) => l.id);
      }

      case 'WORKSPACE': {
        // Get all lists in all spaces of the workspace
        const spaces = await prisma.space.findMany({
          where: { workspaceId: locationId, deletedAt: null },
          select: { id: true },
        });
        const spaceIds = spaces.map((s) => s.id);
        if (spaceIds.length === 0) return [];

        const lists = await prisma.taskList.findMany({
          where: { spaceId: { in: spaceIds }, deletedAt: null },
          select: { id: true },
        });
        return lists.map((l) => l.id);
      }

      default:
        return null;
    }
  }

  /**
   * Recursively get all list IDs within a folder (including subfolders).
   */
  private async getListsInFolder(folderId: string): Promise<string[]> {
    // Direct lists
    const directLists = await prisma.taskList.findMany({
      where: { folderId, deletedAt: null },
      select: { id: true },
    });

    // Subfolders
    const subfolders = await prisma.folder.findMany({
      where: { parentFolderId: folderId, deletedAt: null },
      select: { id: true },
    });

    let listIds = directLists.map((l) => l.id);

    // Recursively get lists from subfolders
    for (const subfolder of subfolders) {
      const subListIds = await this.getListsInFolder(subfolder.id);
      listIds = listIds.concat(subListIds);
    }

    return listIds;
  }

  /**
   * Apply filter JSON to Prisma where clause.
   * Filter format: { field: { operator: value } } or array of filter objects
   */
  private applyFilters(where: Prisma.TaskWhereInput, filters: any): void {
    if (!filters || typeof filters !== 'object') return;

    // Support array of filter conditions
    const filterArray = Array.isArray(filters) ? filters : [filters];

    for (const filter of filterArray) {
      const { field, operator, value } = filter;
      if (!field || !operator) continue;

      switch (field) {
        case 'status':
          if (operator === 'is') {
            where.statusName = Array.isArray(value) ? { in: value } : value;
          } else if (operator === 'is_not') {
            where.statusName = Array.isArray(value) ? { notIn: value } : { not: value };
          }
          break;

        case 'priority':
          if (operator === 'is') {
            where.priority = Array.isArray(value) ? { in: value } : value;
          } else if (operator === 'is_not') {
            where.priority = Array.isArray(value) ? { notIn: value } : { not: value };
          }
          break;

        case 'assignee':
          if (operator === 'is') {
            where.assignees = {
              some: { userId: Array.isArray(value) ? { in: value } : value },
            };
          } else if (operator === 'is_not') {
            where.assignees = {
              none: { userId: Array.isArray(value) ? { in: value } : value },
            };
          }
          break;

        case 'dueDate':
          this.applyDateFilter(where, operator, value);
          break;

        case 'tags':
          if (operator === 'contains') {
            where.workspaceTags = {
              some: { tagId: Array.isArray(value) ? { in: value } : value },
            };
          }
          break;

        case 'taskType':
          if (operator === 'is') {
            where.taskTypeId = Array.isArray(value) ? { in: value } : value;
          }
          break;

        default:
          // Check for custom field filter: "customField:fieldId"
          if (field.startsWith('customField:')) {
            const fieldId = field.split(':')[1];
            this.applyCustomFieldFilter(where, fieldId, operator, value);
          }
          break;
      }
    }
  }

  private applyDateFilter(where: Prisma.TaskWhereInput, operator: string, value: any): void {
    switch (operator) {
      case 'is_before':
        where.dueDate = { lt: new Date(value) };
        break;
      case 'is_after':
        where.dueDate = { gt: new Date(value) };
        break;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          where.dueDate = { gte: new Date(value[0]), lte: new Date(value[1]) };
        }
        break;
      case 'is_within': {
        // value is like "7d", "30d", "1w", "1m"
        const now = new Date();
        const end = new Date(now);
        const match = String(value).match(/^(\d+)([dwm])$/);
        if (match) {
          const num = parseInt(match[1], 10);
          const unit = match[2];
          if (unit === 'd') end.setDate(end.getDate() + num);
          else if (unit === 'w') end.setDate(end.getDate() + num * 7);
          else if (unit === 'm') end.setMonth(end.getMonth() + num);
          where.dueDate = { gte: now, lte: end };
        }
        break;
      }
    }
  }

  private applyCustomFieldFilter(
    where: Prisma.TaskWhereInput,
    fieldId: string,
    operator: string,
    value: any,
  ): void {
    if (operator === 'is') {
      where.customFieldValues = {
        some: {
          fieldId,
          OR: [
            { valueText: typeof value === 'string' ? value : undefined },
            { valueNumber: typeof value === 'number' ? value : undefined },
          ],
        },
      };
    }
  }

  /**
   * Build Prisma orderBy from sorts array.
   */
  private buildOrderBy(
    sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>,
  ): Prisma.TaskOrderByWithRelationInput[] {
    if (!sorts || sorts.length === 0) {
      return [{ position: 'asc' }, { createdAt: 'desc' }];
    }

    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];

    for (const sort of sorts) {
      switch (sort.field) {
        case 'title':
          orderBy.push({ title: sort.direction });
          break;
        case 'status':
          orderBy.push({ statusName: sort.direction });
          break;
        case 'priority':
          orderBy.push({ priority: sort.direction });
          break;
        case 'dueDate':
          orderBy.push({ dueDate: sort.direction });
          break;
        case 'startDate':
          orderBy.push({ startDate: sort.direction });
          break;
        case 'createdAt':
          orderBy.push({ createdAt: sort.direction });
          break;
        case 'updatedAt':
          orderBy.push({ updatedAt: sort.direction });
          break;
        case 'position':
          orderBy.push({ position: sort.direction });
          break;
        default:
          // fallback: try using the field name directly
          orderBy.push({ [sort.field]: sort.direction } as any);
          break;
      }
    }

    return orderBy;
  }

  /**
   * Execute a grouped query, returning tasks organized by group.
   */
  private async executeGroupedQuery(
    where: Prisma.TaskWhereInput,
    orderBy: Prisma.TaskOrderByWithRelationInput[],
    groupBy: string,
    page: number,
    limit: number,
  ): Promise<QueryResult> {
    // Get all matching tasks (we need them to group)
    const allTasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy,
    });

    const groups: TaskGroup[] = [];
    const groupMap = new Map<string | null, any[]>();

    for (const task of allTasks) {
      const groupValues = this.getGroupValue(task, groupBy);

      // A task can appear in multiple groups (e.g., multiple assignees)
      for (const gv of groupValues) {
        const key = gv.value;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(task);
      }
    }

    // Convert map to array of groups
    for (const [value, tasks] of groupMap) {
      groups.push({
        name: this.getGroupName(groupBy, value, tasks[0]),
        value,
        count: tasks.length,
        tasks: tasks.slice((page - 1) * limit, page * limit),
      });
    }

    // Sort groups: for status, keep the natural status order; otherwise alphabetical
    if (groupBy === 'priority') {
      const priorityOrder = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
      groups.sort((a, b) => {
        const ai = priorityOrder.indexOf(a.value ?? 'NONE');
        const bi = priorityOrder.indexOf(b.value ?? 'NONE');
        return ai - bi;
      });
    } else {
      groups.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }

    return {
      groups,
      total: allTasks.length,
      page,
      limit,
      hasMore: false, // all groups returned
    };
  }

  /**
   * Get group value(s) for a task. Returns an array because some fields (like
   * assignees, tags) can have multiple values.
   */
  private getGroupValue(task: any, groupBy: string): Array<{ value: string | null }> {
    switch (groupBy) {
      case 'status':
        return [{ value: task.statusName ?? task.status ?? null }];

      case 'priority':
        return [{ value: task.priority ?? null }];

      case 'assignee':
        if (task.assignees && task.assignees.length > 0) {
          return task.assignees.map((a: any) => ({ value: a.user?.id ?? a.userId }));
        }
        return [{ value: null }];

      case 'tag':
        if (task.workspaceTags && task.workspaceTags.length > 0) {
          return task.workspaceTags.map((t: any) => ({ value: t.tag?.id ?? t.tagId }));
        }
        return [{ value: null }];

      case 'taskType':
        return [{ value: task.taskTypeId ?? null }];

      case 'dueDate':
        if (task.dueDate) {
          const d = new Date(task.dueDate);
          return [{ value: d.toISOString().split('T')[0] }]; // group by day
        }
        return [{ value: null }];

      case 'list':
        return [{ value: task.listId ?? null }];

      default:
        return [{ value: null }];
    }
  }

  /**
   * Get a display name for a group.
   */
  private getGroupName(groupBy: string, value: string | null, sampleTask?: any): string {
    if (value === null) return 'None';

    switch (groupBy) {
      case 'status':
        return value;
      case 'priority':
        return value;
      case 'assignee':
        if (sampleTask?.assignees) {
          const assignee = sampleTask.assignees.find((a: any) => (a.user?.id ?? a.userId) === value);
          return assignee?.user?.displayName ?? value;
        }
        return value;
      case 'tag':
        if (sampleTask?.workspaceTags) {
          const tag = sampleTask.workspaceTags.find((t: any) => (t.tag?.id ?? t.tagId) === value);
          return tag?.tag?.name ?? value;
        }
        return value;
      case 'taskType':
        return sampleTask?.taskTypeRelation?.name ?? value;
      case 'dueDate':
        return value; // already a date string
      case 'list':
        return sampleTask?.list?.name ?? value;
      default:
        return value;
    }
  }

  /**
   * Get workload data: for each assignee, aggregate task counts and time
   * estimates across weekly periods.
   */
  async getWorkloadData(
    workspaceId: string,
    startDate: string,
    endDate: string,
    assigneeIds?: string[],
  ): Promise<{
    users: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      periods: Array<{
        start: string;
        end: string;
        taskCount: number;
        totalEstimateMinutes: number;
        capacityMinutes: number;
      }>;
    }>;
  }> {
    // 1. Resolve all lists in workspace
    const spaces = await prisma.space.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    });
    const spaceIds = spaces.map((s) => s.id);
    if (spaceIds.length === 0) return { users: [] };

    const lists = await prisma.taskList.findMany({
      where: { spaceId: { in: spaceIds }, deletedAt: null },
      select: { id: true },
    });
    const listIds = lists.map((l) => l.id);
    if (listIds.length === 0) return { users: [] };

    // 2. Fetch tasks in range with assignees
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      listId: { in: listIds },
      dueDate: { gte: rangeStart, lte: rangeEnd },
    };

    if (assigneeIds && assigneeIds.length > 0) {
      where.assignees = { some: { userId: { in: assigneeIds } } };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // 3. Build weekly periods
    const periods: Array<{ start: Date; end: Date }> = [];
    const cursor = new Date(rangeStart);
    // Align to Monday
    const dow = cursor.getDay();
    cursor.setDate(cursor.getDate() - (dow === 0 ? 6 : dow - 1));
    cursor.setHours(0, 0, 0, 0);

    while (cursor < rangeEnd) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      periods.push({ start: weekStart, end: weekEnd });
      cursor.setDate(cursor.getDate() + 7);
    }

    // 4. Collect all unique assignees
    const userMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
    for (const task of tasks) {
      for (const a of task.assignees) {
        if (!userMap.has(a.user.id)) {
          userMap.set(a.user.id, {
            displayName: a.user.displayName,
            avatarUrl: a.user.avatarUrl,
          });
        }
      }
    }

    // Also include unassigned tasks under a virtual user
    const hasUnassigned = tasks.some((t) => t.assignees.length === 0);

    // 5. For each user, for each period, compute stats
    const DEFAULT_CAPACITY = 2400; // 40 hours * 60 minutes

    const users = Array.from(userMap.entries()).map(([userId, info]) => {
      const userPeriods = periods.map((period) => {
        const periodTasks = tasks.filter((t) => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          const inPeriod = due >= period.start && due <= period.end;
          const isAssigned = t.assignees.some((a) => a.user.id === userId);
          return inPeriod && isAssigned;
        });

        const totalEstimateMinutes = periodTasks.reduce(
          (sum, t) => sum + (t.timeEstimate ?? 0),
          0,
        );

        return {
          start: period.start.toISOString(),
          end: period.end.toISOString(),
          taskCount: periodTasks.length,
          totalEstimateMinutes,
          capacityMinutes: DEFAULT_CAPACITY,
        };
      });

      return {
        userId,
        displayName: info.displayName,
        avatarUrl: info.avatarUrl,
        periods: userPeriods,
      };
    });

    // Add unassigned row
    if (hasUnassigned) {
      const unassignedPeriods = periods.map((period) => {
        const periodTasks = tasks.filter((t) => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          const inPeriod = due >= period.start && due <= period.end;
          return inPeriod && t.assignees.length === 0;
        });

        return {
          start: period.start.toISOString(),
          end: period.end.toISOString(),
          taskCount: periodTasks.length,
          totalEstimateMinutes: periodTasks.reduce(
            (sum, t) => sum + (t.timeEstimate ?? 0),
            0,
          ),
          capacityMinutes: DEFAULT_CAPACITY,
        };
      });

      users.push({
        userId: '__unassigned__',
        displayName: 'Unassigned',
        avatarUrl: null,
        periods: unassignedPeriods,
      });
    }

    return { users };
  }
  /**
   * Get activity feed for a location scope.
   * Pulls from TaskActivity records for tasks in the given location.
   */
  async getActivityFeed(
    locationType: string,
    locationId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<{
    activities: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      userId: string;
      user: { id: string; displayName: string; avatarUrl: string | null } | null;
      action: string;
      oldValue: string | null;
      newValue: string | null;
      createdAt: Date;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    // Resolve location to list IDs
    const listIds = await this.resolveLocationScope(locationType, locationId);
    if (!listIds || listIds.length === 0) {
      return { activities: [], nextCursor: null, hasMore: false };
    }

    // Build cursor condition
    const cursorCondition = cursor
      ? { createdAt: { lt: new Date(cursor) } }
      : {};

    // Query task activities for tasks in the scoped lists
    const activities = await prisma.taskActivity.findMany({
      where: {
        task: {
          listId: { in: listIds },
          deletedAt: null,
        },
        ...cursorCondition,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to determine hasMore
      include: {
        task: { select: { id: true, title: true } },
      },
    });

    const hasMore = activities.length > limit;
    const sliced = hasMore ? activities.slice(0, limit) : activities;

    // Attach user info
    const userIds = [...new Set(sliced.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = sliced.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      taskTitle: a.task.title,
      userId: a.userId,
      user: userMap.get(a.userId) ?? null,
      action: a.action,
      oldValue: a.oldValue,
      newValue: a.newValue,
      createdAt: a.createdAt,
    }));

    const nextCursor = hasMore && sliced.length > 0
      ? sliced[sliced.length - 1].createdAt.toISOString()
      : null;

    return { activities: result, nextCursor, hasMore };
  }
}

export const taskQueryService = new TaskQueryService();
