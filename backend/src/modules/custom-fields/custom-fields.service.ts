import { CustomFieldType, HierarchyLevel, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { aiService } from '../ai/ai.service';
import { logger } from '../../utils/logger';
import type {
  CreateFieldInput,
  UpdateFieldInput,
  AddLocationInput,
  SetValueInput,
  BulkSetValuesInput,
  FilterTasksInput,
} from './custom-fields.validation';

// ==========================================
// Helpers
// ==========================================

function validateConfigForType(fieldType: CustomFieldType, config: any) {
  if (fieldType === 'DROPDOWN' || fieldType === 'MULTI_SELECT' || fieldType === 'LABEL') {
    if (!config || !Array.isArray(config.options) || config.options.length === 0) {
      throw new AppError(400, `${fieldType} fields require config.options array`, 'INVALID_CONFIG');
    }
    for (const opt of config.options) {
      if (!opt.id || !opt.name) {
        throw new AppError(400, 'Each option must have id and name', 'INVALID_CONFIG');
      }
    }
  }
  if (fieldType === 'RATING') {
    if (config && config.max !== undefined && (typeof config.max !== 'number' || config.max < 1)) {
      throw new AppError(400, 'Rating max must be a positive number', 'INVALID_CONFIG');
    }
  }
  if (fieldType === 'PROGRESS') {
    if (config && config.max !== undefined && (typeof config.max !== 'number' || config.max < 1)) {
      throw new AppError(400, 'Progress max must be a positive number', 'INVALID_CONFIG');
    }
  }
}

function validateValueForType(fieldType: CustomFieldType, config: any, data: SetValueInput) {
  switch (fieldType) {
    case 'TEXT':
    case 'LONG_TEXT':
    case 'PHONE':
      if (data.valueText === undefined && data.valueNumber === undefined && data.valueDate === undefined && data.valueBoolean === undefined && data.valueJson === undefined) {
        throw new AppError(400, `${fieldType} field requires valueText`, 'INVALID_VALUE');
      }
      return { valueText: data.valueText ?? null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'EMAIL':
      if (data.valueText !== undefined) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(data.valueText)) {
          throw new AppError(400, 'Invalid email format', 'INVALID_VALUE');
        }
      }
      return { valueText: data.valueText ?? null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'URL':
      if (data.valueText !== undefined) {
        try {
          new URL(data.valueText);
        } catch {
          throw new AppError(400, 'Invalid URL format', 'INVALID_VALUE');
        }
      }
      return { valueText: data.valueText ?? null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'NUMBER':
    case 'MONEY':
    case 'RATING':
    case 'PROGRESS':
      if (data.valueNumber !== undefined && config) {
        if (config.min !== undefined && data.valueNumber < config.min) {
          throw new AppError(400, `Value must be >= ${config.min}`, 'INVALID_VALUE');
        }
        if (config.max !== undefined && data.valueNumber > config.max) {
          throw new AppError(400, `Value must be <= ${config.max}`, 'INVALID_VALUE');
        }
      }
      return { valueText: null, valueNumber: data.valueNumber ?? null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'DATE':
      return { valueText: null, valueNumber: null, valueDate: data.valueDate ? new Date(data.valueDate) : null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'CHECKBOX':
      return { valueText: null, valueNumber: null, valueDate: null, valueBoolean: data.valueBoolean ?? null, valueJson: Prisma.DbNull };

    case 'DROPDOWN':
    case 'MULTI_SELECT':
    case 'LABEL':
    case 'PEOPLE':
    case 'FILE':
    case 'LOCATION':
    case 'VOTING':
    case 'RELATIONSHIP':
      return { valueText: null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: data.valueJson ?? Prisma.DbNull };

    case 'FORMULA':
      // Basic: store formula result as text for now
      return { valueText: data.valueText ?? null, valueNumber: data.valueNumber ?? null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    case 'ROLLUP':
      // Store calculated rollup value
      return { valueText: null, valueNumber: data.valueNumber ?? null, valueDate: null, valueBoolean: null, valueJson: data.valueJson ?? Prisma.DbNull };

    case 'AI_SUMMARY':
    case 'AI_SENTIMENT':
    case 'AI_CUSTOM':
      // AI fields store their results in valueText
      return { valueText: data.valueText ?? null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: Prisma.DbNull };

    default:
      return { valueText: data.valueText ?? null, valueNumber: data.valueNumber ?? null, valueDate: data.valueDate ? new Date(data.valueDate) : null, valueBoolean: data.valueBoolean ?? null, valueJson: data.valueJson ?? Prisma.DbNull };
  }
}

// ==========================================
// Field Definitions
// ==========================================

async function createField(workspaceId: string, userId: string, data: CreateFieldInput) {
  validateConfigForType(data.fieldType as CustomFieldType, data.config);

  const maxPos = await prisma.customFieldDefinition.aggregate({
    where: { workspaceId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const field = await prisma.customFieldDefinition.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description,
      fieldType: data.fieldType as CustomFieldType,
      config: data.config ?? Prisma.DbNull,
      isRequired: data.isRequired ?? false,
      position,
      createdById: userId,
    },
  });

  return field;
}

async function getFields(workspaceId: string) {
  const fields = await prisma.customFieldDefinition.findMany({
    where: { workspaceId },
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { locations: true, values: true } },
    },
  });

  return fields;
}

async function getField(fieldId: string) {
  const field = await prisma.customFieldDefinition.findUnique({
    where: { id: fieldId },
    include: {
      _count: { select: { locations: true, values: true } },
    },
  });

  if (!field) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  return field;
}

async function updateField(fieldId: string, data: UpdateFieldInput) {
  const existing = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!existing) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  if (data.config !== undefined) {
    validateConfigForType(existing.fieldType, data.config);
  }

  const field = await prisma.customFieldDefinition.update({
    where: { id: fieldId },
    data: {
      name: data.name,
      description: data.description,
      config: data.config !== undefined ? (data.config ?? Prisma.DbNull) : undefined,
      isRequired: data.isRequired,
    },
  });

  return field;
}

async function deleteField(fieldId: string) {
  const existing = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!existing) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  // Cascade delete is handled by Prisma relations (onDelete: Cascade)
  await prisma.customFieldDefinition.delete({ where: { id: fieldId } });

  return { deleted: true };
}

// ==========================================
// Field Locations
// ==========================================

async function addLocation(fieldId: string, data: AddLocationInput) {
  const field = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!field) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  const maxPos = await prisma.customFieldLocation.aggregate({
    where: { fieldId },
    _max: { position: true },
  });
  const position = data.position ?? (maxPos._max.position ?? -1) + 1;

  const location = await prisma.customFieldLocation.create({
    data: {
      fieldId,
      locationType: data.locationType as HierarchyLevel,
      locationId: data.locationId,
      isVisible: data.isVisible ?? true,
      position,
    },
  });

  return location;
}

