import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { BulkActionToolbar } from '@/components/shared/BulkActionToolbar';
import { CustomFieldRenderer } from '@/modules/custom-fields/CustomFieldRenderer';
import { CustomFieldValue } from '@/modules/custom-fields/CustomFieldValue';
import type { FieldDefinition } from '@/hooks/useCustomFields';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  Layers,
  Calendar,
  Users,
  Tag,
  Flag,
  Circle,
  Clock,
  Hash,
  Type,
  CheckSquare,
  Star,
  BarChart3,
  DollarSign,
  List,
  AlignLeft,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  statusName?: string;
  statusColor?: string;
  priority: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  dueDate?: string;
  tags?: { id: string; name: string; color: string }[];
  timeEstimate?: number;
  createdAt?: string;
  customFieldValues?: Record<string, any>;
  [key: string]: any;
}

interface TaskGroup {
  name: string;
  value: string;
  count: number;
  tasks: any[];
}

interface TableViewProps {
  tasks: any[];
  groups?: TaskGroup[];
  isLoading: boolean;
  groupBy?: string;
  listId?: string;
  spaceId?: string;
  customFields?: any[];
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: string;
  label: string;
  icon: React.ElementType;
  width: number;
  minWidth: number;
  type: 'text' | 'status' | 'assignee' | 'date' | 'priority' | 'tags' | 'time' | 'custom';
  customField?: FieldDefinition;
}

interface EditingCell {
  rowId: string;
  colKey: string;
}

// -----------------------------------------------
// Constants
// -----------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-accent-red bg-accent-red/10',
  high: 'text-orange-400 bg-orange-400/10',
  medium: 'text-cx-warning bg-yellow-400/10',
  low: 'text-cx-brand bg-cx-brand/10',
  none: 'text-text-tertiary bg-bg-tertiary',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none'];

const STATUS_PRESETS = ['To Do', 'In Progress', 'In Review', 'Done', 'Closed'];

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  TEXT: Type,
  LONG_TEXT: AlignLeft,
  NUMBER: Hash,
  MONEY: DollarSign,
  DROPDOWN: List,
  MULTI_SELECT: List,
  LABEL: Tag,
  DATE: Calendar,
  CHECKBOX: CheckSquare,
  RATING: Star,
  PROGRESS: BarChart3,
  PEOPLE: Users,
};

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function formatDate(dateStr: string | undefined): { label: string; className: string } {
  if (!dateStr) return { label: '', className: '' };
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diffDays < 0) return { label, className: 'text-accent-red' };
    if (diffDays === 0) return { label: 'Today', className: 'text-orange-400' };
    if (diffDays === 1) return { label: 'Tomorrow', className: 'text-cx-warning' };
    return { label, className: 'text-text-secondary' };
  } catch {
    return { label: String(dateStr), className: 'text-text-secondary' };
  }
}

function formatTime(minutes: number | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getCustomFieldValue(task: Task, fieldId: string): any {
  if (task.customFieldValues && task.customFieldValues[fieldId] !== undefined) {
    return task.customFieldValues[fieldId];
  }
  // Also check nested field values array
  if (Array.isArray((task as any).fieldValues)) {
    const fv = (task as any).fieldValues.find((v: any) => v.fieldId === fieldId);
    if (fv) {
      return fv.valueText ?? fv.valueNumber ?? fv.valueDate ?? fv.valueBoolean ?? fv.valueJson ?? null;
    }
  }
  return null;
}

// -----------------------------------------------
// Cell renderers
// -----------------------------------------------

function StatusCell({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: color ? `${color}20` : '#6b728020',
        color: color || '#6b7280',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color || '#6b7280' }}
      />
      {value}
    </span>
  );
}

function PriorityCell({ value }: { value: string }) {
  const key = (value ?? 'none').toLowerCase();
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[key] ?? PRIORITY_COLORS.none)}>
      <Flag size={10} />
      {PRIORITY_LABELS[key] ?? 'None'}
    </span>
  );
}

