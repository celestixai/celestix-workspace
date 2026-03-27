import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { automationEngine } from './automations.engine';
import type { CreateAutomationInput, UpdateAutomationInput } from './automations.validation';
import type { HierarchyLevel } from '@prisma/client';

export class AutomationsService {
  /**
   * List automations for a workspace, optionally filtered by location.
   */
  async getAutomations(
    workspaceId: string,
    filters?: { locationId?: string; locationType?: string; isActive?: boolean },
  ) {
    const where: any = { workspaceId };
    if (filters?.locationId) where.locationId = filters.locationId;
    if (filters?.locationType) where.locationType = filters.locationType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.automation.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get automations at a specific location.
   */
  async getAutomationsAtLocation(locationType: string, locationId: string) {
    return prisma.automation.findMany({
      where: {
        locationType: locationType as HierarchyLevel,
        locationId,
        isActive: true,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new automation.
   */
  async createAutomation(userId: string, data: CreateAutomationInput) {
    return prisma.automation.create({
      data: {
        workspaceId: data.workspaceId,
        locationId: data.locationId,
        locationType: data.locationType as HierarchyLevel | undefined,
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        trigger: data.trigger as any,
        conditions: data.conditions ?? undefined,
        actions: data.actions as any,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Get a single automation with its recent logs (last 10).
   */
  async getAutomation(automationId: string) {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        logs: {
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!automation) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    return automation;
  }

  /**
   * Update an automation.
   */
  async updateAutomation(automationId: string, data: UpdateAutomationInput) {
    const existing = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!existing) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    return prisma.automation.update({
      where: { id: automationId },
      data: {
        name: data.name,
        description: data.description,
        locationId: data.locationId,
        locationType: data.locationType as HierarchyLevel | undefined,
        trigger: data.trigger ? (data.trigger as any) : undefined,
        conditions: data.conditions !== undefined ? (data.conditions ?? null) : undefined,
        actions: data.actions ? (data.actions as any) : undefined,
        isActive: data.isActive,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Delete an automation.
   */
  async deleteAutomation(automationId: string) {
    const existing = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!existing) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    await prisma.automation.delete({ where: { id: automationId } });
    return { success: true };
  }

  /**
   * Toggle isActive on an automation.
   */
  async toggleAutomation(automationId: string) {
    const existing = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!existing) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    return prisma.automation.update({
      where: { id: automationId },
      data: { isActive: !existing.isActive },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Dry-run: evaluate trigger+conditions against a task, return what would happen.
   */
  async testAutomation(automationId: string, taskId: string) {
    const automation = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!automation) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    return automationEngine.testAutomation(automation, taskId);
  }

  /**
   * Paginated automation logs.
   */
  async getAutomationLogs(automationId: string, limit = 20, cursor?: string) {
    const existing = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!existing) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    const logs = await prisma.automationLog.findMany({
      where: { automationId },
      orderBy: { executedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return { items, nextCursor, hasMore };
  }

  /**
   * Pre-built automation templates.
   */
  getTemplates() {
    return [
      {
        id: 'template-subtasks-done',
        name: 'Move to Done when all subtasks complete',
        description: 'Automatically mark a task as Done when all its subtasks are completed.',
        trigger: { type: 'subtask_completed', config: {} },
        conditions: null,
        actions: [
          {
            type: 'change_status',
            config: { statusEnum: 'DONE', statusName: 'Done' },
          },
        ],
      },
      {
        id: 'template-urgent-notify',
        name: 'Notify team when priority is Urgent',
        description: 'Send a notification to team members when a task priority is set to Urgent.',
        trigger: { type: 'priority_changed', config: {} },
        conditions: { priority: 'URGENT' },
        actions: [
          {
            type: 'send_notification',
            config: { userIds: [], message: 'A task has been marked as Urgent!' },
          },
        ],
      },
      {
        id: 'template-due-date-on-create',
        name: 'Set due date on task creation',
        description: 'Automatically set a due date 7 days from now when a task is created.',
        trigger: { type: 'task_created', config: {} },
        conditions: null,
        actions: [
          {
            type: 'set_due_date',
            config: { relative: '+7d' },
          },
        ],
      },
      {
        id: 'template-auto-assign-in-progress',
        name: 'Auto-assign on status change to In Progress',
        description: 'Automatically assign a user when a task moves to In Progress.',
        trigger: { type: 'status_changed', config: { toStatus: 'IN_PROGRESS' } },
        conditions: null,
        actions: [
          {
            type: 'add_assignee',
            config: { userId: '' },
          },
        ],
      },
    ];
  }
}

export const automationsService = new AutomationsService();