async function removeLocation(fieldId: string, locationRecordId: string) {
  const location = await prisma.customFieldLocation.findFirst({
    where: { id: locationRecordId, fieldId },
  });
  if (!location) {
    throw new AppError(404, 'Field location not found', 'NOT_FOUND');
  }

  await prisma.customFieldLocation.delete({ where: { id: locationRecordId } });

  return { removed: true };
}

async function getFieldsAtLocation(locationType: HierarchyLevel, locationId: string) {
  // Get directly assigned fields
  const directLocations = await prisma.customFieldLocation.findMany({
    where: { locationType, locationId, isVisible: true },
    include: { field: true },
    orderBy: { position: 'asc' },
  });

  // Build inherited locations based on hierarchy: LIST inherits from FOLDER and SPACE, FOLDER inherits from SPACE
  const inheritedLocations: typeof directLocations = [];

  if (locationType === 'LIST') {
    // Find the list to get its folder and space
    const list = await prisma.taskList.findUnique({
      where: { id: locationId },
      select: { spaceId: true, folderId: true },
    });
    if (list) {
      // Inherit from folder
      if (list.folderId) {
        const folderFields = await prisma.customFieldLocation.findMany({
          where: { locationType: 'FOLDER', locationId: list.folderId, isVisible: true },
          include: { field: true },
          orderBy: { position: 'asc' },
        });
        inheritedLocations.push(...folderFields);
      }
      // Inherit from space
      if (list.spaceId) {
        const spaceFields = await prisma.customFieldLocation.findMany({
          where: { locationType: 'SPACE', locationId: list.spaceId, isVisible: true },
          include: { field: true },
          orderBy: { position: 'asc' },
        });
        inheritedLocations.push(...spaceFields);
      }
    }
  } else if (locationType === 'FOLDER') {
    // Inherit from space
    const folder = await prisma.folder.findUnique({
      where: { id: locationId },
      select: { spaceId: true },
    });
    if (folder) {
      const spaceFields = await prisma.customFieldLocation.findMany({
        where: { locationType: 'SPACE', locationId: folder.spaceId, isVisible: true },
        include: { field: true },
        orderBy: { position: 'asc' },
      });
      inheritedLocations.push(...spaceFields);
    }
  }

  // Deduplicate by fieldId (direct takes priority)
  const seenFieldIds = new Set(directLocations.map((l) => l.fieldId));
  const uniqueInherited = inheritedLocations.filter((l) => {
    if (seenFieldIds.has(l.fieldId)) return false;
    seenFieldIds.add(l.fieldId);
    return true;
  });

  return {
    direct: directLocations.map((l) => ({ ...l.field, locationPosition: l.position, inherited: false })),
    inherited: uniqueInherited.map((l) => ({ ...l.field, locationPosition: l.position, inherited: true })),
    all: [
      ...directLocations.map((l) => ({ ...l.field, locationPosition: l.position, inherited: false })),
      ...uniqueInherited.map((l) => ({ ...l.field, locationPosition: l.position, inherited: true })),
    ],
  };
}

