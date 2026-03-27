import { TaskQueryService, taskQueryService } from './task-query.service';
import { viewsService } from './views.service';
import type { TaskQueryInput } from './views.validation';

/**
 * Export tasks as CSV or JSON from a view query.
 */
export class ExportService {
  private queryService: TaskQueryService;

  constructor() {
    this.queryService = taskQueryService;
  }

  /**
   * Export tasks as CSV string.
   * Fetches all tasks (no pagination) and builds a CSV with standard + custom field columns.
   */
  async exportCSV(queryParams: TaskQueryInput, customFields?: string[]): Promise<string> {
    const tasks = await this.fetchAllTasks(queryParams);

    // Determine custom field columns from the first batch of tasks
    const cfColumns = this.detectCustomFieldColumns(tasks, customFields);

    // Build header row
    const headers = [
      'Task ID',
      'Title',
      'Status',
      'Priority',
      'Assignee(s)',
      'Due Date',
      'Start Date',
      'Tags',
      'Time Estimate (min)',
      'List',
      'Description',
      ...cfColumns.map((cf) => cf.name),
    ];

    const rows: string[][] = [headers];

    for (const task of tasks) {
      const row: string[] = [
        task.customTaskId || task.id || '',
        task.title || '',
        task.statusName || task.status || '',
        task.priority || 'NONE',
        this.formatAssignees(task),
        task.dueDate ? new Date(task.dueDate).toISOString() : '',
        task.startDate ? new Date(task.startDate).toISOString() : '',
        this.formatTags(task),
        task.timeEstimate != null ? String(task.timeEstimate) : '',
        task.list?.name || '',
        (task.descriptionHtml || '').replace(/<[^>]*>/g, '').replace(/\n/g, ' '),
        ...cfColumns.map((cf) => this.getCustomFieldValue(task, cf.id)),
      ];
      rows.push(row);
    }

    return this.buildCSVString(rows);
  }

  /**
   * Export tasks as a JSON string.
   */
  async exportJSON(queryParams: TaskQueryInput): Promise<string> {
    const tasks = await this.fetchAllTasks(queryParams);

    const cleaned = tasks.map((task: any) => ({
      id: task.id,
      customTaskId: task.customTaskId || null,
      title: task.title,
      status: task.statusName || task.status,
      priority: task.priority,
      assignees: (task.assignees || []).map((a: any) => ({
        id: a.user?.id || a.userId,
        name: a.user?.displayName || '',
        email: a.user?.email || '',
      })),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      startDate: task.startDate ? new Date(task.startDate).toISOString() : null,
      tags: (task.workspaceTags || []).map((t: any) => t.tag?.name || ''),
      timeEstimate: task.timeEstimate,
      list: task.list?.name || null,
      description: task.descriptionHtml || null,
      customFields: (task.customFieldValues || []).map((cfv: any) => ({
        name: cfv.field?.name || '',
        type: cfv.field?.fieldType || '',
        value: cfv.valueText ?? cfv.valueNumber ?? cfv.valueDate ?? null,
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    return JSON.stringify(cleaned, null, 2);
  }

  /**
   * Fetch all tasks for export (override pagination to get everything).
   */
  private async fetchAllTasks(queryParams: TaskQueryInput): Promise<any[]> {
    const allTasks: any[] = [];
    let page = 1;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
      const result = await this.queryService.executeQuery({
        ...queryParams,
        showClosedTasks: true, // export includes all tasks
        page,
        limit,
      });

      if (result.groups) {
        // Grouped results: flatten
        for (const group of result.groups) {
          allTasks.push(...group.tasks);
        }
        hasMore = false; // grouped queries return all
      } else if (result.tasks) {
        allTasks.push(...result.tasks);
        hasMore = result.hasMore;
      } else {
        hasMore = false;
      }
      page++;
    }

    return allTasks;
  }

  private detectCustomFieldColumns(
    tasks: any[],
    requestedFields?: string[],
  ): Array<{ id: string; name: string }> {
    const fieldMap = new Map<string, string>();

    for (const task of tasks) {
      if (task.customFieldValues) {
        for (const cfv of task.customFieldValues) {
          if (cfv.field && !fieldMap.has(cfv.field.id)) {
            fieldMap.set(cfv.field.id, cfv.field.name);
          }
        }
      }
    }

    if (requestedFields && requestedFields.length > 0) {
      return requestedFields
        .filter((id) => fieldMap.has(id))
        .map((id) => ({ id, name: fieldMap.get(id)! }));
    }

    return Array.from(fieldMap.entries()).map(([id, name]) => ({ id, name }));
  }

  private formatAssignees(task: any): string {
    if (!task.assignees || task.assignees.length === 0) return '';
    return task.assignees
      .map((a: any) => a.user?.displayName || a.user?.email || '')
      .filter(Boolean)
      .join(', ');
  }

  private formatTags(task: any): string {
    if (!task.workspaceTags || task.workspaceTags.length === 0) return '';
    return task.workspaceTags
      .map((t: any) => t.tag?.name || '')
      .filter(Boolean)
      .join(', ');
  }

  private getCustomFieldValue(task: any, fieldId: string): string {
    if (!task.customFieldValues) return '';
    const cfv = task.customFieldValues.find((v: any) => v.field?.id === fieldId || v.fieldId === fieldId);
    if (!cfv) return '';

    if (cfv.valueText != null) return String(cfv.valueText);
    if (cfv.valueNumber != null) return String(cfv.valueNumber);
    if (cfv.valueDate != null) return new Date(cfv.valueDate).toISOString();
    return '';
  }

  private buildCSVString(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(','),
      )
      .join('\n');
  }
}

export const exportService = new ExportService();
