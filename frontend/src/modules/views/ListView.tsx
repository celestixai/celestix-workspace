import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { BulkActionToolbar } from '@/components/shared/BulkActionToolbar';
import {
  CheckSquare,
  Bug,
  Star,
  Circle,
  Flag,
  Link2,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListPlus,
  ExternalLink,
  Layers,
  Calendar,
  Users,
  Tag,
  CheckCircle2,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  statusColor?: string;
  priority: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  dueDate?: string;
  taskTypeId?: string;
  customTaskId?: string;
  tags?: { id: string; name: string; color: string }[];
  relationships?: {
    blocking: unknown[];
    waitingOn: unknown[];
    linkedTo: unknown[];
  };
  subtaskCount?: number;
  subtasks?: Task[];
  parentId?: string;
}

interface TaskGroup {
  name: string;
  value: string;
  count: number;
  tasks: any[];
  color?: string;
}

interface ListViewProps {
  tasks: any[];
  groups?: TaskGroup[];
  isLoading: boolean;
  groupBy?: string;
  listId?: string;
  spaceId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
  customFields?: any[];
}

type SortDir = 'asc' | 'desc';
type SortKey = 'title' | 'status' | 'assignee' | 'dueDate' | 'priority' | 'tags';

// -----------------------------------------------
// Constants
// -----------------------------------------------

const TASK_TYPE_ICON_MAP: Record<string, React.ElementType> = {
  'check-square': CheckSquare,
  bug: Bug,
  star: Star,
  flag: Flag,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-accent-red bg-accent-red/10',
  high: 'text-orange-400 bg-orange-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  low: 'text-blue-400 bg-blue-400/10',
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

const STATUS_PRESETS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none'];

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
    if (diffDays === 1) return { label: 'Tomorrow', className: 'text-yellow-400' };
    return { label, className: 'text-text-secondary' };
  } catch {
    return { label: String(dateStr), className: 'text-text-secondary' };
  }
}

function sortTasks(tasks: Task[], sortKey: SortKey, sortDir: SortDir): Task[] {
  const sorted = [...tasks];
  const dir = sortDir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sortKey) {
      case 'title':
        return dir * a.title.localeCompare(b.title);
      case 'status':
        return dir * (a.status ?? '').localeCompare(b.status ?? '');
      case 'priority':
        return dir * ((PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0));
      case 'dueDate': {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dir * (da - db);
      }
      case 'assignee': {
        const aa = a.assignees?.[0]?.displayName ?? '';
        const ab = b.assignees?.[0]?.displayName ?? '';
        return dir * aa.localeCompare(ab);
      }
      case 'tags': {
        const ta = a.tags?.[0]?.name ?? '';
        const tb = b.tags?.[0]?.name ?? '';
        return dir * ta.localeCompare(tb);
      }
      default:
        return 0;
    }
  });
  return sorted;
}

// -----------------------------------------------
// Sub-components
// -----------------------------------------------

function ColumnHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
  icon: Icon,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  icon?: React.ElementType;
}) {
  const active = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-text-tertiary hover:text-text-secondary transition-colors select-none',
        className,
      )}
    >
      {Icon && <Icon size={12} />}
      {label}
      {active ? (
        currentDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
      ) : (
        <ArrowUpDown size={10} className="opacity-0 group-hover/header:opacity-50" />
      )}
    </button>
  );
}

function StatusPill({
  status,
  color,
  onClick,
}: {
  status: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-border-secondary hover:border-border-primary transition-colors cursor-pointer whitespace-nowrap"
      style={{ color: color || undefined, borderColor: color ? `${color}40` : undefined, backgroundColor: color ? `${color}10` : undefined }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color || 'currentColor' }} />
      {status}
    </button>
  );
}

function AvatarStack({ assignees }: { assignees: Task['assignees'] }) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-text-tertiary text-[11px]">--</span>;
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="w-6 h-6 rounded-full bg-accent-blue/20 border-2 border-bg-primary flex items-center justify-center text-[9px] font-medium text-accent-blue"
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
        <div className="w-6 h-6 rounded-full bg-bg-tertiary border-2 border-bg-primary flex items-center justify-center text-[9px] text-text-tertiary">
          +{assignees.length - 3}
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority, onClick }: { priority: string; onClick?: () => void }) {
  const p = (priority ?? 'none').toLowerCase();
  if (p === 'none') return <span className="text-text-tertiary text-[11px]">--</span>;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors',
        PRIORITY_COLORS[p] ?? 'text-text-tertiary bg-bg-tertiary',
      )}
    >
      <Flag size={10} />
      {PRIORITY_LABELS[p] ?? p}
    </button>
  );
}