// ==========================================
// Field Values
// ==========================================

async function getTaskValues(taskId: string) {
  const values = await prisma.customFieldValue.findMany({
    where: { taskId },
    include: {
      field: {
        select: { id: true, name: true, fieldType: true, config: true, isRequired: true },
      },
    },
    orderBy: { field: { position: 'asc' } },
  });

  return values;
}

async function setValue(fieldId: string, taskId: string, data: SetValueInput) {
  const field = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!field) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  const valueData = validateValueForType(field.fieldType, field.config, data);

  const value = await prisma.customFieldValue.upsert({
    where: { fieldId_taskId: { fieldId, taskId } },
    create: {
      fieldId,
      taskId,
      ...valueData,
    },
    update: valueData,
    include: {
      field: {
        select: { id: true, name: true, fieldType: true, config: true },
      },
    },
  });

  return value;
}

async function clearValue(fieldId: string, taskId: string) {
  const value = await prisma.customFieldValue.findUnique({
    where: { fieldId_taskId: { fieldId, taskId } },
  });

  if (!value) {
    throw new AppError(404, 'Field value not found', 'NOT_FOUND');
  }

  await prisma.customFieldValue.delete({
    where: { fieldId_taskId: { fieldId, taskId } },
  });

  return { cleared: true };
}

