import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

const taskSummarySelect = {
  id: true,
  title: true,
  status: true,
  customTaskId: true,
  assignees: {
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  },
} as const;

type RelationType = 'BLOCKS' | 'WAITING_ON' | 'LINKED_TO';

class RelationshipsService {
  /**
   * Create a relationship between two tasks.
   * When creating BLOCKS, auto-create inverse WAITING_ON.
   * When creating WAITING_ON, auto-create inverse BLOCKS.
   */
  async createRelationship(
    sourceTaskId: string,
    targetTaskId: string,
    type: RelationType,
    userId: string,
  ) {
    // Prevent self-relationships
    if (sourceTaskId === targetTaskId) {
      throw new AppError(400, 'A task cannot have a relationship with itself', 'SELF_RELATIONSHIP');
    }

    // Verify both tasks exist
    const [sourceTask, targetTask] = await Promise.all([
      prisma.task.findFirst({ where: { id: sourceTaskId, deletedAt: null }, select: { id: true, projectId: true } }),
      prisma.task.findFirst({ where: { id: targetTaskId, deletedAt: null }, select: { id: true, projectId: true } }),
    ]);

    if (!sourceTask) {
      throw new AppError(404, 'Source task not found', 'NOT_FOUND');
    }
    if (!targetTask) {
      throw new AppError(404, 'Target task not found', 'NOT_FOUND');
    }

    // Must be in the same project
    if (sourceTask.projectId !== targetTask.projectId) {
      throw new AppError(400, 'Tasks must be in the same project', 'CROSS_PROJECT_RELATIONSHIP');
    }

    // Check for duplicate
    const existing = await prisma.taskRelationship.findUnique({
      where: {
        sourceTaskId_targetTaskId_type: { sourceTaskId, targetTaskId, type },
      },
    });
    if (existing) {
      throw new AppError(409, 'This relationship already exists', 'DUPLICATE_RELATIONSHIP');
    }

    // For BLOCKS/WAITING_ON, create the pair
    if (type === 'BLOCKS' || type === 'WAITING_ON') {
      const forwardType = type === 'BLOCKS' ? 'BLOCKS' : 'WAITING_ON';
      const inverseType = type === 'BLOCKS' ? 'WAITING_ON' : 'BLOCKS';

      const [rel] = await prisma.$transaction([
        prisma.taskRelationship.create({
          data: { sourceTaskId, targetTaskId, type: forwardType as any, createdById: userId },
          include: { sourceTask: { select: taskSummarySelect }, targetTask: { select: taskSummarySelect } },
        }),
        prisma.taskRelationship.upsert({
          where: {
            sourceTaskId_targetTaskId_type: {
              sourceTaskId: targetTaskId,
              targetTaskId: sourceTaskId,
              type: inverseType as any,
            },
          },
          create: {
            sourceTaskId: targetTaskId,
            targetTaskId: sourceTaskId,
            type: inverseType as any,
            createdById: userId,
          },
          update: {},
        }),
      ]);

      return rel;
    }

    // LINKED_TO — create both directions (bidirectional link)
    const [rel] = await prisma.$transaction([
      prisma.taskRelationship.create({
        data: { sourceTaskId, targetTaskId, type: type as any, createdById: userId },
        include: { sourceTask: { select: taskSummarySelect }, targetTask: { select: taskSummarySelect } },
      }),
      prisma.taskRelationship.upsert({
        where: {
          sourceTaskId_targetTaskId_type: {
            sourceTaskId: targetTaskId,
            targetTaskId: sourceTaskId,
            type: 'LINKED_TO' as any,
          },
        },
        create: {
          sourceTaskId: targetTaskId,
          targetTaskId: sourceTaskId,
          type: 'LINKED_TO' as any,
          createdById: userId,
        },
        update: {},
      }),
    ]);

    return rel;
  }

