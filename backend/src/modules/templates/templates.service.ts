import { TemplateType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  ApplyTemplateInput,
} from './templates.validation';

// ==========================================
// Helpers
// ==========================================

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

  const updated = await prisma.space.update({
    where: { id: space.id },
    data: { taskIdCounter: { increment: 1 } },
    select: { taskIdCounter: true, taskIdPrefix: true },
  });

  return `${updated.taskIdPrefix}-${String(updated.taskIdCounter).padStart(3, '0')}`;
}

function shiftDate(dateStr: string, offsetDays: number): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(now.getTime() + offsetDays * 86400000);
  // Preserve time from original date
  const orig = new Date(dateStr);
  d.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds());
  return d;
}

// ==========================================
// Template CRUD
// ==========================================

async function getTemplates(
  workspaceId: string,
  filters?: { templateType?: TemplateType; tags?: string[]; search?: string },
) {
  const where: Prisma.TaskTemplateWhereInput = { workspaceId };

  if (filters?.templateType) {
    where.templateType = filters.templateType;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Tag filtering via JSON contains — tags stored as Json array
  // Prisma doesn't support array-contains on Json easily, so we filter in-memory
  let templates = await prisma.taskTemplate.findMany({
    where,
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
    orderBy: [{ isPinned: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
  });

  if (filters?.tags && filters.tags.length > 0) {
    templates = templates.filter((t) => {
      const tTags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
      return filters.tags!.some((tag) => tTags.includes(tag));
    });
  }

  return templates;
}

async function createTemplate(workspaceId: string, userId: string, data: CreateTemplateInput) {
  const template = await prisma.taskTemplate.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description,
      templateType: (data.templateType as TemplateType) ?? 'TASK',
      templateData: data.templateData ?? Prisma.DbNull,
      tags: data.tags ?? Prisma.DbNull,
      isPublic: data.isPublic ?? false,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
  });

  return template;
}

async function createFromTask(taskId: string, userId: string, name: string, description?: string) {
  // Fetch the task with all related data
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: {
      subtasks: {
        where: { deletedAt: null },
        select: {
          title: true,
          descriptionHtml: true,
          priority: true,
          status: true,
          estimatedMinutes: true,
          position: true,
          taskType: true,
        },
        orderBy: { position: 'asc' },
      },
      checklists: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            orderBy: { position: 'asc' },
            select: { name: true, position: true },
          },
        },
      },
      labels: { include: { label: { select: { name: true, color: true } } } },
      list: { select: { spaceId: true } },
    },
  });

  if (!task) {
    throw new AppError(404, 'Task not found', 'NOT_FOUND');
  }

  // Find workspace via list -> space -> workspace
  let workspaceId: string | null = null;
  if (task.list?.spaceId) {
    const space = await prisma.space.findUnique({
      where: { id: task.list.spaceId },
      select: { workspaceId: true },
    });
    workspaceId = space?.workspaceId ?? null;
  }
  if (!workspaceId) {
    // Fallback: get from project member
    const pm = await prisma.projectMember.findFirst({
      where: { userId },
      select: { project: { select: { id: true } } },
    });
    // Use first workspace the user belongs to
    const wm = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });
    workspaceId = wm?.workspaceId ?? '';
  }

  if (!workspaceId) {
    throw new AppError(400, 'Could not determine workspace for template', 'NO_WORKSPACE');
  }

  // Serialize template data
  const templateData = {
    title: task.title,
    descriptionHtml: task.descriptionHtml,
    priority: task.priority,
    taskType: task.taskType,
    estimatedMinutes: task.estimatedMinutes,
    labels: task.labels.map((l) => ({ name: l.label.name, color: l.label.color })),
    subtasks: task.subtasks.map((s) => ({
      title: s.title,
      descriptionHtml: s.descriptionHtml,
      priority: s.priority,
      status: s.status,
      estimatedMinutes: s.estimatedMinutes,
      taskType: s.taskType,
    })),
    checklists: task.checklists.map((cl) => ({
      name: cl.name,
      items: cl.items.map((i) => ({ name: i.name })),
    })),
  };

  const template = await prisma.taskTemplate.create({
    data: {
      workspaceId,
      name,
      description: description ?? `Template from task: ${task.title}`,
      templateType: 'TASK',
      templateData,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
  });

  return template;
}