async function bulkSetValues(taskId: string, data: BulkSetValuesInput) {
  const fieldIds = data.values.map((v) => v.fieldId);
  const fields = await prisma.customFieldDefinition.findMany({
    where: { id: { in: fieldIds } },
  });

  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  // Validate all values first
  const operations = data.values.map((v) => {
    const field = fieldMap.get(v.fieldId);
    if (!field) {
      throw new AppError(404, `Custom field ${v.fieldId} not found`, 'NOT_FOUND');
    }
    const valueData = validateValueForType(field.fieldType, field.config, v);
    return prisma.customFieldValue.upsert({
      where: { fieldId_taskId: { fieldId: v.fieldId, taskId } },
      create: { fieldId: v.fieldId, taskId, ...valueData },
      update: valueData,
    });
  });

  const results = await prisma.$transaction(operations);
  return results;
}

// ==========================================
// Filtering
// ==========================================

async function filterTasks(data: FilterTasksInput) {
  const field = await prisma.customFieldDefinition.findUnique({ where: { id: data.fieldId } });
  if (!field) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  // Determine which value column to filter on based on field type
  const { operator, value } = data;

  // Build where clause for CustomFieldValue
  const where: Prisma.CustomFieldValueWhereInput = { fieldId: data.fieldId };

  // If listId is provided, filter tasks by list
  if (data.listId) {
    where.task = { listId: data.listId, deletedAt: null };
  } else {
    where.task = { deletedAt: null };
  }

  // Apply operator-based filtering
  if (operator === 'empty') {
    // Find tasks that do NOT have a value for this field
    const tasksWithValues = await prisma.customFieldValue.findMany({
      where: { fieldId: data.fieldId },
      select: { taskId: true },
    });
    const taskIdsWithValues = tasksWithValues.map((v) => v.taskId);

    const taskWhere: Prisma.TaskWhereInput = {
      deletedAt: null,
      id: { notIn: taskIdsWithValues },
    };
    if (data.listId) taskWhere.listId = data.listId;

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: { id: true },
    });
    return tasks.map((t) => t.id);
  }

  if (operator === 'not_empty') {
    const values = await prisma.customFieldValue.findMany({
      where,
      select: { taskId: true },
    });
    return values.map((v) => v.taskId);
  }

  // For value-based operators, determine the column
  const isTextType = ['TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'URL'].includes(field.fieldType);
  const isNumberType = ['NUMBER', 'MONEY', 'RATING', 'PROGRESS'].includes(field.fieldType);
  const isDateType = field.fieldType === 'DATE';
  const isBooleanType = field.fieldType === 'CHECKBOX';

  if (isTextType) {
    switch (operator) {
      case 'eq':
        where.valueText = { equals: String(value) };
        break;
      case 'neq':
        where.valueText = { not: String(value) };
        break;
      case 'contains':
        where.valueText = { contains: String(value), mode: 'insensitive' };
        break;
      case 'in':
        where.valueText = { in: Array.isArray(value) ? value.map(String) : [String(value)] };
        break;
      default:
        throw new AppError(400, `Operator ${operator} not supported for text fields`, 'INVALID_OPERATOR');
    }
  } else if (isNumberType) {
    const numVal = Number(value);
    switch (operator) {
      case 'eq': where.valueNumber = { equals: numVal }; break;
      case 'neq': where.valueNumber = { not: numVal }; break;
      case 'gt': where.valueNumber = { gt: numVal }; break;
      case 'lt': where.valueNumber = { lt: numVal }; break;
      case 'gte': where.valueNumber = { gte: numVal }; break;
      case 'lte': where.valueNumber = { lte: numVal }; break;
      default:
        throw new AppError(400, `Operator ${operator} not supported for number fields`, 'INVALID_OPERATOR');
    }
  } else if (isDateType) {
    const dateVal = new Date(String(value));
    switch (operator) {
      case 'eq': where.valueDate = { equals: dateVal }; break;
      case 'neq': where.valueDate = { not: dateVal }; break;
      case 'gt': where.valueDate = { gt: dateVal }; break;
      case 'lt': where.valueDate = { lt: dateVal }; break;
      case 'gte': where.valueDate = { gte: dateVal }; break;
      case 'lte': where.valueDate = { lte: dateVal }; break;
      default:
        throw new AppError(400, `Operator ${operator} not supported for date fields`, 'INVALID_OPERATOR');
    }
  } else if (isBooleanType) {
    switch (operator) {
      case 'eq': where.valueBoolean = { equals: Boolean(value) }; break;
      case 'neq': where.valueBoolean = { not: Boolean(value) }; break;
      default:
        throw new AppError(400, `Operator ${operator} not supported for boolean fields`, 'INVALID_OPERATOR');
    }
  } else {
    // JSON-based fields: use raw query for complex filtering, fall back to fetching all and filtering in-memory
    const values = await prisma.customFieldValue.findMany({
      where,
      select: { taskId: true, valueJson: true },
    });

    return values
      .filter((v) => {
        const json = v.valueJson as any;
        if (json === null || json === undefined) return false;
        switch (operator) {
          case 'eq': return JSON.stringify(json) === JSON.stringify(value);
          case 'neq': return JSON.stringify(json) !== JSON.stringify(value);
          case 'contains': return JSON.stringify(json).includes(String(value));
          default: return true;
        }
      })
      .map((v) => v.taskId);
  }

  const results = await prisma.customFieldValue.findMany({
    where,
    select: { taskId: true },
  });

  return results.map((v) => v.taskId);
}