function AssigneeCell({ assignees }: { assignees?: Task['assignees'] }) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-[10px] text-text-tertiary">--</span>;
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="w-5 h-5 rounded-full bg-accent-blue/20 border border-bg-primary flex items-center justify-center text-[8px] font-medium text-accent-blue"
          title={a.displayName}
        >
          {a.avatarUrl ? (
            <img src={a.avatarUrl} alt={a.displayName} className="w-full h-full rounded-full object-cover" />
          ) : (
            a.displayName?.charAt(0).toUpperCase() ?? '?'
          )}
        </div>
      ))}
      {assignees.length > 3 && (
        <span className="text-[9px] text-text-tertiary ml-1">+{assignees.length - 3}</span>
      )}
    </div>
  );
}

function TagsCell({ tags }: { tags?: Task['tags'] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-[10px] text-text-tertiary">--</span>;
  }
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag.id}
          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: tag.color + '20', color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="text-[9px] text-text-tertiary">+{tags.length - 2}</span>
      )}
    </div>
  );
}

// -----------------------------------------------
// Inline editors
// -----------------------------------------------

function StatusEditor({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <select
      autoFocus
      defaultValue={value}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      className="h-7 px-1 text-[11px] bg-bg-tertiary border border-accent-blue rounded text-text-primary focus:outline-none w-full"
    >
      {STATUS_PRESETS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function PriorityEditor({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <select
      autoFocus
      defaultValue={(value ?? 'none').toLowerCase()}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      className="h-7 px-1 text-[11px] bg-bg-tertiary border border-accent-blue rounded text-text-primary focus:outline-none w-full"
    >
      {PRIORITY_OPTIONS.map((p) => (
        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
      ))}
    </select>
  );
}

function TextEditor({
  value,
  onSave,
  onCancel,
  onTab,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  onTab?: (shift: boolean) => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(text); }
        else if (e.key === 'Escape') { onCancel(); }
        else if (e.key === 'Tab') { e.preventDefault(); onSave(text); onTab?.(e.shiftKey); }
      }}
      onBlur={() => onSave(text)}
      className="h-7 px-1 text-[11px] bg-bg-tertiary border border-accent-blue rounded text-text-primary focus:outline-none w-full"
    />
  );
}

function DateEditor({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <input
      autoFocus
      type="date"
      defaultValue={value ? new Date(value).toISOString().split('T')[0] : ''}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      className="h-7 px-1 text-[11px] bg-bg-tertiary border border-accent-blue rounded text-text-primary focus:outline-none w-full"
    />
  );
}

// -----------------------------------------------
// Column header
// -----------------------------------------------

function TableColumnHeader({
  col,
  sortKey,
  sortDir,
  onSort,
  onResizeStart,
}: {
  col: ColumnDef;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  onResizeStart: (e: React.MouseEvent, colKey: string) => void;
}) {
  const active = sortKey === col.key;
  const Icon = col.icon;

  return (
    <div
      className="relative flex items-center gap-1 h-auto text-[11px] font-medium uppercase select-none group/header border-r border-[rgba(255,255,255,0.08)]"
      style={{ width: col.width, minWidth: col.minWidth, letterSpacing: '0.05em', padding: '12px 16px', color: 'rgba(255,255,255,0.40)' }}
    >
      <button
        onClick={() => onSort(col.key)}
        className="flex items-center gap-1 hover:text-text-secondary transition-colors truncate flex-1 min-w-0"
      >
        <Icon size={11} className="flex-shrink-0" />
        <span className="truncate">{col.label}</span>
        {active && (
          sortDir === 'asc'
            ? <ArrowUp size={10} className="flex-shrink-0 text-accent-blue" />
            : <ArrowDown size={10} className="flex-shrink-0 text-accent-blue" />
        )}
      </button>
      {/* Resize handle */}
      <div
        onMouseDown={(e) => onResizeStart(e, col.key)}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-blue/30 transition-colors"
      />
    </div>
  );
}

// -----------------------------------------------
// Main Component
// -----------------------------------------------

