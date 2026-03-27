import { prisma } from '../../config/database';
import type { TaskPriority } from '@prisma/client';

interface ColumnMapping {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  startDate?: string;
  assignee?: string;
  tags?: string;
  timeEstimate?: string;
  [key: string]: string | undefined;  // custom field mappings: "customField:fieldId" -> column name
}

interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

interface ParsedCSV {
  columns: string[];
  rows: Record<string, string>[];
}

export class ImportService {
  /**
   * Parse a CSV buffer into columns and row objects.
   */
  parseCSV(buffer: Buffer): ParsedCSV {
    const text = buffer.toString('utf-8');
    const lines = this.parseCSVLines(text);

    if (lines.length === 0) {
      return { columns: [], rows: [] };
    }

    const columns = lines[0];
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.every((cell) => cell.trim() === '')) continue; // skip blank rows

      const row: Record<string, string> = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = line[j] ?? '';
      }
      rows.push(row);
    }

    return { columns, rows };
  }

  /**
   * Return a preview of what will be imported: first 10 rows mapped to task fields.
   * Also suggests column mappings based on header names.
   */
  previewImport(
    parsed: ParsedCSV,
    columnMapping?: ColumnMapping,
  ): {
    columns: string[];
    rows: Record<string, string>[];
    suggestedMapping: ColumnMapping;
    preview: Array<Record<string, string>>;
  } {
    const mapping = columnMapping || this.suggestMapping(parsed.columns);
    const previewRows = parsed.rows.slice(0, 10);

    const preview = previewRows.map((row) => {
      const mapped: Record<string, string> = {};
      if (mapping.title) mapped.title = row[mapping.title] || '';
      if (mapping.description) mapped.description = row[mapping.description] || '';
      if (mapping.status) mapped.status = row[mapping.status] || '';
      if (mapping.priority) mapped.priority = row[mapping.priority] || '';
      if (mapping.dueDate) mapped.dueDate = row[mapping.dueDate] || '';
      if (mapping.startDate) mapped.startDate = row[mapping.startDate] || '';
      if (mapping.assignee) mapped.assignee = row[mapping.assignee] || '';
      if (mapping.tags) mapped.tags = row[mapping.tags] || '';
      if (mapping.timeEstimate) mapped.timeEstimate = row[mapping.timeEstimate] || '';
      return mapped;
    });

    return {
      columns: parsed.columns,
      rows: previewRows,
      suggestedMapping: mapping,
      preview,
    };
  }

  /**
   * Execute import: create tasks in the target list.
   */
  async executeImport(
    listId: string,
    userId: string,
    rows: Record<string, string>[],
    mapping: ColumnMapping,
  ): Promise<ImportResult> {
    const result: ImportResult = { created: 0, failed: 0, errors: [] };

    // Look up the list to get projectId and space info
    const list = await prisma.taskList.findUnique({
      where: { id: listId },
      select: { id: true, spaceId: true, space: { select: { id: true, workspaceId: true, taskIdPrefix: true } } },
    });

    if (!list) {
      return { created: 0, failed: rows.length, errors: [{ row: 0, error: 'List not found' }] };
    }

    // Find the project for this list: look at existing tasks in the list, or user's project membership
    let projectId: string | null = null;

    // Strategy 1: use the same project as existing tasks in this list
    const existingTask = await prisma.task.findFirst({
      where: { listId, deletedAt: null },
      select: { projectId: true },
    });
    if (existingTask) {
      projectId = existingTask.projectId;
    }

    // Strategy 2: use any project the user is a member of
    if (!projectId) {
      const membership = await prisma.projectMember.findFirst({
        where: { userId },
        select: { projectId: true },
        orderBy: { joinedAt: 'asc' },
      });
      if (membership) {
        projectId = membership.projectId;
      }
    }

    // Strategy 3: find any project
    if (!projectId) {
      const anyProject = await prisma.project.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      projectId = anyProject?.id ?? null;
    }

    if (!projectId) {
      return { created: 0, failed: rows.length, errors: [{ row: 0, error: 'No project found for task creation' }] };
    }

    // Get list statuses for mapping status names
    const listStatuses = await prisma.listStatus.findMany({
      where: { listId },
      select: { name: true, statusGroup: true, color: true },
    });

    // Get existing workspace tags
    const existingTags = await prisma.workspaceTag.findMany({
      where: { workspaceId: list.space.workspaceId },
      select: { id: true, name: true },
    });
    const tagMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const title = mapping.title ? row[mapping.title]?.trim() : '';

        if (!title) {
          result.failed++;
          result.errors.push({ row: i + 1, error: 'Title is empty' });
          continue;
        }

        // Resolve status
        let statusName: string | undefined;
        let statusColor: string | undefined;
        if (mapping.status && row[mapping.status]) {
          const rawStatus = row[mapping.status].trim();
          const matched = listStatuses.find(
            (s) => s.name.toLowerCase() === rawStatus.toLowerCase(),
          );
          if (matched) {
            statusName = matched.name;
            statusColor = matched.color ?? undefined;
          } else {
            statusName = rawStatus;
          }
        }

        // Resolve priority
        let priority: TaskPriority = 'NONE';
        if (mapping.priority && row[mapping.priority]) {
          const raw = row[mapping.priority].trim().toUpperCase();
          if (['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(raw)) {
            priority = raw as TaskPriority;
          }
        }

        // Resolve due date
        let dueDate: Date | undefined;
        if (mapping.dueDate && row[mapping.dueDate]) {
          const parsed = new Date(row[mapping.dueDate].trim());
          if (!isNaN(parsed.getTime())) {
            dueDate = parsed;
          }
        }

        // Resolve start date
        let startDate: Date | undefined;
        if (mapping.startDate && row[mapping.startDate]) {
          const parsed = new Date(row[mapping.startDate].trim());
          if (!isNaN(parsed.getTime())) {
            startDate = parsed;
          }
        }

        // Resolve assignees by email
        const assigneeConnects: { userId: string }[] = [];
        if (mapping.assignee && row[mapping.assignee]) {
          const emails = row[mapping.assignee].split(',').map((e) => e.trim()).filter(Boolean);
          for (const email of emails) {
            const user = await prisma.user.findFirst({
              where: { email: { equals: email, mode: 'insensitive' } },
              select: { id: true },
            });
            if (user) {
              assigneeConnects.push({ userId: user.id });
            }
          }
        }

        // Resolve tags
        const tagConnects: { tagId: string }[] = [];
        if (mapping.tags && row[mapping.tags]) {
          const tagNames = row[mapping.tags].split(',').map((t) => t.trim()).filter(Boolean);
          for (const tagName of tagNames) {
            let tagId = tagMap.get(tagName.toLowerCase());
            if (!tagId) {
              // Create the tag
              const newTag = await prisma.workspaceTag.create({
                data: { name: tagName, workspaceId: list.space.workspaceId, createdById: userId },
              });
              tagId = newTag.id;
              tagMap.set(tagName.toLowerCase(), tagId);
            }
            tagConnects.push({ tagId });
          }
        }

        // Time estimate
        let timeEstimate: number | undefined;
        if (mapping.timeEstimate && row[mapping.timeEstimate]) {
          const parsed = parseInt(row[mapping.timeEstimate].trim(), 10);
          if (!isNaN(parsed)) {
            timeEstimate = parsed;
          }
        }

        // Generate custom task ID
        let customTaskId: string | null = null;
        if (list.space.taskIdPrefix) {
          const updated = await prisma.space.update({
            where: { id: list.space.id },
            data: { taskIdCounter: { increment: 1 } },
            select: { taskIdCounter: true, taskIdPrefix: true },
          });
          customTaskId = `${updated.taskIdPrefix}-${String(updated.taskIdCounter).padStart(3, '0')}`;
        }

        // Calculate position
        const lastTask = await prisma.task.findFirst({
          where: { listId, deletedAt: null },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        const position = (lastTask?.position ?? 0) + 65536;

        // Create the task
        await prisma.task.create({
          data: {
            projectId: projectId!,
            listId,
            title,
            descriptionHtml: mapping.description ? row[mapping.description] || undefined : undefined,
            status: statusName ? 'TODO' : 'TODO',
            statusName,
            statusColor,
            priority,
            dueDate,
            startDate,
            timeEstimate,
            customTaskId,
            position,
            createdById: userId,
            assignees: assigneeConnects.length > 0
              ? { create: assigneeConnects }
              : undefined,
            workspaceTags: tagConnects.length > 0
              ? { create: tagConnects }
              : undefined,
          },
        });

        result.created++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({ row: i + 1, error: err.message || 'Unknown error' });
      }
    }

    return result;
  }

  /**
   * Suggest column-to-field mapping based on column header names.
   */
  private suggestMapping(columns: string[]): ColumnMapping {
    const mapping: ColumnMapping = { title: '' };

    const matchers: Array<{ field: keyof ColumnMapping; patterns: RegExp[] }> = [
      { field: 'title', patterns: [/^title$/i, /^task.*name$/i, /^name$/i, /^task$/i, /^summary$/i] },
      { field: 'description', patterns: [/^desc/i, /^detail/i, /^note/i, /^body$/i] },
      { field: 'status', patterns: [/^status$/i, /^state$/i, /^stage$/i] },
      { field: 'priority', patterns: [/^priority$/i, /^urgency$/i, /^prio$/i] },
      { field: 'dueDate', patterns: [/^due/i, /^deadline$/i, /^end.*date$/i] },
      { field: 'startDate', patterns: [/^start/i, /^begin/i] },
      { field: 'assignee', patterns: [/^assign/i, /^owner$/i, /^responsible$/i, /^who$/i] },
      { field: 'tags', patterns: [/^tag/i, /^label/i, /^category$/i] },
      { field: 'timeEstimate', patterns: [/^time/i, /^estimate/i, /^effort$/i, /^hours$/i, /^minutes$/i] },
    ];

    for (const col of columns) {
      for (const { field, patterns } of matchers) {
        if (!mapping[field] && patterns.some((p) => p.test(col))) {
          mapping[field] = col;
          break;
        }
      }
    }

    // Fallback: if no title found, use first column
    if (!mapping.title && columns.length > 0) {
      mapping.title = columns[0];
    }

    return mapping;
  }

  /**
   * Parse CSV text handling quoted fields, commas inside quotes, etc.
   */
  private parseCSVLines(text: string): string[][] {
    const result: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          current.push(field);
          field = '';
          i++;
        } else if (ch === '\r') {
          // Skip \r, handle \n
          i++;
        } else if (ch === '\n') {
          current.push(field);
          field = '';
          result.push(current);
          current = [];
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }

    // Last field/row
    if (field || current.length > 0) {
      current.push(field);
      result.push(current);
    }

    return result;
  }

  /**
   * Generate a CSV template with standard headers.
   */
  generateTemplate(): string {
    const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Start Date', 'Assignee(s)', 'Tags', 'Time Estimate (min)'];
    const exampleRow = ['Example Task', 'Task description here', 'To Do', 'MEDIUM', '2026-04-01', '2026-03-28', 'user@example.com', 'tag1, tag2', '60'];
    return [headers.join(','), exampleRow.join(',')].join('\n');
  }
}

export const importService = new ImportService();