// ==========================================
// AI Field Processing
// ==========================================

// Debounce map: taskId -> last processed timestamp
const aiFieldProcessedAt = new Map<string, number>();
const AI_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

async function processAIField(
  fieldDefinition: { id: string; fieldType: CustomFieldType; config: any },
  task: { id: string; title: string; descriptionHtml?: string | null },
) {
  try {
    let resultText = 'Pending AI';

    // Gather task context
    const comments = await prisma.taskComment.findMany({
      where: { taskId: task.id },
      select: { bodyHtml: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const commentTexts = comments.map((c: { bodyHtml: string }) => c.bodyHtml).join('\n');

    switch (fieldDefinition.fieldType) {
      case 'AI_SUMMARY': {
        const content = [
          `Title: ${task.title}`,
          task.descriptionHtml ? `Description: ${task.descriptionHtml}` : '',
          commentTexts ? `Recent comments:\n${commentTexts}` : '',
        ].filter(Boolean).join('\n\n');

        const result = await aiService.summarize('task', content);
        if (result.success && result.data?.summary) {
          resultText = result.data.summary;
        }
        break;
      }

      case 'AI_SENTIMENT': {
        if (!commentTexts) {
          resultText = 'Neutral';
          break;
        }
        const result = await aiService.generateContent(
          'sentiment',
          'Analyze the sentiment of these task comments. Reply with exactly one word: Positive, Neutral, Negative, or Urgent.',
          commentTexts,
        );
        if (result.success && result.data?.content) {
          const raw = result.data.content.trim();
          // Extract valid sentiment
          const valid = ['Positive', 'Neutral', 'Negative', 'Urgent'];
          const match = valid.find((v) => raw.toLowerCase().includes(v.toLowerCase()));
          resultText = match ?? 'Neutral';
        }
        break;
      }

      case 'AI_CUSTOM': {
        const cfg = fieldDefinition.config as any;
        const prompt = cfg?.prompt ?? 'Analyze this task.';
        const context = [
          `Title: ${task.title}`,
          task.descriptionHtml ? `Description: ${task.descriptionHtml}` : '',
          commentTexts ? `Recent comments:\n${commentTexts}` : '',
        ].filter(Boolean).join('\n\n');

        const result = await aiService.generateContent('custom_field', prompt, context);
        if (result.success && result.data?.content) {
          resultText = result.data.content;
        }
        break;
      }
    }

    // Store the AI result
    await prisma.customFieldValue.upsert({
      where: { fieldId_taskId: { fieldId: fieldDefinition.id, taskId: task.id } },
      create: {
        fieldId: fieldDefinition.id,
        taskId: task.id,
        valueText: resultText,
        valueNumber: null,
        valueDate: null,
        valueBoolean: null,
        valueJson: Prisma.DbNull,
      },
      update: {
        valueText: resultText,
      },
    });

    return resultText;
  } catch (err) {
    logger.warn({ err, fieldId: fieldDefinition.id, taskId: task.id }, 'AI field processing failed');

    // Store "Pending AI" as fallback
    await prisma.customFieldValue.upsert({
      where: { fieldId_taskId: { fieldId: fieldDefinition.id, taskId: task.id } },
      create: {
        fieldId: fieldDefinition.id,
        taskId: task.id,
        valueText: 'Pending AI',
        valueNumber: null,
        valueDate: null,
        valueBoolean: null,
        valueJson: Prisma.DbNull,
      },
      update: {
        valueText: 'Pending AI',
      },
    });

    return 'Pending AI';
  }
}

async function processAIFieldsForTask(taskId: string) {
  // Debounce: skip if processed in last 5 minutes
  const lastProcessed = aiFieldProcessedAt.get(taskId);
  if (lastProcessed && Date.now() - lastProcessed < AI_DEBOUNCE_MS) {
    return;
  }
  aiFieldProcessedAt.set(taskId, Date.now());

  try {
    // Get the task with its list info to find AI fields at its location
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        descriptionHtml: true,
        listId: true,
        list: { select: { id: true, spaceId: true, folderId: true } },
      },
    });
    if (!task || !task.listId) return;

    // Find all AI-type custom field definitions in the workspace via locations
    const aiFieldTypes: CustomFieldType[] = ['AI_SUMMARY', 'AI_SENTIMENT', 'AI_CUSTOM'];

    // Get fields at the task's list location (includes inherited from folder/space)
    const fieldsAtLocation = await getFieldsAtLocation('LIST', task.listId);
    const aiFields = fieldsAtLocation.all.filter((f) =>
      aiFieldTypes.includes(f.fieldType as CustomFieldType),
    );

    if (aiFields.length === 0) return;

    // Process each AI field
    await Promise.allSettled(
      aiFields.map((field) =>
        processAIField(
          { id: field.id, fieldType: field.fieldType as CustomFieldType, config: field.config },
          { id: task.id, title: task.title, descriptionHtml: task.descriptionHtml },
        ),
      ),
    );
  } catch (err) {
    logger.warn({ err, taskId }, 'processAIFieldsForTask failed');
  }
}

