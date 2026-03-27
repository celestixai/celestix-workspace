import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { automationEvents } from './automation-events';
import type { AutomationEvent } from './automation-events';
import type { Automation, AutomationLogStatus } from '@prisma/client';

interface ActionResult {
  type: string;
  success: boolean;
  error?: string;
}

// Cooldown tracking: automationId:taskId -> last execution timestamp
const cooldownMap = new Map<string, number>();

const MAX_CHAIN_DEPTH = 10;
const COOLDOWN_MS = 5000;

class AutomationEngine {
  /**
   * Process an event against all matching automations.
   */
  async processEvent(event: AutomationEvent): Promise<void> {
    const depth = event._depth ?? 0;
    if (depth >= MAX_CHAIN_DEPTH) {
      logger.warn(
        { event: event.type, taskId: event.taskId, depth },
        'Automation chain depth limit reached — skipping',
      );
      return;
    }

    try {
      const automations = await this.findMatchingAutomations(event);
      if (automations.length === 0) return;

      for (const automation of automations) {
        // Cooldown check
        const cooldownKey = `${automation.id}:${event.taskId}`;
        const lastExec = cooldownMap.get(cooldownKey);
        if (lastExec && Date.now() - lastExec < COOLDOWN_MS) {
          logger.debug(
            { automationId: automation.id, taskId: event.taskId },
            'Automation on cooldown — skipping',
          );
          continue;
        }
        cooldownMap.set(cooldownKey, Date.now());

        const startTime = Date.now();
        let status: AutomationLogStatus = 'SUCCESS';
        let errorMessage: string | undefined;
        let actionResults: ActionResult[] = [];

        try {
          // Evaluate conditions
          const task = await prisma.task.findUnique({
            where: { id: event.taskId },
            include: {
              assignees: { include: { user: { select: { id: true, displayName: true } } } },
              labels: { include: { label: true } },
              subtasks: { where: { deletedAt: null }, select: { id: true, status: true } },
            },
          });

          if (!task) {
            logger.warn({ taskId: event.taskId }, 'Task not found for automation');
            continue;
          }

          const conditionsMet = await this.evaluateConditions(
            automation.conditions as any,
            task,
            event,
          );
          if (!conditionsMet) continue;

          // Execute actions
          actionResults = await this.executeActions(
            automation.actions as any[],
            task,
            event.userId,
            depth,
            event,
          );

          const failedActions = actionResults.filter((r) => !r.success);
          if (failedActions.length === actionResults.length) {
            status = 'FAILURE';
            errorMessage = failedActions.map((r) => r.error).join('; ');
          } else if (failedActions.length > 0) {
            status = 'PARTIAL_FAILURE';
            errorMessage = failedActions.map((r) => r.error).join('; ');
          }
        } catch (err: any) {
          status = 'FAILURE';
          errorMessage = err.message || 'Unknown error';
          logger.error({ err, automationId: automation.id }, 'Automation execution failed');
        }

        const duration = Date.now() - startTime;

        // Log execution
        await prisma.automationLog.create({
          data: {
            automationId: automation.id,
            taskId: event.taskId,
            triggerEvent: event.type,
            actionsExecuted: actionResults as any,
            status,
            errorMessage: errorMessage ?? null,
            duration,
          },
        });

        // Update automation stats
        await prisma.automation.update({
          where: { id: automation.id },
          data: {
            executionCount: { increment: 1 },
            lastExecutedAt: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error({ err, event: event.type }, 'Error processing automation event');
    }
  }

  /**
   * Find automations matching this trigger at the task's location.
   */
  private async findMatchingAutomations(event: AutomationEvent): Promise<Automation[]> {
    const automations = await prisma.automation.findMany({
      where: {
        workspaceId: event.workspaceId,
        isActive: true,
      },
    });

    return automations.filter((a) => {
      const trigger = a.trigger as any;
      if (!trigger || trigger.type !== event.type) return false;

      // Location scoping: if automation has a locationId, only match tasks in that location
      if (a.locationId) {
        if (a.locationType === 'LIST' && event.listId !== a.locationId) return false;
        if (a.locationType === 'SPACE' && event.spaceId !== a.locationId) return false;
        // WORKSPACE and FOLDER level automations apply to all tasks in workspace
      }

      // Check trigger config for additional matching (e.g., specific status values)
      if (trigger.config) {
        if (trigger.config.toStatus && event.data?.toStatus !== trigger.config.toStatus) {
          return false;
        }
        if (trigger.config.fromStatus && event.data?.fromStatus !== trigger.config.fromStatus) {
          return false;
        }
        if (trigger.config.priority && event.data?.priority !== trigger.config.priority) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Evaluate conditions against a task.
   */
  private async evaluateConditions(
    conditions: any,
    task: any,
    event: AutomationEvent,
  ): Promise<boolean> {
    if (!conditions) return true;

    // Conditions is an object with field-level checks
    // e.g. { priority: "URGENT", status: "IN_PROGRESS" }
    if (conditions.priority && task.priority !== conditions.priority) return false;
    if (conditions.status && task.status !== conditions.status) return false;
    if (conditions.statusName && task.statusName !== conditions.statusName) return false;

    if (conditions.hasAssignees !== undefined) {
      const hasAssignees = task.assignees && task.assignees.length > 0;
      if (conditions.hasAssignees !== hasAssignees) return false;
    }

    if (conditions.hasDueDate !== undefined) {
      const hasDueDate = !!task.dueDate;
      if (conditions.hasDueDate !== hasDueDate) return false;
    }

    // Custom field conditions
    if (conditions.toStatus && event.data?.toStatus !== conditions.toStatus) return false;
    if (conditions.fromStatus && event.data?.fromStatus !== conditions.fromStatus) return false;

    return true;
  }

  /**
   * Execute actions in sequence.
   */
  private async executeActions(
    actions: any[],
    task: any,
    userId: string,
    depth: number,
    event: AutomationEvent,
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      const result = await this.executeAction(action, task, userId, depth, event);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single action.
   */
  private async executeAction(
    action: any,
    task: any,
    userId: string,
    depth: number,
    event: AutomationEvent,
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'change_status': {
          const updateData: any = {};
          if (action.config.statusEnum) {
            updateData.status = action.config.statusEnum;
          }
          if (action.config.statusName) {
            updateData.statusName = action.config.statusName;
          }
          if (action.config.statusColor) {
            updateData.statusColor = action.config.statusColor;
          }
          await prisma.task.update({ where: { id: task.id }, data: updateData });
          return { type: 'change_status', success: true };
        }

        case 'change_priority': {
          await prisma.task.update({
            where: { id: task.id },
            data: { priority: action.config.priority },
          });
          return { type: 'change_priority', success: true };
        }

        case 'add_assignee': {
          const targetUserId = action.config.userId;
          if (targetUserId) {
            const existing = await prisma.taskAssignee.findUnique({
              where: { taskId_userId: { taskId: task.id, userId: targetUserId } },
            });
            if (!existing) {
              await prisma.taskAssignee.create({
                data: { taskId: task.id, userId: targetUserId },
              });
            }
          }
          return { type: 'add_assignee', success: true };
        }

        case 'remove_assignee': {
          const removeUserId = action.config.userId;
          if (removeUserId) {
            const existing = await prisma.taskAssignee.findUnique({
              where: { taskId_userId: { taskId: task.id, userId: removeUserId } },
            });
            if (existing) {
              await prisma.taskAssignee.delete({ where: { id: existing.id } });
            }
          }
          return { type: 'remove_assignee', success: true };
        }

        case 'set_due_date': {
          let dueDate: Date;
          if (action.config.relative) {
            // Parse relative date like "+3d", "+1w"
            const match = action.config.relative.match(/^\+(\d+)([dwmh])$/);
            if (!match) throw new Error(`Invalid relative date: ${action.config.relative}`);
            const amount = parseInt(match[1], 10);
            const unit = match[2];
            dueDate = new Date();
            switch (unit) {
              case 'h':
                dueDate.setHours(dueDate.getHours() + amount);
                break;
              case 'd':
                dueDate.setDate(dueDate.getDate() + amount);
                break;
              case 'w':
                dueDate.setDate(dueDate.getDate() + amount * 7);
                break;
              case 'm':
                dueDate.setMonth(dueDate.getMonth() + amount);
                break;
            }
          } else {
            dueDate = new Date(action.config.date);
          }
          await prisma.task.update({ where: { id: task.id }, data: { dueDate } });
          return { type: 'set_due_date', success: true };
        }

        case 'add_tag': {
          const tagId = action.config.tagId;
          if (tagId) {
            const existing = await prisma.taskTag.findUnique({
              where: { taskId_tagId: { taskId: task.id, tagId } },
            });
            if (!existing) {
              await prisma.taskTag.create({ data: { taskId: task.id, tagId } });
            }
          }
          return { type: 'add_tag', success: true };
        }

        case 'remove_tag': {
          const removeTagId = action.config.tagId;
          if (removeTagId) {
            const existing = await prisma.taskTag.findUnique({
              where: { taskId_tagId: { taskId: task.id, tagId: removeTagId } },
            });
            if (existing) {
              await prisma.taskTag.delete({ where: { id: existing.id } });
            }
          }
          return { type: 'remove_tag', success: true };
        }

        case 'move_to_list': {
          await prisma.task.update({
            where: { id: task.id },
            data: { listId: action.config.listId },
          });
          return { type: 'move_to_list', success: true };
        }

        case 'create_subtask': {
          const lastSubtask = await prisma.task.findFirst({
            where: { parentTaskId: task.id, deletedAt: null },
            orderBy: { position: 'desc' },
            select: { position: true },
          });
          const position = (lastSubtask?.position ?? 0) + 65536;

          await prisma.task.create({
            data: {
              projectId: task.projectId,
              title: action.config.title || 'Subtask',
              status: action.config.status || 'TODO',
              priority: action.config.priority || 'NONE',
              parentTaskId: task.id,
              isSubtask: true,
              depth: (task.depth ?? 0) + 1,
              listId: task.listId,
              position,
              createdById: userId,
            },
          });
          return { type: 'create_subtask', success: true };
        }

        case 'set_custom_field': {
          const { fieldId, valueText, valueNumber, valueDate, valueBoolean, valueJson } = action.config;
          if (fieldId) {
            const fieldData: any = {};
            if (valueText !== undefined) fieldData.valueText = valueText;
            if (valueNumber !== undefined) fieldData.valueNumber = valueNumber;
            if (valueDate !== undefined) fieldData.valueDate = new Date(valueDate);
            if (valueBoolean !== undefined) fieldData.valueBoolean = valueBoolean;
            if (valueJson !== undefined) fieldData.valueJson = valueJson;

            await prisma.customFieldValue.upsert({
              where: { fieldId_taskId: { taskId: task.id, fieldId } },
              create: { taskId: task.id, fieldId, ...fieldData },
              update: fieldData,
            });
          }
          return { type: 'set_custom_field', success: true };
        }

        case 'send_notification': {
          const userIds: string[] = action.config.userIds || [];
          const message = action.config.message || `Automation triggered on task: ${task.title}`;
          for (const uid of userIds) {
            await prisma.notification.create({
              data: {
                userId: uid,
                senderId: userId,
                type: 'TASK_ASSIGNED',
                title: 'Automation Notification',
                body: message,
                link: `/tasks/${task.id}`,
              },
            });
          }
          return { type: 'send_notification', success: true };
        }

        case 'add_comment': {
          await prisma.taskComment.create({
            data: {
              taskId: task.id,
              userId,
              bodyHtml: action.config.bodyHtml || action.config.text || 'Automated comment',
            },
          });
          return { type: 'add_comment', success: true };
        }

        case 'archive_task': {
          await prisma.task.update({
            where: { id: task.id },
            data: { deletedAt: new Date() },
          });
          return { type: 'archive_task', success: true };
        }

        case 'duplicate_task': {
          const lastTask = await prisma.task.findFirst({
            where: { projectId: task.projectId, deletedAt: null },
            orderBy: { position: 'desc' },
            select: { position: true },
          });
          const newPosition = (lastTask?.position ?? 0) + 65536;

          await prisma.task.create({
            data: {
              projectId: task.projectId,
              title: `${task.title} (copy)`,
              descriptionHtml: task.descriptionHtml,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              listId: task.listId,
              statusName: task.statusName,
              statusColor: task.statusColor,
              position: newPosition,
              createdById: userId,
            },
          });
          return { type: 'duplicate_task', success: true };
        }

        default:
          return { type: action.type, success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (err: any) {
      logger.error({ err, actionType: action.type, taskId: task.id }, 'Action execution failed');
      return { type: action.type, success: false, error: err.message || 'Action failed' };
    }
  }

  /**
   * Dry-run: evaluate trigger+conditions against a task and return what would happen.
   */
  async testAutomation(
    automation: Automation,
    taskId: string,
  ): Promise<{ wouldTrigger: boolean; conditionsMet: boolean; actions: any[] }> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { include: { user: { select: { id: true, displayName: true } } } },
        labels: { include: { label: true } },
        subtasks: { where: { deletedAt: null }, select: { id: true, status: true } },
      },
    });

    if (!task) {
      return { wouldTrigger: false, conditionsMet: false, actions: [] };
    }

    const trigger = automation.trigger as any;
    const mockEvent: AutomationEvent = {
      type: trigger.type,
      taskId,
      userId: 'test',
      data: trigger.config || {},
      workspaceId: automation.workspaceId,
    };

    const conditionsMet = await this.evaluateConditions(
      automation.conditions as any,
      task,
      mockEvent,
    );

    const actions = (automation.actions as any[]).map((a) => ({
      type: a.type,
      config: a.config,
      wouldExecute: conditionsMet,
    }));

    return {
      wouldTrigger: true,
      conditionsMet,
      actions,
    };
  }
}

// Singleton engine
export const automationEngine = new AutomationEngine();

// Subscribe to events
automationEvents.on('automation:trigger', (event: AutomationEvent) => {
  automationEngine.processEvent(event).catch((err) => {
    logger.error({ err }, 'Unhandled error in automation engine');
  });
});
