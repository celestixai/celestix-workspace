import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Check,
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

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
  none: 'rgba(255,255,255,0.20)',
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

// Status pill colors
const STATUS_PILL_STYLES: Record<string, { bg: string; color: string }> = {
  BACKLOG: { bg: 'rgba(161,161,170,0.10)', color: '#A1A1AA' },
  TODO: { bg: 'rgba(161,161,170,0.10)', color: '#A1A1AA' },
  IN_PROGRESS: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  REVIEW: { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
  DONE: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
};

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function formatDate(dateStr: string | undefined): { label: string; color: string } {
  if (!dateStr) return { label: '', color: '' };
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diffDays < 0) return { label, color: '#EF4444' };
    if (diffDays === 0) return { label: 'Today', color: '#F59E0B' };
    if (diffDays === 1) return { label: 'Tomorrow', color: '#F59E0B' };
    return { label, color: 'rgba(255,255,255,0.40)' };
  } catch {
    return { label: String(dateStr), color: 'rgba(255,255,255,0.40)' };
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
  width,
  flex,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  width?: number | string;
  flex?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 select-none transition-colors"
      style={{
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.20)',
        width: width,
        flex: flex,
      }}
    >
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
  const presetStyle = STATUS_PILL_STYLES[status];
  const bgColor = presetStyle?.bg ?? (color ? `${color}18` : 'rgba(161,161,170,0.10)');
  const textColor = presetStyle?.color ?? color ?? '#A1A1AA';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center whitespace-nowrap cursor-pointer transition-colors"
      style={{
        height: 20,
        borderRadius: 9999,
        padding: '0 8px',
        fontSize: 11,
        fontWeight: 500,
        color: textColor,
        background: bgColor,
      }}
    >
      {status.replace('_', ' ')}
    </button>
  );
}

function AvatarStack({ assignees }: { assignees: Task['assignees'] }) {
  if (!assignees || assignees.length === 0) {
    return <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: 11 }}>--</span>;
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(37,99,235,0.20)',
            border: '2px solid #09090B',
            fontSize: 9,
            fontWeight: 500,
            color: '#60A5FA',
          }}
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
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid #09090B',
            fontSize: 9,
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          +{assignees.length - 3}
        </div>
      )}
    </div>
  );
}

function PriorityDot({ priority, onClick }: { priority: string; onClick?: () => void }) {
  const p = (priority ?? 'none').toLowerCase();
  const dotColor = PRIORITY_DOT_COLORS[p] ?? 'rgba(255,255,255,0.20)';
  if (p === 'none') {
    return (
      <span
        style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }}
      />
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="cursor-pointer flex-shrink-0"
      title={PRIORITY_LABELS[p] ?? p}
      style={{ lineHeight: 0 }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }}
      />
    </button>
  );
}