async function refreshAIField(taskId: string, fieldId: string) {
  const field = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!field) {
    throw new AppError(404, 'Custom field not found', 'NOT_FOUND');
  }

  const aiFieldTypes: CustomFieldType[] = ['AI_SUMMARY', 'AI_SENTIMENT', 'AI_CUSTOM'];
  if (!aiFieldTypes.includes(field.fieldType)) {
    throw new AppError(400, 'Field is not an AI field type', 'INVALID_FIELD_TYPE');
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, descriptionHtml: true },
  });
  if (!task) {
    throw new AppError(404, 'Task not found', 'NOT_FOUND');
  }

  const result = await processAIField(
    { id: field.id, fieldType: field.fieldType, config: field.config },
    { id: task.id, title: task.title, descriptionHtml: task.descriptionHtml },
  );

  return { fieldId, taskId, value: result };
}

// ==========================================
// Export
// ==========================================

export const customFieldsService = {
  // Field Definitions
  createField,
  getFields,
  getField,
  updateField,
  deleteField,
  // Field Locations
  addLocation,
  removeLocation,
  getFieldsAtLocation,
  // Field Values
  getTaskValues,
  setValue,
  clearValue,
  bulkSetValues,
  // Filtering
  filterTasks,
  // AI Fields
  processAIField,
  processAIFieldsForTask,
  refreshAIField,
};