export function TableView({
  tasks,
  groups,
  isLoading,
  groupBy,
  listId,
  spaceId: _spaceId,
  customFields,
  onTaskClick,
  onRefresh,
}: TableViewProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [newRowGroupValue, setNewRowGroupValue] = useState<string | null>(null);
  const [newRowTitle, setNewRowTitle] = useState('');
  const newRowRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build columns
  const columns = useMemo<ColumnDef[]>(() => {
    const base: ColumnDef[] = [
      { key: 'title', label: 'Task Name', icon: Type, width: 280, minWidth: 150, type: 'text' },
      { key: 'status', label: 'Status', icon: Circle, width: 130, minWidth: 90, type: 'status' },
      { key: 'assignee', label: 'Assignee', icon: Users, width: 120, minWidth: 80, type: 'assignee' },
      { key: 'dueDate', label: 'Due Date', icon: Calendar, width: 110, minWidth: 80, type: 'date' },
      { key: 'priority', label: 'Priority', icon: Flag, width: 110, minWidth: 80, type: 'priority' },
      { key: 'tags', label: 'Tags', icon: Tag, width: 140, minWidth: 80, type: 'tags' },
      { key: 'timeEstimate', label: 'Estimate', icon: Clock, width: 90, minWidth: 60, type: 'time' },
      { key: 'createdAt', label: 'Created', icon: Calendar, width: 100, minWidth: 80, type: 'date' },
    ];

    // Add custom field columns
    if (customFields && customFields.length > 0) {
      for (const field of customFields as FieldDefinition[]) {
        base.push({
          key: `cf_${field.id}`,
          label: field.name,
          icon: FIELD_TYPE_ICONS[field.fieldType] ?? Hash,
          width: 130,
          minWidth: 80,
          type: 'custom',
          customField: field,
        });
      }
    }

    return base;
  }, [customFields]);

  // Apply stored widths
  const resolvedColumns = useMemo(() =>
    columns.map((c) => ({ ...c, width: columnWidths[c.key] ?? c.width })),
    [columns, columnWidths],
  );

  // Frozen columns: row # (40px), checkbox (36px), task name (first col)
  const frozenCols = resolvedColumns.slice(0, 1); // task name
  const scrollCols = resolvedColumns.slice(1);

  const frozenWidth = 40 + 36 + frozenCols.reduce((sum, c) => sum + c.width, 0);

  // Flatten tasks for rendering
  const flatTasks = useMemo(() => {
    let allTasks: Task[] = [];

    if (groups && groups.length > 0) {
      for (const g of groups) {
        allTasks = [...allTasks, ...(g.tasks as Task[])];
      }
    } else {
      allTasks = tasks as Task[];
    }

    // Apply local sort
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      allTasks = [...allTasks].sort((a, b) => {
        switch (sortKey) {
          case 'title': return dir * (a.title ?? '').localeCompare(b.title ?? '');
          case 'status': return dir * ((a.statusName ?? a.status ?? '').localeCompare(b.statusName ?? b.status ?? ''));
          case 'priority': return dir * ((PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0));
          case 'dueDate': {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return dir * (da - db);
          }
          case 'assignee': return dir * ((a.assignees?.[0]?.displayName ?? '').localeCompare(b.assignees?.[0]?.displayName ?? ''));
          case 'createdAt': {
            const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dir * (ca - cb);
          }
          default: return 0;
        }
      });
    }

    return allTasks;
  }, [tasks, groups, sortKey, sortDir]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async ({ taskId, patch }: { taskId: string; patch: Record<string, unknown> }) => {
      const { data } = await api.patch(`/tasks/${taskId}`, patch);
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onRefresh();
    },
    onError: () => toast('Failed to update', 'error'),
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const payload: Record<string, unknown> = { title };
      if (listId) payload.listId = listId;
      if (newRowGroupValue && groupBy === 'status') payload.statusName = newRowGroupValue;
      const { data } = await api.post('/tasks', payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      setNewRowTitle('');
      setNewRowGroupValue(null);
      onRefresh();
      toast('Task created', 'success');
    },
    onError: () => toast('Failed to create task', 'error'),
  });

  // Handlers
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === flatTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(flatTasks.map((t) => t.id)));
    }
  }, [selectedIds.size, flatTasks]);

  const handleCellSave = useCallback((taskId: string, colKey: string, value: any) => {
    setEditingCell(null);
    const patch: Record<string, unknown> = {};
    switch (colKey) {
      case 'title': patch.title = value; break;
      case 'status': patch.statusName = value; break;
      case 'priority': patch.priority = value; break;
      case 'dueDate': patch.dueDate = value || null; break;
      default: break;
    }
    if (Object.keys(patch).length > 0) {
      updateMutation.mutate({ taskId, patch });
    }
  }, [updateMutation]);

  const handleTabNavigation = useCallback((currentRowId: string, currentColKey: string, shift: boolean) => {
    const colKeys = resolvedColumns.map((c) => c.key);
    const currentColIdx = colKeys.indexOf(currentColKey);
    const rowIds = flatTasks.map((t) => t.id);
    const currentRowIdx = rowIds.indexOf(currentRowId);

    let nextColIdx = shift ? currentColIdx - 1 : currentColIdx + 1;
    let nextRowIdx = currentRowIdx;

    if (nextColIdx >= colKeys.length) {
      nextColIdx = 0;
      nextRowIdx++;
    } else if (nextColIdx < 0) {
      nextColIdx = colKeys.length - 1;
      nextRowIdx--;
    }

    if (nextRowIdx >= 0 && nextRowIdx < rowIds.length) {
      setEditingCell({ rowId: rowIds[nextRowIdx], colKey: colKeys[nextColIdx] });
    }
  }, [resolvedColumns, flatTasks]);

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const col = resolvedColumns.find((c) => c.key === colKey);
    if (!col) return;
    resizingRef.current = { colKey, startX: e.clientX, startWidth: col.width };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const colDef = columns.find((c) => c.key === resizingRef.current!.colKey);
      const newWidth = Math.max(colDef?.minWidth ?? 60, resizingRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [resolvedColumns, columns]);

  const handleNewRow = useCallback((groupValue?: string) => {
    setNewRowGroupValue(groupValue ?? null);
    setTimeout(() => newRowRef.current?.focus(), 50);
  }, []);

  const handleNewRowSubmit = useCallback(() => {
    const trimmed = newRowTitle.trim();
    if (!trimmed) {
      setNewRowGroupValue(null);
      return;
    }
    createMutation.mutate(trimmed);
  }, [newRowTitle, createMutation]);

  // Render cell content
  const renderCell = useCallback((task: Task, col: ColumnDef, rowIdx: number): React.ReactNode => {
    const isEditing = editingCell?.rowId === task.id && editingCell?.colKey === col.key;

    switch (col.type) {
      case 'text':
        if (isEditing) {
          return (
            <TextEditor
              value={task.title}
              onSave={(v) => handleCellSave(task.id, col.key, v)}
              onCancel={() => setEditingCell(null)}
              onTab={(shift) => handleTabNavigation(task.id, col.key, shift)}
            />
          );
        }
        return (
          <span className="text-[12px] text-text-primary truncate cursor-pointer" onClick={() => onTaskClick(task.id)}>
            {task.title}
          </span>
        );

      case 'status':
        if (isEditing) {
          return (
            <StatusEditor
              value={task.statusName ?? task.status}
              onSave={(v) => handleCellSave(task.id, col.key, v)}
              onCancel={() => setEditingCell(null)}
            />
          );
        }
        return <StatusCell value={task.statusName ?? task.status} color={task.statusColor} />;

      case 'priority':
        if (isEditing) {
          return (
            <PriorityEditor
              value={task.priority}
              onSave={(v) => handleCellSave(task.id, col.key, v)}
              onCancel={() => setEditingCell(null)}
            />
          );
        }
        return <PriorityCell value={task.priority} />;

      case 'assignee':
        return <AssigneeCell assignees={task.assignees} />;

      case 'date':
        if (col.key === 'dueDate') {
          if (isEditing) {
            return (
              <DateEditor
                value={task.dueDate ?? ''}
                onSave={(v) => handleCellSave(task.id, col.key, v)}
                onCancel={() => setEditingCell(null)}
              />
            );
          }
          const dateInfo = formatDate(task.dueDate);
          return dateInfo.label
            ? <span className={cn('text-[11px]', dateInfo.className)}>{dateInfo.label}</span>
            : <span className="text-[10px] text-text-tertiary">--</span>;
        }
        // createdAt
        if (task.createdAt) {
          const d = new Date(task.createdAt);
          return (
            <span className="text-[11px] text-text-tertiary">
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          );
        }
        return <span className="text-[10px] text-text-tertiary">--</span>;

      case 'tags':
        return <TagsCell tags={task.tags} />;

      case 'time':
        return task.timeEstimate
          ? <span className="text-[11px] text-text-secondary font-mono">{formatTime(task.timeEstimate)}</span>
          : <span className="text-[10px] text-text-tertiary">--</span>;

      case 'custom': {
        if (!col.customField) return <span className="text-[10px] text-text-tertiary">--</span>;
        const cfValue = getCustomFieldValue(task, col.customField.id);
        if (isEditing) {
          return (
            <CustomFieldRenderer
              field={col.customField}
              value={cfValue}
              onChange={(v) => {
                // Fire update then close editing
                setEditingCell(null);
                // Custom field update would go through a different API
              }}
              compact
            />
          );
        }
        return <CustomFieldValue field={col.customField} value={cfValue} />;
      }

      default:
        return null;
    }
  }, [editingCell, handleCellSave, handleTabNavigation, onTaskClick]);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-8 bg-bg-tertiary rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }

  // ---- Empty ----
  if (flatTasks.length === 0 && (!groups || groups.every((g) => g.tasks.length === 0))) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-tertiary">
        <Layers size={40} className="mb-4 opacity-30" />
        <p className="text-sm font-medium text-text-secondary">No data</p>
        <p className="text-xs mt-1 opacity-70">Create a task to populate this table</p>
      </div>
    );
  }

  // Build row data: grouped or flat
  const renderGroupedRows = () => {
    if (!groups || groups.length === 0 || !groupBy) {
      return renderFlatRows(flatTasks, 0);
    }

    let globalRowIdx = 0;
    return groups.map((group) => {
      const isCollapsed = collapsedGroups.has(group.value);
      const startIdx = globalRowIdx;
      if (!isCollapsed) globalRowIdx += group.tasks.length;

      return (
        <div key={group.value}>
          {/* Group header */}
          <div
            className="flex items-center gap-2 px-2 h-8 bg-bg-tertiary/60 border-b border-border-secondary/50 cursor-pointer hover:bg-bg-hover/50 transition-colors"
            onClick={() => toggleGroup(group.value)}
            style={{ paddingLeft: 40 + 36 + 8 }}
          >
            {isCollapsed
              ? <ChevronRight size={14} className="text-text-tertiary" />
              : <ChevronDown size={14} className="text-text-tertiary" />
            }
            <span className="text-[11px] font-semibold text-text-primary">{group.name}</span>
            <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">{group.count}</span>
          </div>
          {/* Group tasks */}
          {!isCollapsed && renderFlatRows(group.tasks as Task[], startIdx)}
          {/* Add row for this group */}
          {!isCollapsed && (
            <div
              className="flex items-center h-7 border-b border-border-secondary/30 cursor-pointer hover:bg-bg-hover/30 transition-colors"
              style={{ paddingLeft: 40 + 36 + 8 }}
            >
              {newRowGroupValue === group.value ? (
                <input
                  ref={newRowRef}
                  type="text"
                  value={newRowTitle}
                  onChange={(e) => setNewRowTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNewRowSubmit();
                    if (e.key === 'Escape') { setNewRowGroupValue(null); setNewRowTitle(''); }
                  }}
                  onBlur={() => { if (!newRowTitle.trim()) { setNewRowGroupValue(null); setNewRowTitle(''); } }}
                  placeholder="Task name... Enter to save"
                  className="text-[11px] bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary w-60"
                  disabled={createMutation.isPending}
                />
              ) : (
                <button
                  onClick={() => handleNewRow(group.value)}
                  className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary"
                >
                  <Plus size={12} />
                  Add task
                </button>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const renderFlatRows = (rowTasks: Task[], startIdx: number) => {
    return rowTasks.map((task, i) => {
      const rowNum = startIdx + i + 1;
      const isSelected = selectedIds.has(task.id);

      return (
        <div
          key={task.id}
          className={cn(
            'flex items-stretch border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors group/row',
            isSelected && 'bg-accent-blue/5',
          )}
          style={{ height: '32px' }}
        >
          {/* Frozen: Row # */}
          <div className="flex items-center justify-center w-[40px] flex-shrink-0 text-[13px] text-[rgba(255,255,255,0.65)] border-r border-[rgba(255,255,255,0.04)] bg-[#09090B] sticky left-0 z-10">
            {rowNum}
          </div>

          {/* Frozen: Checkbox */}
          <div className="flex items-center justify-center w-[36px] flex-shrink-0 border-r border-[rgba(255,255,255,0.04)] bg-[#09090B] sticky left-[40px] z-10">
            <button
              onClick={() => toggleSelect(task.id)}
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-accent-blue border-accent-blue text-white'
                  : 'border-border-secondary text-transparent hover:border-border-primary group-hover/row:border-border-primary',
              )}
            >
              {isSelected && (
                <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Frozen: Task name */}
          {frozenCols.map((col) => (
            <div
              key={col.key}
              className={cn(
                'flex items-center border-r border-[rgba(255,255,255,0.04)] bg-[#09090B] sticky z-10 min-w-0 overflow-hidden',
              )}
              style={{ width: col.width, left: 76, padding: '8px 12px', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}
              onDoubleClick={() => setEditingCell({ rowId: task.id, colKey: col.key })}
            >
              {renderCell(task, col, rowNum)}
            </div>
          ))}

          {/* Scrollable columns */}
          {scrollCols.map((col) => (
            <div
              key={col.key}
              className="flex items-center border-r border-[rgba(255,255,255,0.04)] min-w-0 overflow-hidden flex-shrink-0"
              style={{ width: col.width, padding: '8px 12px', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}
              onDoubleClick={() => setEditingCell({ rowId: task.id, colKey: col.key })}
            >
              {renderCell(task, col, rowNum)}
            </div>
          ))}
        </div>
      );
    });
  };

  const allSelected = flatTasks.length > 0 && selectedIds.size === flatTasks.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Table container */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {/* Header row */}
        <div className="flex items-stretch bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.08)] sticky top-0 z-20">
          {/* Frozen: Row # header */}
          <div className="flex items-center justify-center w-[40px] flex-shrink-0 border-r border-[rgba(255,255,255,0.08)] sticky left-0 z-30 bg-[rgba(255,255,255,0.02)]">
            <span className="text-[11px] font-medium uppercase text-[rgba(255,255,255,0.40)]" style={{ letterSpacing: '0.05em' }}>#</span>
          </div>

          {/* Frozen: Checkbox header */}
          <div className="flex items-center justify-center w-[36px] flex-shrink-0 border-r border-[rgba(255,255,255,0.08)] sticky left-[40px] z-30 bg-[rgba(255,255,255,0.02)]">
            <button
              onClick={toggleSelectAll}
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                allSelected
                  ? 'bg-accent-blue border-accent-blue text-white'
                  : 'border-border-secondary text-transparent hover:border-border-primary',
              )}
            >
              {allSelected && (
                <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Frozen: Task name header */}
          {frozenCols.map((col) => (
            <div
              key={col.key}
              className="sticky z-30 bg-[rgba(255,255,255,0.02)]"
              style={{ left: 76 }}
            >
              <TableColumnHeader
                col={col}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onResizeStart={handleResizeStart}
              />
            </div>
          ))}

          {/* Scrollable column headers */}
          {scrollCols.map((col) => (
            <TableColumnHeader
              key={col.key}
              col={col}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onResizeStart={handleResizeStart}
            />
          ))}
        </div>

        {/* Rows */}
        {renderGroupedRows()}

        {/* Add row (flat, no grouping) */}
        {(!groups || groups.length === 0 || !groupBy) && (
          <div
            className="flex items-center h-7 border-b border-border-secondary/30 cursor-pointer hover:bg-bg-hover/30 transition-colors"
            style={{ paddingLeft: 76 + 8 }}
          >
            {newRowGroupValue === '__flat__' ? (
              <input
                ref={newRowRef}
                type="text"
                value={newRowTitle}
                onChange={(e) => setNewRowTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewRowSubmit();
                  if (e.key === 'Escape') { setNewRowGroupValue(null); setNewRowTitle(''); }
                }}
                onBlur={() => { if (!newRowTitle.trim()) { setNewRowGroupValue(null); setNewRowTitle(''); } }}
                placeholder="Task name... Enter to save"
                className="text-[11px] bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary w-60"
                disabled={createMutation.isPending}
              />
            ) : (
              <button
                onClick={() => handleNewRow('__flat__')}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary"
              >
                <Plus size={12} />
                Add task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedTaskIds={[...selectedIds]}
          onClearSelection={() => setSelectedIds(new Set())}
          listId={listId}
          onActionComplete={() => {
            setSelectedIds(new Set());
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