function TagChips({ tags }: { tags: Task['tags'] }) {
  if (!tags || tags.length === 0) return <span className="text-text-tertiary text-[11px]">--</span>;
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag.id}
          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
          style={{ backgroundColor: tag.color + '20', color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="text-[9px] text-text-tertiary whitespace-nowrap">+{tags.length - 2}</span>
      )}
    </div>
  );
}

// Inline dropdown for status/priority changes
function InlineDropdown({
  options,
  onSelect,
  onClose,
}: {
  options: { value: string; label: string; color?: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 top-full mt-1 left-0 min-w-[140px] bg-bg-secondary border border-border-secondary rounded-lg shadow-xl py-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {opt.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Inline date picker
function InlineDatePicker({
  currentDate,
  onSelect,
  onClose,
}: {
  currentDate?: string;
  onSelect: (date: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(currentDate ? currentDate.slice(0, 10) : '');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 top-full mt-1 left-0 bg-bg-secondary border border-border-secondary rounded-lg shadow-xl p-3 flex flex-col gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs px-2 py-1.5 rounded bg-bg-tertiary border border-border-secondary text-text-primary"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (value) onSelect(new Date(value).toISOString());
          }}
          disabled={!value}
          className="flex-1 text-xs px-2 py-1 rounded bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-40 transition-colors"
        >
          Set
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className="text-xs px-2 py-1 rounded bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// Quick-add row
function QuickAddRow({
  listId,
  groupStatus,
  onCreated,
}: {
  listId?: string;
  groupStatus?: string;
  onCreated: () => void;
}) {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const payload: any = { title };
      if (listId) payload.listId = listId;
      if (groupStatus) payload.status = groupStatus;
      const { data } = await api.post('/tasks', payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      setValue('');
      onCreated();
      toast('Task created', 'success');
    },
    onError: () => {
      toast('Failed to create task', 'error');
    },
  });

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => {
          setIsAdding(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover/50 rounded-lg transition-colors"
      >
        <Plus size={14} />
        Add task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <div className="w-4" /> {/* checkbox spacer */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') {
            setIsAdding(false);
            setValue('');
          }
        }}
        onBlur={() => {
          if (!value.trim()) {
            setIsAdding(false);
          }
        }}
        placeholder="Task name... press Enter to create"
        className="flex-1 text-sm bg-transparent border-b border-border-secondary focus:border-accent-blue outline-none text-text-primary placeholder:text-text-tertiary py-1"
        disabled={createMutation.isPending}
      />
    </div>
  );
}

// -----------------------------------------------
// Main Component
// -----------------------------------------------

export function ListView({
  tasks,
  groups,
  isLoading,
  groupBy,
  listId,
  spaceId,
  onTaskClick,
  onRefresh,
  customFields: _customFields,
}: ListViewProps) {
  const queryClient = useQueryClient();

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Expanded subtasks
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'status' | 'priority' | 'dueDate' } | null>(null);

  // Clear selection when tasks change
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
  }, [listId]);

  // Escape key deselects
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingCell) {
          setEditingCell(null);
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
          lastClickedIndex.current = null;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds.size, editingCell]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const toggleSelect = useCallback(
    (taskId: string, index: number, shiftKey: boolean, allTasks: Task[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedIndex.current !== null) {
          const start = Math.min(lastClickedIndex.current, index);
          const end = Math.max(lastClickedIndex.current, index);
          for (let i = start; i <= end; i++) {
            if (allTasks[i]) next.add(allTasks[i].id);
          }
        } else {
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
        }
        lastClickedIndex.current = index;
        return next;
      });
    },
    [],
  );

  const toggleSelectAll = useCallback(
    (allTasks: Task[]) => {
      setSelectedIds((prev) => {
        if (prev.size === allTasks.length) return new Set();
        return new Set(allTasks.map((t) => t.id));
      });
    },
    [],
  );

  const toggleGroup = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) next.delete(groupValue);
      else next.add(groupValue);
      return next;
    });
  }, []);

  const toggleSubtasks = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Inline update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ taskId, field, value }: { taskId: string; field: string; value: any }) => {
      const { data } = await api.patch(`/tasks/${taskId}`, { [field]: value });
      return data.data ?? data;
    },
    onSuccess: () => {
      setEditingCell(null);
      onRefresh();
    },
    onError: () => {
      toast('Update failed', 'error');
      setEditingCell(null);
    },
  });

  const handleInlineUpdate = useCallback(
    (taskId: string, field: string, value: any) => {
      updateMutation.mutate({ taskId, field, value });
    },
    [updateMutation],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
  }, []);

  const handleActionComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
    onRefresh();
  }, [queryClient, onRefresh]);

  // Build sorted flat task list
  const allTasks = useMemo(() => {
    const raw = tasks as Task[];
    return sortTasks(raw, sortKey, sortDir);
  }, [tasks, sortKey, sortDir]);

  // Build sorted groups
  const sortedGroups = useMemo(() => {
    if (!groups) return null;
    return groups.map((g) => ({
      ...g,
      tasks: sortTasks(g.tasks as Task[], sortKey, sortDir),
    }));
  }, [groups, sortKey, sortDir]);

  const allSelected = allTasks.length > 0 && selectedIds.size === allTasks.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Render a task row
  const renderTaskRow = (task: Task, index: number, flatList: Task[], indent: number = 0) => {
    const isSelected = selectedIds.has(task.id);
    const hasSubtasks = (task.subtaskCount ?? 0) > 0 || (task.subtasks && task.subtasks.length > 0);
    const isExpanded = expandedTasks.has(task.id);
    const hasRelationships =
      task.relationships &&
      ((task.relationships.blocking?.length ?? 0) > 0 ||
        (task.relationships.waitingOn?.length ?? 0) > 0 ||
        (task.relationships.linkedTo?.length ?? 0) > 0);
    const dateInfo = formatDate(task.dueDate);

    return (
      <div key={task.id}>
        <div
          className={cn(
            'grid grid-cols-[auto_1fr_120px_80px_100px_90px_120px] items-center gap-2 px-3 py-1.5 rounded-lg transition-colors group/row cursor-pointer',
            indent > 0 && 'opacity-80',
            isSelected ? 'bg-accent-blue/5 ring-1 ring-accent-blue/20' : 'hover:bg-bg-hover',
          )}
          style={{ paddingLeft: indent > 0 ? `${12 + indent * 24}px` : undefined }}
          onClick={() => onTaskClick(task.id)}
        >
          {/* Checkbox */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelect(task.id, index, (e.nativeEvent as MouseEvent).shiftKey, flatList)}
              className="w-3.5 h-3.5 rounded border-border-secondary accent-accent-blue cursor-pointer"
            />
          </div>

          {/* Task Name cell */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Subtask expand toggle */}
            {hasSubtasks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubtasks(task.id);
                }}
                className="text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-[14px] flex-shrink-0" />
            )}

            {/* Task type icon */}
            {(() => {
              const iconKey = (task as any).taskTypeIcon;
              const IconComp = iconKey ? TASK_TYPE_ICON_MAP[iconKey] : null;
              if (IconComp) {
                return <IconComp size={14} style={{ color: (task as any).taskTypeColor || undefined }} className="flex-shrink-0" />;
              }
              return <Circle size={14} className="text-text-tertiary flex-shrink-0" />;
            })()}

            {/* Custom task ID */}
            {task.customTaskId && (
              <span className="text-[10px] font-mono text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded flex-shrink-0">
                {task.customTaskId}
              </span>
            )}

            {/* Title */}
            <span className="text-sm text-text-primary truncate">{task.title}</span>

            {/* Subtask count badge */}
            {hasSubtasks && (
              <span className="text-[9px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded flex-shrink-0">
                {task.subtaskCount ?? task.subtasks?.length ?? 0} subtask{(task.subtaskCount ?? task.subtasks?.length ?? 0) !== 1 ? 's' : ''}
              </span>
            )}

            {/* Dependency icon */}
            {hasRelationships && (
              <Link2 size={12} className="text-accent-blue flex-shrink-0" />
            )}

            {/* Hover actions */}
            <div className="hidden group-hover/row:flex items-center gap-1 ml-auto flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick(task.id);
                }}
                className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                title="Open task"
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="relative flex justify-center" onClick={(e) => e.stopPropagation()}>
            <StatusPill
              status={task.status}
              color={task.statusColor}
              onClick={() => setEditingCell({ taskId: task.id, field: 'status' })}
            />
            {editingCell?.taskId === task.id && editingCell.field === 'status' && (
              <InlineDropdown
                options={STATUS_PRESETS.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
                onSelect={(val) => handleInlineUpdate(task.id, 'status', val)}
                onClose={() => setEditingCell(null)}
              />
            )}
          </div>

          {/* Assignee */}
          <div className="flex justify-center">
            <AvatarStack assignees={task.assignees} />
          </div>

          {/* Due Date */}
          <div className="relative flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setEditingCell({ taskId: task.id, field: 'dueDate' })}
              className={cn('text-[11px] cursor-pointer hover:underline', dateInfo.className || 'text-text-tertiary')}
            >
              {dateInfo.label || '--'}
            </button>
            {editingCell?.taskId === task.id && editingCell.field === 'dueDate' && (
              <InlineDatePicker
                currentDate={task.dueDate}
                onSelect={(val) => handleInlineUpdate(task.id, 'dueDate', val)}
                onClose={() => setEditingCell(null)}
              />
            )}
          </div>

          {/* Priority */}
          <div className="relative flex justify-center" onClick={(e) => e.stopPropagation()}>
            <PriorityBadge
              priority={task.priority}
              onClick={() => setEditingCell({ taskId: task.id, field: 'priority' })}
            />
            {editingCell?.taskId === task.id && editingCell.field === 'priority' && (
              <InlineDropdown
                options={PRIORITY_OPTIONS.map((p) => ({
                  value: p.toUpperCase(),
                  label: PRIORITY_LABELS[p] ?? p,
                  color: PRIORITY_COLORS[p]?.includes('red') ? '#ef4444' : PRIORITY_COLORS[p]?.includes('orange') ? '#fb923c' : PRIORITY_COLORS[p]?.includes('yellow') ? '#facc15' : PRIORITY_COLORS[p]?.includes('blue') ? '#60a5fa' : undefined,
                }))}
                onSelect={(val) => handleInlineUpdate(task.id, 'priority', val)}
                onClose={() => setEditingCell(null)}
              />
            )}
          </div>

          {/* Tags */}
          <div className="flex justify-start">
            <TagChips tags={task.tags} />
          </div>
        </div>

        {/* Expanded subtasks */}
        {isExpanded && task.subtasks && task.subtasks.length > 0 && (
          <div>
            {task.subtasks.map((sub, subIdx) => renderTaskRow(sub, index + subIdx + 1, flatList, indent + 1))}
          </div>
        )}
      </div>
    );
  };

  // ---- Loading State ----
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-9 bg-bg-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ---- Empty State ----
  if (allTasks.length === 0 && (!sortedGroups || sortedGroups.every((g) => g.tasks.length === 0))) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-tertiary">
        <Layers size={40} className="mb-4 opacity-30" />
        <p className="text-sm font-medium text-text-secondary">No tasks</p>
        <p className="text-xs mt-1 opacity-70">Create a task to get started</p>
        <div className="mt-4">
          <QuickAddRow listId={listId} onCreated={onRefresh} />
        </div>
      </div>
    );
  }

  // ---- Header Row ----
  const headerRow = (
    <div className="grid grid-cols-[auto_1fr_120px_80px_100px_90px_120px] items-center gap-2 px-3 py-2 border-b border-border-secondary sticky top-0 bg-bg-primary z-10 group/header">
      {/* Select all */}
      <div>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={() => toggleSelectAll(allTasks)}
          className="w-3.5 h-3.5 rounded border-border-secondary accent-accent-blue cursor-pointer"
        />
      </div>
      <ColumnHeader label="Task" sortKey="title" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-8" />
      <ColumnHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" icon={CheckCircle2} />
      <ColumnHeader label="Assignee" sortKey="assignee" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" icon={Users} />
      <ColumnHeader label="Due" sortKey="dueDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" icon={Calendar} />
      <ColumnHeader label="Priority" sortKey="priority" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" icon={Flag} />
      <ColumnHeader label="Tags" sortKey="tags" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} icon={Tag} />
    </div>
  );

  // ---- Grouped Rendering ----
  if (sortedGroups && sortedGroups.length > 0 && groupBy) {
    return (
      <div className="flex-1 overflow-y-auto">
        {headerRow}
        <div className="divide-y divide-border-secondary/50">
          {sortedGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.value);
            return (
              <div key={group.value}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary/50 sticky top-[41px] z-[5]">
                  <button
                    onClick={() => toggleGroup(group.value)}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {group.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  )}
                  <span className="text-sm font-medium text-text-primary">{group.name}</span>
                  <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                    {group.count}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Focus the quick-add for this group (handled by QuickAddRow below)
                    }}
                    className="ml-auto p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                    title="Add task to this group"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Group tasks */}
                {!isCollapsed && (
                  <div>
                    {group.tasks.length === 0 ? (
                      <div className="px-6 py-4 text-xs text-text-tertiary">No tasks in this group</div>
                    ) : (
                      group.tasks.map((task, idx) => renderTaskRow(task as Task, idx, group.tasks as Task[]))
                    )}
                    <QuickAddRow listId={listId} groupStatus={group.value} onCreated={onRefresh} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <BulkActionToolbar
          selectedTaskIds={Array.from(selectedIds)}
          onClearSelection={handleClearSelection}
          listId={listId}
          spaceId={spaceId}
          onActionComplete={handleActionComplete}
        />
      </div>
    );
  }

  // ---- Flat Rendering ----
  return (
    <div className="flex-1 overflow-y-auto">
      {headerRow}
      <div className="py-1">
        {allTasks.map((task, idx) => renderTaskRow(task, idx, allTasks))}
        <QuickAddRow listId={listId} onCreated={onRefresh} />
      </div>

      <BulkActionToolbar
        selectedTaskIds={Array.from(selectedIds)}
        onClearSelection={handleClearSelection}
        listId={listId}
        spaceId={spaceId}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