async function createFromList(listId: string, userId: string, name: string, description?: string) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId },
    include: {
      space: { select: { workspaceId: true } },
      tasks: {
        where: { deletedAt: null, isSubtask: false },
        orderBy: { position: 'asc' },
        include: {
          subtasks: {
            where: { deletedAt: null },
            select: {
              title: true,
              descriptionHtml: true,
              priority: true,
              status: true,
              estimatedMinutes: true,
              taskType: true,
              position: true,
            },
            orderBy: { position: 'asc' },
          },
          checklists: {
            orderBy: { position: 'asc' },
            include: {
              items: {
                orderBy: { position: 'asc' },
                select: { name: true, position: true },
              },
            },
          },
          labels: { include: { label: { select: { name: true, color: true } } } },
        },
      },
      statuses: { orderBy: { position: 'asc' } },
    },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  const templateData = {
    listName: list.name,
    listDescription: list.description,
    listColor: list.color,
    listIcon: list.icon,
    useCustomStatuses: list.useCustomStatuses,
    statuses: list.statuses.map((s) => ({
      name: s.name,
      color: s.color,
      statusGroup: s.statusGroup,
      position: s.position,
    })),
    tasks: list.tasks.map((t) => ({
      title: t.title,
      descriptionHtml: t.descriptionHtml,
      priority: t.priority,
      status: t.status,
      taskType: t.taskType,
      estimatedMinutes: t.estimatedMinutes,
      labels: t.labels.map((l) => ({ name: l.label.name, color: l.label.color })),
      subtasks: t.subtasks.map((s) => ({
        title: s.title,
        descriptionHtml: s.descriptionHtml,
        priority: s.priority,
        status: s.status,
        estimatedMinutes: s.estimatedMinutes,
        taskType: s.taskType,
      })),
      checklists: t.checklists.map((cl) => ({
        name: cl.name,
        items: cl.items.map((i) => ({ name: i.name })),
      })),
    })),
  };

  const template = await prisma.taskTemplate.create({
    data: {
      workspaceId: list.space.workspaceId,
      name,
      description: description ?? `Template from list: ${list.name}`,
      templateType: 'LIST',
      templateData,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
  });

  return template;
}

async function getTemplate(templateId: string) {
  const template = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
  });

  if (!template) {
    throw new AppError(404, 'Template not found', 'NOT_FOUND');
  }

  return template;
}

async function updateTemplate(templateId: string, userId: string, data: UpdateTemplateInput) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new AppError(404, 'Template not found', 'NOT_FOUND');
  }
  if (template.createdById !== userId) {
    throw new AppError(403, 'Only the template creator can update it', 'FORBIDDEN');
  }

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      name: data.name,
      description: data.description,
      templateType: data.templateType as TemplateType | undefined,
      templateData: data.templateData !== undefined ? (data.templateData ?? Prisma.DbNull) : undefined,
      tags: data.tags !== undefined ? (data.tags ?? Prisma.DbNull) : undefined,
      isPublic: data.isPublic,
      previewImageUrl: data.previewImageUrl,
    },
    include: {
      createdBy: {
        select: { id: true, displayName: true, avatarUrl: true, email: true },
      },
    },
  });

  return updated;
}

async function deleteTemplate(templateId: string, userId: string) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new AppError(404, 'Template not found', 'NOT_FOUND');
  }
  if (template.createdById !== userId) {
    throw new AppError(403, 'Only the template creator can delete it', 'FORBIDDEN');
  }

  await prisma.taskTemplate.delete({ where: { id: templateId } });
  return { deleted: true };
}

// ==========================================
// Apply Template
// ==========================================

async function applyTemplate(
  templateId: string,
  userId: string,
  input: ApplyTemplateInput,
) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new AppError(404, 'Template not found', 'NOT_FOUND');
  }

  const targetList = await prisma.taskList.findUnique({
    where: { id: input.targetListId },
    include: { space: { select: { id: true, workspaceId: true } } },
  });
  if (!targetList) {
    throw new AppError(404, 'Target list not found', 'NOT_FOUND');
  }

  // Need a project to attach tasks to. Find the user's first project in this workspace.
  // Tasks require a projectId — find one the user is a member of.
  const projectMember = await prisma.projectMember.findFirst({
    where: { userId },
    select: { projectId: true },
  });
  if (!projectMember) {
    throw new AppError(400, 'User must belong to a project to apply templates', 'NO_PROJECT');
  }
  const projectId = projectMember.projectId;

  const data = template.templateData as any;
  const results: any[] = [];

  if (template.templateType === 'TASK') {
    const task = await createTaskFromTemplateData(data, projectId, userId, input.targetListId, input.remapDates, input.dateOffset);
    results.push(task);
  } else if (template.templateType === 'LIST') {
    // For LIST template, create all tasks in the target list
    const tasks = data.tasks ?? [];
    for (const taskData of tasks) {
      const task = await createTaskFromTemplateData(taskData, projectId, userId, input.targetListId, input.remapDates, input.dateOffset);
      results.push(task);
    }
  }

  // Increment usage count
  await prisma.taskTemplate.update({
    where: { id: templateId },
    data: { usageCount: { increment: 1 } },
  });

  return {
    templateId,
    templateType: template.templateType,
    applied: true,
    createdCount: results.length,
    items: results.map((r) => ({ id: r.id, title: r.title })),
  };
}

