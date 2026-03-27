import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateTaskTypeInput, UpdateTaskTypeInput } from './task-types.validation';

const DEFAULT_TASK_TYPES: { name: string; icon: string; color: string; isDefault: boolean; position: number }[] = [
  { name: 'Task', icon: 'check-square', color: '#4A90D9', isDefault: true, position: 0 },
  { name: 'Bug', icon: 'bug', color: '#E91E63', isDefault: false, position: 1 },
  { name: 'Feature', icon: 'star', color: '#9C27B0', isDefault: false, position: 2 },
  { name: 'Milestone', icon: 'flag', color: '#FF9800', isDefault: false, position: 3 },
];

async function getTaskTypes(spaceId: string) {
  const taskTypes = await prisma.taskType.findMany({
    where: { spaceId },
    orderBy: { position: 'asc' },
  });

  return taskTypes;
}

async function createTaskType(spaceId: string, data: CreateTaskTypeInput) {
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await prisma.taskType.updateMany({
      where: { spaceId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // Get max position
  const maxPos = await prisma.taskType.aggregate({
    where: { spaceId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const taskType = await prisma.taskType.create({
    data: {
      spaceId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      description: data.description,
      isDefault: data.isDefault ?? false,
      position,
    },
  });

  return taskType;
}

async function updateTaskType(typeId: string, data: UpdateTaskTypeInput) {
  const existing = await prisma.taskType.findUnique({ where: { id: typeId } });
  if (!existing) {
    throw new AppError(404, 'Task type not found', 'NOT_FOUND');
  }

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await prisma.taskType.updateMany({
      where: { spaceId: existing.spaceId, isDefault: true, id: { not: typeId } },
      data: { isDefault: false },
    });
  }

  const taskType = await prisma.taskType.update({
    where: { id: typeId },
    data: {
      name: data.name,
      icon: data.icon,
      color: data.color,
      description: data.description,
      isDefault: data.isDefault,
      position: data.position,
    },
  });

  return taskType;
}

async function deleteTaskType(typeId: string) {
  const existing = await prisma.taskType.findUnique({ where: { id: typeId } });
  if (!existing) {
    throw new AppError(404, 'Task type not found', 'NOT_FOUND');
  }

  // Check if any tasks use this type
  const taskCount = await prisma.task.count({
    where: { taskTypeId: typeId },
  });

  if (taskCount > 0) {
    // Reassign tasks to the default type in this space
    const defaultType = await prisma.taskType.findFirst({
      where: { spaceId: existing.spaceId, isDefault: true, id: { not: typeId } },
    });

    if (defaultType) {
      await prisma.task.updateMany({
        where: { taskTypeId: typeId },
        data: { taskTypeId: defaultType.id },
      });
    } else {
      // No default type — just nullify
      await prisma.task.updateMany({
        where: { taskTypeId: typeId },
        data: { taskTypeId: null },
      });
    }
  }

  await prisma.taskType.delete({ where: { id: typeId } });

  return { deleted: true };
}

async function createDefaultTaskTypes(spaceId: string) {
  await prisma.taskType.createMany({
    data: DEFAULT_TASK_TYPES.map((t) => ({
      spaceId,
      name: t.name,
      icon: t.icon,
      color: t.color,
      isDefault: t.isDefault,
      position: t.position,
    })),
  });

  return prisma.taskType.findMany({
    where: { spaceId },
    orderBy: { position: 'asc' },
  });
}

export const taskTypesService = {
  getTaskTypes,
  createTaskType,
  updateTaskType,
  deleteTaskType,
  createDefaultTaskTypes,
};