  /**
   * Get all relationships for a task, grouped by type.
   */
  async getRelationships(taskId: string) {
    const [asSource, asTarget] = await Promise.all([
      prisma.taskRelationship.findMany({
        where: { sourceTaskId: taskId },
        include: { targetTask: { select: taskSummarySelect } },
      }),
      prisma.taskRelationship.findMany({
        where: { targetTaskId: taskId },
        include: { sourceTask: { select: taskSummarySelect } },
      }),
    ]);

    const blocking: Array<{ id: string; task: any }> = [];
    const waitingOn: Array<{ id: string; task: any }> = [];
    const linkedTo: Array<{ id: string; task: any }> = [];

    // When this task is the source:
    // - BLOCKS means this task blocks targetTask
    // - WAITING_ON means this task is waiting on targetTask
    // - LINKED_TO means this task is linked to targetTask
    for (const rel of asSource) {
      const entry = { id: rel.id, task: rel.targetTask };
      if (rel.type === 'BLOCKS') blocking.push(entry);
      else if (rel.type === 'WAITING_ON') waitingOn.push(entry);
      else if (rel.type === 'LINKED_TO') linkedTo.push(entry);
    }

    // Deduplicate LINKED_TO (since both directions exist)
    const linkedIds = new Set(linkedTo.map((l) => l.task.id));
    for (const rel of asTarget) {
      if (rel.type === 'LINKED_TO' && !linkedIds.has(rel.sourceTask.id)) {
        linkedTo.push({ id: rel.id, task: rel.sourceTask });
      }
    }

    return { blocking, waitingOn, linkedTo };
  }

  /**
   * Delete a relationship. If it's BLOCKS/WAITING_ON, delete inverse too.
   * If it's LINKED_TO, delete the mirror too.
   */
  async deleteRelationship(relationshipId: string, userId: string) {
    const rel = await prisma.taskRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!rel) {
      throw new AppError(404, 'Relationship not found', 'NOT_FOUND');
    }

    if (rel.type === 'BLOCKS' || rel.type === 'WAITING_ON') {
      const inverseType = rel.type === 'BLOCKS' ? 'WAITING_ON' : 'BLOCKS';

      await prisma.$transaction([
        prisma.taskRelationship.delete({ where: { id: relationshipId } }),
        prisma.taskRelationship.deleteMany({
          where: {
            sourceTaskId: rel.targetTaskId,
            targetTaskId: rel.sourceTaskId,
            type: inverseType as any,
          },
        }),
      ]);
    } else {
      // LINKED_TO — delete both directions
      await prisma.$transaction([
        prisma.taskRelationship.delete({ where: { id: relationshipId } }),
        prisma.taskRelationship.deleteMany({
          where: {
            sourceTaskId: rel.targetTaskId,
            targetTaskId: rel.sourceTaskId,
            type: 'LINKED_TO' as any,
          },
        }),
      ]);
    }
  }

  /**
   * Get dependency warnings for a task.
   * If task has WAITING_ON relationships where the blocking task is not DONE, return warnings.
   */
  async getDependencyWarnings(taskId: string) {
    const waitingRels = await prisma.taskRelationship.findMany({
      where: { sourceTaskId: taskId, type: 'WAITING_ON' as any },
      include: {
        targetTask: {
          select: { id: true, title: true, status: true, customTaskId: true },
        },
      },
    });

    const warnings: Array<{
      severity: 'warning' | 'info';
      message: string;
      blockingTask: { id: string; title: string; status: string; customTaskId: string | null };
    }> = [];

    for (const rel of waitingRels) {
      if (rel.targetTask.status !== 'DONE') {
        warnings.push({
          severity: 'warning',
          message: `Blocked by "${rel.targetTask.title}"`,
          blockingTask: {
            id: rel.targetTask.id,
            title: rel.targetTask.title,
            status: rel.targetTask.status,
            customTaskId: rel.targetTask.customTaskId,
          },
        });
      }
    }

    return warnings;
  }
}

export const relationshipsService = new RelationshipsService();