function TagChips({ tags }: { tags: Task['tags'] }) {
  if (!tags || tags.length === 0) return <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: 11 }}>--</span>;
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag.id}
          className="whitespace-nowrap"
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 9999,
            fontWeight: 500,
            backgroundColor: tag.color + '20',
            color: tag.color,
          }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 2 && (
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)' }}>+{tags.length - 2}</span>
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
    <motion.div
      ref={ref}
      className="absolute z-50 top-full mt-1 left-0 min-w-[140px] py-1"
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        transformOrigin: 'top left',
        background: '#18181B',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(opt.value);
          }}
          className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.65)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
          }}
        >
          {opt.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
          {opt.label}
        </button>
      ))}
    </motion.div>
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
    <div
      ref={ref}
      className="absolute z-50 top-full mt-1 left-0 flex flex-col gap-2 p-3"
      style={{
        background: '#18181B',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs px-2 py-1.5 rounded border outline-none"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.08)',
          color: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (value) onSelect(new Date(value).toISOString());
          }}
          disabled={!value}
          className="flex-1 text-xs px-2 py-1 rounded disabled:opacity-40 transition-colors"
          style={{ background: '#2563EB', color: '#ffffff' }}
        >
          Set
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// Custom checkbox component
function TaskCheckbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: () => void; indeterminate?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="flex items-center justify-center flex-shrink-0 transition-all duration-100"
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: checked ? 'none' : '1px solid rgba(255,255,255,0.20)',
        background: checked ? '#2563EB' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {checked && <Check size={10} style={{ color: '#ffffff' }} strokeWidth={3} />}
      {indeterminate && !checked && (
        <span style={{ width: 8, height: 2, background: 'rgba(255,255,255,0.40)', borderRadius: 1, display: 'block' }} />
      )}
    </button>
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
        className="flex items-center gap-2 w-full transition-colors"
        style={{
          padding: '8px 12px',
          fontSize: 13,
          color: 'rgba(255,255,255,0.40)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; }}
      >
        <Plus size={14} />
        Add task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3" style={{ padding: '4px 12px', height: 36 }}>
      <div style={{ width: 32 }} /> {/* checkbox spacer */}
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
        className="flex-1 bg-transparent outline-none"
        style={{
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 4,
        }}
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

  // Render a task row - 36px height exactly
  const renderTaskRow = (task: Task, index: number, flatList: Task[], indent: number = 0) => {
    const isSelected = selectedIds.has(task.id);
    const hasSubtasks = (task.subtaskCount ?? 0) > 0 || (task.subtasks && task.subtasks.length > 0);
    const isExpanded = expandedTasks.has(task.id);
    const dateInfo = formatDate(task.dueDate);

    return (
      <div key={task.id}>
        <div
          className="flex items-center cursor-pointer transition-colors duration-100"
          style={{
            height: 36,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            paddingLeft: indent > 0 ? `${12 + indent * 24}px` : 0,
            background: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
          onClick={() => onTaskClick(task.id)}
        >
          {/* Checkbox - 32px */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <TaskCheckbox
              checked={isSelected}
              onChange={() => toggleSelect(task.id, index, false, flatList)}
            />
          </div>

          {/* Task Name - flex */}
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            {/* Subtask expand toggle */}
            {hasSubtasks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubtasks(task.id);
                }}
                className="flex-shrink-0 transition-colors"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="flex-shrink-0" style={{ width: 14 }} />
            )}

            {/* Custom task ID */}
            {task.customTaskId && (
              <span
                className="flex-shrink-0"
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.40)',
                }}
              >
                {task.customTaskId}
              </span>
            )}

            {/* Title */}
            <span
              className="truncate"
              style={{
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                color: '#ffffff',
              }}
            >
              {task.title}
            </span>

            {/* Subtask count badge */}
            {hasSubtasks && (
              <span
                className="flex-shrink-0"
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.40)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '1px 6px',
                  borderRadius: 9999,
                }}
              >
                {task.subtaskCount ?? task.subtasks?.length ?? 0}
              </span>
            )}

            {/* Dependency icon */}
            {task.relationships &&
              ((task.relationships.blocking?.length ?? 0) > 0 ||
                (task.relationships.waitingOn?.length ?? 0) > 0 ||
                (task.relationships.linkedTo?.length ?? 0) > 0) && (
              <Link2 size={12} className="flex-shrink-0" style={{ color: '#3B82F6' }} />
            )}
          </div>

          {/* Status - 100px */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{ width: 100 }}
            onClick={(e) => e.stopPropagation()}
          >
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

          {/* Assignee - 80px */}
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 80 }}>
            <AvatarStack assignees={task.assignees} />
          </div>

          {/* Due Date - 100px */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{ width: 100 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEditingCell({ taskId: task.id, field: 'dueDate' })}
              className="cursor-pointer"
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                color: dateInfo.color || 'rgba(255,255,255,0.40)',
              }}
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

          {/* Priority - 40px */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{ width: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <PriorityDot
              priority={task.priority}
              onClick={() => setEditingCell({ taskId: task.id, field: 'priority' })}
            />
            {editingCell?.taskId === task.id && editingCell.field === 'priority' && (
              <InlineDropdown
                options={PRIORITY_OPTIONS.map((p) => ({
                  value: p.toUpperCase(),
                  label: PRIORITY_LABELS[p] ?? p,
                  color: PRIORITY_DOT_COLORS[p],
                }))}
                onSelect={(val) => handleInlineUpdate(task.id, 'priority', val)}
                onClose={() => setEditingCell(null)}
              />
            )}
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
      <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
        <div className="space-y-px">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} style={{ height: 36, background: 'rgba(255,255,255,0.02)', borderRadius: 0 }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ---- Empty State ----
  if (allTasks.length === 0 && (!sortedGroups || sortedGroups.every((g) => g.tasks.length === 0))) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20" style={{ color: 'rgba(255,255,255,0.40)' }}>
        <Layers size={40} className="mb-4 opacity-30" />
        <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}>No tasks</p>
        <p style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.30)' }}>Create a task to get started</p>
        <div className="mt-4">
          <QuickAddRow listId={listId} onCreated={onRefresh} />
        </div>
      </div>
    );
  }

  // ---- Column Header Row (sticky, 28px) ----
  const headerRow = (
    <div
      className="flex items-center sticky top-0 z-10 group/header"
      style={{
        height: 28,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: '#09090B',
      }}
    >
      {/* Checkbox col */}
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 32 }}>
        <TaskCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={() => toggleSelectAll(allTasks)}
        />
      </div>
      <ColumnHeader label="Task" sortKey="title" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} flex="1" />
      <ColumnHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} width={100} />
      <ColumnHeader label="Assignee" sortKey="assignee" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} width={80} />
      <ColumnHeader label="Due" sortKey="dueDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} width={100} />
      <ColumnHeader label="Priority" sortKey="priority" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} width={40} />
    </div>
  );

  // ---- Grouped Rendering ----
  if (sortedGroups && sortedGroups.length > 0 && groupBy) {
    return (
      <div className="flex-1 overflow-y-auto">
        {headerRow}
        <div>
          {sortedGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.value);
            return (
              <div key={group.value}>
                {/* Group header - 32px */}
                <div
                  className="flex items-center gap-2 sticky z-[5]"
                  style={{
                    height: 32,
                    top: 28,
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    padding: '0 8px',
                  }}
                >
                  {/* Left colored bar */}
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 3,
                      height: 16,
                      borderRadius: 2,
                      background: group.color || '#3B82F6',
                    }}
                  />

                  <button
                    onClick={() => toggleGroup(group.value)}
                    className="transition-colors flex-shrink-0"
                    style={{ color: 'rgba(255,255,255,0.40)' }}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
                    {group.name}
                  </span>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Count */}
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'rgba(255,255,255,0.40)',
                    }}
                  >
                    {group.count}
                  </span>
                </div>

                {/* Group tasks */}
                {!isCollapsed && (
                  <div>
                    {group.tasks.length === 0 ? (
                      <div style={{ padding: '16px 24px', fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>No tasks in this group</div>
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
      <div>
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
