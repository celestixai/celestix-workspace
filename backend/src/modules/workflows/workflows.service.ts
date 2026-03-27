import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import type { CreateWorkflowInput, UpdateWorkflowInput } from './workflows.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

export class WorkflowService {
  async create(userId: string, input: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
        workspaceId: input.workspaceId,
        userId,
      },
      include: {
        user: { select: userSelect },
      },
    });
  }

  async getAll(userId: string) {
    return prisma.workflow.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(userId: string, workflowId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return workflow;
  }

  async update(userId: string, workflowId: string, input: UpdateWorkflowInput) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger ? (input.trigger as Prisma.InputJsonValue) : undefined,
        actions: input.actions ? (input.actions as Prisma.InputJsonValue) : undefined,
        isEnabled: input.isEnabled,
      },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });
  }

  async delete(userId: string, workflowId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });
  }

  async toggle(workflowId: string, userId: string) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflow.update({
      where: { id: workflowId },
      data: { isEnabled: !workflow.isEnabled },
      include: {
        user: { select: userSelect },
        _count: { select: { runs: true } },
      },
    });
  }

  async getRuns(workflowId: string, userId: string) {
    // Verify ownership
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    return prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async getRunById(runId: string) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!run) {
      throw new AppError(404, 'Workflow run not found', 'NOT_FOUND');
    }

    return run;
  }

  async executeWorkflow(workflowId: string, triggerData: Record<string, unknown>) {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
    }

    // Create a run record
    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        status: 'RUNNING',
        triggerData: triggerData as Prisma.InputJsonValue,
        startedAt: new Date(),
      },
    });

    const actionResults: Array<{ actionType: string; status: string; output?: unknown }> = [];

    try {
      const actions = workflow.actions as Array<{ type: string; config: Record<string, unknown> }>;

      for (const action of actions) {
        logger.info({ workflowId, runId: run.id, actionType: action.type }, 'Executing workflow action');

        // For now, just log the action type and config — actual execution is deferred
        actionResults.push({
          actionType: action.type,
          status: 'completed',
          output: { message: `Action ${action.type} executed`, config: action.config },
        });
      }

      // Mark run as successful
      const completedRun = await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          actionResults: actionResults as unknown as Prisma.InputJsonValue,
        },
      });

      // Update lastRunAt on the workflow
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date() },
      });

      return completedRun;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ workflowId, runId: run.id, error: errorMessage }, 'Workflow execution failed');

      const failedRun = await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          actionResults: actionResults as unknown as Prisma.InputJsonValue,
          errorMessage,
        },
      });

      // Still update lastRunAt on failure
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date() },
      });

      return failedRun;
    }
  }
}

export const workflowService = new WorkflowService();