async function createTaskFromTemplateData(
  data: any,
  projectId: string,
  userId: string,
  listId: string,
  remapDates?: boolean,
  dateOffset?: number,
) {
  // Calculate position
  const lastTask = await prisma.task.findFirst({
    where: { listId, deletedAt: null, isSubtask: false },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastTask?.position ?? 0) + 65536;

  // Generate custom task ID
  const customTaskId = await generateCustomTaskId(listId);

  // Handle date remapping
  let dueDate: Date | undefined;
  let startDate: Date | undefined;
  if (data.dueDate) {
    dueDate = remapDates && dateOffset !== undefined
      ? shiftDate(data.dueDate, dateOffset)
      : new Date(data.dueDate);
  }
  if (data.startDate) {
    startDate = remapDates && dateOffset !== undefined
      ? shiftDate(data.startDate, dateOffset)
      : new Date(data.startDate);
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: data.title ?? 'Untitled Task',
      descriptionHtml: data.descriptionHtml,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'NONE',
      taskType: data.taskType ?? 'task',
      estimatedMinutes: data.estimatedMinutes,
      dueDate,
      startDate,
      position,
      listId,
      customTaskId,
      createdById: userId,
    },
  });

  // Create subtasks
  if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
    for (let i = 0; i < data.subtasks.length; i++) {
      const sub = data.subtasks[i];
      const subCustomId = await generateCustomTaskId(listId);
      await prisma.task.create({
        data: {
          projectId,
          title: sub.title ?? 'Untitled Subtask',
          descriptionHtml: sub.descriptionHtml,
          status: sub.status ?? 'TODO',
          priority: sub.priority ?? 'NONE',
          taskType: sub.taskType ?? 'task',
          estimatedMinutes: sub.estimatedMinutes,
          position: (i + 1) * 65536,
          listId,
          customTaskId: subCustomId,
          parentTaskId: task.id,
          isSubtask: true,
          depth: 1,
          createdById: userId,
        },
      });
    }
  }

  // Create checklists
  if (Array.isArray(data.checklists) && data.checklists.length > 0) {
    for (let ci = 0; ci < data.checklists.length; ci++) {
      const cl = data.checklists[ci];
      const checklist = await prisma.checklist.create({
        data: {
          taskId: task.id,
          name: cl.name ?? `Checklist ${ci + 1}`,
          position: ci,
        },
      });

      if (Array.isArray(cl.items)) {
        for (let ii = 0; ii < cl.items.length; ii++) {
          await prisma.checklistItem.create({
            data: {
              checklistId: checklist.id,
              name: cl.items[ii].name ?? 'Item',
              position: ii,
            },
          });
        }
      }
    }
  }

  return task;
}

// ==========================================
// Toggle Pin
// ==========================================

async function togglePin(templateId: string, userId: string) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new AppError(404, 'Template not found', 'NOT_FOUND');
  }

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: { isPinned: !template.isPinned },
  });

  return updated;
}

// ==========================================
// Template Tags
// ==========================================

async function getTemplateTags(workspaceId: string) {
  const templates = await prisma.taskTemplate.findMany({
    where: { workspaceId, tags: { not: Prisma.JsonNull } },
    select: { tags: true },
  });

  const tagSet = new Set<string>();
  for (const t of templates) {
    if (Array.isArray(t.tags)) {
      for (const tag of t.tags as string[]) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
}

// ==========================================
// Export
// ==========================================

export const templatesService = {
  getTemplates,
  createTemplate,
  createFromTask,
  createFromList,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  togglePin,
  getTemplateTags,
};
