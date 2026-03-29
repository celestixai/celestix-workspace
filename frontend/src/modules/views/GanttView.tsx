import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Crosshair,
  GripVertical,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  statusName?: string;
  statusColor?: string;
  priority: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  dueDate?: string;
  startDate?: string;
  taskTypeId?: string;
  customTaskId?: string;
  parentTaskId?: string;
  subtasks?: { id: string; title: string; status: string }[];
  tags?: { id: string; name: string; color: string }[];
}

interface GanttViewProps {
  tasks: any[];
  groups?: any[];
  isLoading: boolean;
  groupBy?: string;
  listId?: string;
  spaceId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

interface DragState {
  taskId: string;
  mode: 'move' | 'resize-left' | 'resize-right';
  startX: number;
  origStartDate: Date;
  origDueDate: Date;
}

// -----------------------------------------------
// Constants
// -----------------------------------------------

const COLUMN_WIDTHS: Record<ZoomLevel, number> = {
  day: 40,
  week: 120,
  month: 180,
};

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 50;
const BAR_HEIGHT = 20;
const BAR_TOP_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MIN_LEFT_PANEL = 200;
const MAX_LEFT_PANEL = 600;
const DEFAULT_LEFT_PANEL = 280;

const PRIORITY_BAR_COLORS: Record<string, { bg: string; fill: string; border: string }> = {
  urgent: { bg: '#ef4444', fill: '#dc2626', border: '#b91c1c' },
  high: { bg: '#f97316', fill: '#ea580c', border: '#c2410c' },
  medium: { bg: '#eab308', fill: '#ca8a04', border: '#a16207' },
  low: { bg: '#3b82f6', fill: '#2563eb', border: '#1d4ed8' },
  none: { bg: '#6b7280', fill: '#4b5563', border: '#374151' },
};

const STATUS_BAR_COLORS: Record<string, { bg: string; fill: string; border: string }> = {
  done: { bg: '#22c55e', fill: '#16a34a', border: '#15803d' },
  active: { bg: '#3b82f6', fill: '#2563eb', border: '#1d4ed8' },
  not_started: { bg: '#6b7280', fill: '#4b5563', border: '#374151' },
  closed: { bg: '#4b5563', fill: '#374151', border: '#1f2937' },
};

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toISOString(date: Date): string {
  return date.toISOString();
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function startOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const dow = result.getDay();
  result.setDate(result.getDate() - (dow === 0 ? 6 : dow - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getBarColor(task: Task, mode: 'priority' | 'status'): { bg: string; fill: string; border: string } {
  if (mode === 'priority') {
    const key = (task.priority ?? 'none').toLowerCase();
    return PRIORITY_BAR_COLORS[key] ?? PRIORITY_BAR_COLORS.none;
  }
  const sn = (task.statusName ?? task.status ?? '').toLowerCase();
  if (sn.includes('done') || sn.includes('complete')) return STATUS_BAR_COLORS.done;
  if (sn.includes('progress') || sn.includes('review') || sn.includes('active')) return STATUS_BAR_COLORS.active;
  if (sn.includes('closed')) return STATUS_BAR_COLORS.closed;
  return STATUS_BAR_COLORS.not_started;
}

function isMilestone(task: Task): boolean {
  const start = parseDate(task.startDate);
  const due = parseDate(task.dueDate);
  if (start && due && toDateKey(start) === toDateKey(due)) return true;
  if (!start && due) return true; // single-date task treated as milestone
  return false;
}

function getSubtaskProgress(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) return 0;
  const done = task.subtasks.filter(
    (s) => s.status.toLowerCase().includes('done') || s.status.toLowerCase().includes('complete'),
  ).length;
  return done / task.subtasks.length;
}

// -----------------------------------------------
// Build flat row list with hierarchy
// -----------------------------------------------

interface GanttRow {
  task: Task;
  depth: number;
  hasChildren: boolean;
  groupName?: string; // first row of a group
}

function buildRows(
  tasks: Task[],
  groups: any[] | undefined,
  groupBy: string | undefined,
  collapsedGroups: Set<string>,
  collapsedTasks: Set<string>,
): GanttRow[] {
  const rows: GanttRow[] = [];

  // Build parent->children map
  const childrenMap = new Map<string, Task[]>();
  const topLevel: Task[] = [];

  for (const t of tasks) {
    if (t.parentTaskId) {
      const existing = childrenMap.get(t.parentTaskId) ?? [];
      existing.push(t);
      childrenMap.set(t.parentTaskId, existing);
    } else {
      topLevel.push(t);
    }
  }

  function addTaskRows(taskList: Task[], depth: number, groupName?: string) {
    for (let i = 0; i < taskList.length; i++) {
      const task = taskList[i];
      const children = childrenMap.get(task.id) ?? [];
      rows.push({
        task,
        depth,
        hasChildren: children.length > 0,
        groupName: i === 0 ? groupName : undefined,
      });
      if (children.length > 0 && !collapsedTasks.has(task.id)) {
        addTaskRows(children, depth + 1);
      }
    }
  }

  if (groups && groups.length > 0 && groupBy) {
    for (const group of groups) {
      if (collapsedGroups.has(group.name)) {
        // Just add a placeholder row for the group header
        rows.push({
          task: { id: `__group_${group.name}`, title: '', status: '', priority: 'none' },
          depth: 0,
          hasChildren: false,
          groupName: group.name,
        });
        continue;
      }
      const groupTasks = (group.tasks ?? []) as Task[];
      const groupTopLevel = groupTasks.filter((t) => !t.parentTaskId);
      addTaskRows(groupTopLevel, 0, group.name);
    }
  } else {
    addTaskRows(topLevel, 0);
  }

  return rows;
}

// -----------------------------------------------
// Compute timeline range
// -----------------------------------------------

function computeTimelineRange(tasks: Task[], zoom: ZoomLevel): { start: Date; end: Date; totalCols: number } {
  const today = startOfDay(new Date());
  let minDate = addDays(today, -14);
  let maxDate = addDays(today, 60);

  for (const t of tasks) {
    const s = parseDate(t.startDate);
    const d = parseDate(t.dueDate);
    if (s && s < minDate) minDate = addDays(s, -7);
    if (d && d > maxDate) maxDate = addDays(d, 7);
  }

  // Align to zoom boundaries
  if (zoom === 'week') {
    minDate = startOfWeek(minDate);
    maxDate = addDays(startOfWeek(maxDate), 7);
  } else if (zoom === 'month') {
    minDate = startOfMonth(minDate);
    maxDate = startOfMonth(addDays(maxDate, 31));
  } else {
    minDate = startOfDay(minDate);
    maxDate = startOfDay(addDays(maxDate, 1));
  }

  const days = daysBetween(minDate, maxDate);
  let totalCols: number;
  if (zoom === 'day') totalCols = days;
  else if (zoom === 'week') totalCols = Math.ceil(days / 7);
  else totalCols = Math.ceil(days / 30);

  totalCols = Math.max(totalCols, 10);

  return { start: minDate, end: maxDate, totalCols };
}

function dateToX(date: Date, timelineStart: Date, zoom: ZoomLevel): number {
  const days = daysBetween(timelineStart, date);
  const colW = COLUMN_WIDTHS[zoom];
  if (zoom === 'day') return days * colW;
  if (zoom === 'week') return (days / 7) * colW;
  return (days / 30) * colW;
}

function xToDate(x: number, timelineStart: Date, zoom: ZoomLevel): Date {
  const colW = COLUMN_WIDTHS[zoom];
  let days: number;
  if (zoom === 'day') days = x / colW;
  else if (zoom === 'week') days = (x / colW) * 7;
  else days = (x / colW) * 30;
  return addDays(timelineStart, Math.round(days));
}

// -----------------------------------------------
// Timeline Header
// -----------------------------------------------

function TimelineHeader({
  timelineStart,
  totalCols,
  zoom,
  colWidth,
}: {
  timelineStart: Date;
  totalCols: number;
  zoom: ZoomLevel;
  colWidth: number;
}) {
  const cells: React.ReactNode[] = [];
  const cursor = new Date(timelineStart);

  for (let i = 0; i < totalCols; i++) {
    let label: string;
    const isToday = zoom === 'day' && toDateKey(cursor) === toDateKey(new Date());

    if (zoom === 'day') {
      label = `${cursor.getDate()}`;
      // Show month on first day or first of month
      if (i === 0 || cursor.getDate() === 1) {
        label = `${cursor.toLocaleDateString('en-US', { month: 'short' })} ${cursor.getDate()}`;
      }
    } else if (zoom === 'week') {
      const end = addDays(cursor, 6);
      label = `${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}`;
    } else {
      label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    cells.push(
      <div
        key={i}
        className={cn(
          'flex-shrink-0 flex items-end justify-center pb-1',
          isToday && 'bg-[#2563EB]/10',
        )}
        style={{ width: colWidth, height: HEADER_HEIGHT, borderRight: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span
          className={cn(
            'text-[11px] font-mono',
            isToday ? 'text-[#2563EB] font-semibold' : 'text-[rgba(255,255,255,0.40)]',
          )}
        >
          {label}
        </span>
      </div>,
    );

    if (zoom === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (zoom === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="flex" style={{ height: HEADER_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {cells}
    </div>
  );
}

// -----------------------------------------------
// Dependency Arrows (SVG)
// -----------------------------------------------

function DependencyArrows({
  tasks,
  rows,
  timelineStart,
  zoom,
  totalHeight,
  totalWidth,
}: {
  tasks: Task[];
  rows: GanttRow[];
  timelineStart: Date;
  zoom: ZoomLevel;
  totalHeight: number;
  totalWidth: number;
}) {
  // Build a map of taskId -> row index
  const taskRowMap = new Map<string, number>();
  rows.forEach((r, i) => {
    if (!r.task.id.startsWith('__group_')) {
      taskRowMap.set(r.task.id, i);
    }
  });

  // For now, use subtask parent relationships as implicit dependencies
  // and look for any blocking relationships if available on tasks
  const arrows: React.ReactNode[] = [];

  rows.forEach((row, rowIdx) => {
    const task = row.task;
    if (task.parentTaskId) {
      const parentIdx = taskRowMap.get(task.parentTaskId);
      if (parentIdx === undefined) return;

      const parentTask = rows[parentIdx]?.task;
      if (!parentTask) return;

      const parentEnd = parseDate(parentTask.dueDate);
      const childStart = parseDate(task.startDate) ?? parseDate(task.dueDate);
      if (!parentEnd || !childStart) return;

      const x1 = dateToX(parentEnd, timelineStart, zoom);
      const y1 = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = dateToX(childStart, timelineStart, zoom);
      const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      // Is dependency violated?
      const violated = childStart < parentEnd;
      const color = violated ? '#ef4444' : '#6b7280';

      const midX = x1 + (x2 - x1) / 2;

      arrows.push(
        <g key={`dep-${parentTask.id}-${task.id}`}>
          <path
            d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray={violated ? '4,2' : 'none'}
            opacity={0.6}
          />
          {/* Arrowhead */}
          <polygon
            points={`${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 6},${y2 + 3}`}
            fill={color}
            opacity={0.6}
          />
        </g>,
      );
    }
  });

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={totalWidth}
      height={totalHeight}
      style={{ zIndex: 5 }}
    >
      {arrows}
    </svg>
  );
}

// -----------------------------------------------
// Main GanttView Component
// -----------------------------------------------

export function GanttView({
  tasks,
  groups,
  isLoading,
  groupBy,
  listId: _listId,
  spaceId: _spaceId,
  onTaskClick,
  onRefresh,
}: GanttViewProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [colorMode, setColorMode] = useState<'priority' | 'status'>('priority');
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [isResizingPanel, setIsResizingPanel] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Build rows
  const rows = useMemo(
    () => buildRows(tasks as Task[], groups, groupBy, collapsedGroups, collapsedTasks),
    [tasks, groups, groupBy, collapsedGroups, collapsedTasks],
  );

  // Compute timeline
  const { start: timelineStart, totalCols } = useMemo(
    () => computeTimelineRange(tasks as Task[], zoom),
    [tasks, zoom],
  );

  const colWidth = COLUMN_WIDTHS[zoom];
  const totalTimelineWidth = totalCols * colWidth;
  const totalHeight = rows.length * ROW_HEIGHT;

  // Today line position
  const todayX = dateToX(today, timelineStart, zoom);

  // ---- Mutations ----

  const updateDatesMutation = useMutation({
    mutationFn: async ({ taskId, startDate, dueDate }: { taskId: string; startDate?: string; dueDate?: string }) => {
      const { data } = await api.patch(`/tasks/${taskId}/dates`, { startDate, dueDate });
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onRefresh();
      toast('Task dates updated', 'success');
    },
    onError: () => {
      toast('Failed to update task dates', 'error');
    },
  });

  // ---- Scroll to today ----

  const scrollToToday = useCallback(() => {
    if (!timelineRef.current) return;
    const x = todayX - timelineRef.current.clientWidth / 2;
    timelineRef.current.scrollLeft = Math.max(0, x);
  }, [todayX]);

  useEffect(() => {
    // Scroll to today on mount
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // ---- Scroll sync ----

  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (timelineRef.current && leftPanelRef.current) {
      timelineRef.current.scrollTop = leftPanelRef.current.scrollTop;
    }
  }, []);

  // ---- Panel resize ----

  const handlePanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingPanel(true);
      const startX = e.clientX;
      const startWidth = leftPanelWidth;

      const onMove = (ev: MouseEvent) => {
        const newWidth = Math.min(MAX_LEFT_PANEL, Math.max(MIN_LEFT_PANEL, startWidth + ev.clientX - startX));
        setLeftPanelWidth(newWidth);
      };
      const onUp = () => {
        setIsResizingPanel(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [leftPanelWidth],
  );

  // ---- Bar drag ----

  const handleBarDragStart = useCallback(
    (e: React.MouseEvent, task: Task, mode: DragState['mode']) => {
      e.stopPropagation();
      e.preventDefault();

      const start = parseDate(task.startDate);
      const due = parseDate(task.dueDate);
      if (!start && !due) return;

      const effectiveStart = start ?? due!;
      const effectiveDue = due ?? start!;

      setDragState({
        taskId: task.id,
        mode,
        startX: e.clientX,
        origStartDate: effectiveStart,
        origDueDate: effectiveDue,
      });
      setDragDelta(0);

      const onMove = (ev: MouseEvent) => {
        setDragDelta(ev.clientX - e.clientX);
      };

      const onUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);

        const delta = ev.clientX - e.clientX;
        if (Math.abs(delta) < 3) {
          setDragState(null);
          setDragDelta(0);
          return;
        }

        const daysDelta = xToDate(Math.abs(delta), timelineStart, zoom);
        const realDaysDelta = daysBetween(timelineStart, daysDelta);
        const sign = delta > 0 ? 1 : -1;
        const daysOffset = realDaysDelta * sign;

        let newStart: Date;
        let newDue: Date;

        if (mode === 'move') {
          newStart = addDays(effectiveStart, daysOffset);
          newDue = addDays(effectiveDue, daysOffset);
        } else if (mode === 'resize-left') {
          newStart = addDays(effectiveStart, daysOffset);
          newDue = effectiveDue;
          if (newStart > newDue) newStart = newDue;
        } else {
          newStart = effectiveStart;
          newDue = addDays(effectiveDue, daysOffset);
          if (newDue < newStart) newDue = newStart;
        }

        updateDatesMutation.mutate({
          taskId: task.id,
          startDate: toISOString(newStart),
          dueDate: toISOString(newDue),
        });

        setDragState(null);
        setDragDelta(0);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [timelineStart, zoom, updateDatesMutation],
  );

  // ---- Toggle helpers ----

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // ---- Zoom helpers ----

  const zoomIn = useCallback(() => {
    setZoom((z) => (z === 'month' ? 'week' : z === 'week' ? 'day' : 'day'));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => (z === 'day' ? 'week' : z === 'week' ? 'month' : 'month'));
  }, []);

  // ---- Loading ----

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 gap-2">
        <div className="h-10 bg-bg-tertiary rounded-lg animate-pulse w-80" />
        <div className="flex-1 flex gap-2">
          <div className="w-[300px] bg-bg-tertiary rounded animate-pulse" />
          <div className="flex-1 bg-bg-tertiary rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-secondary/50">
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {(['day', 'week', 'month'] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoom(level)}
                className={cn(
                  'text-[11px] font-medium transition-all rounded-md capitalize',
                  zoom === level
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[rgba(255,255,255,0.5)] hover:text-white',
                )}
                style={{ padding: '4px 12px' }}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            onClick={zoomIn}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={zoomOut}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>

          <button
            onClick={scrollToToday}
            className="ml-2 px-2.5 py-1 text-[11px] font-medium rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Crosshair size={12} /> Today
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Color mode */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Color:</span>
            <button
              onClick={() => setColorMode('priority')}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded transition-colors',
                colorMode === 'priority'
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Priority
            </button>
            <button
              onClick={() => setColorMode('status')}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded transition-colors',
                colorMode === 'status'
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Status
            </button>
          </div>

          <span className="text-[10px] text-text-tertiary">{tasks.length} tasks</span>
        </div>
      </div>

      {/* Main Gantt Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel (task list) */}
        <div
          className="flex flex-col bg-bg-primary"
          style={{ width: leftPanelWidth, minWidth: leftPanelWidth, borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Left header */}
          <div
            className="flex items-end px-2 pb-1 text-[10px] uppercase tracking-wider"
            style={{ height: HEADER_HEIGHT, minHeight: HEADER_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}
          >
            <span className="flex-1">Task</span>
            <span className="w-16 text-center">Assignee</span>
          </div>

          {/* Left rows */}
          <div
            ref={leftPanelRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={handleLeftScroll}
            style={{ scrollbarWidth: 'none' }}
          >
            {rows.map((row, idx) => {
              const isGroupHeader = row.task.id.startsWith('__group_');
              const groupName = row.groupName;

              return (
                <div key={row.task.id + '-' + idx}>
                  {/* Group header */}
                  {groupName && (
                    <div
                      className="flex items-center gap-1.5 px-2 cursor-pointer hover:bg-bg-tertiary/80"
                      style={{ height: ROW_HEIGHT, backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      onClick={() => toggleGroup(groupName)}
                    >
                      {collapsedGroups.has(groupName) ? (
                        <ChevronRight size={12} className="text-text-tertiary" />
                      ) : (
                        <ChevronDown size={12} className="text-text-tertiary" />
                      )}
                      <span className="text-xs font-semibold text-text-secondary">{groupName}</span>
                    </div>
                  )}
                  {/* Task row (skip if just a collapsed group placeholder) */}
                  {!isGroupHeader && (
                    <div
                      className="flex items-center hover:bg-bg-hover/50 cursor-pointer group/row"
                      style={{ height: ROW_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onClick={() => onTaskClick(row.task.id)}
                    >
                      <div
                        className="flex-1 flex items-center gap-1.5 px-2 min-w-0"
                        style={{ paddingLeft: 8 + row.depth * 16 }}
                      >
                        {row.hasChildren && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTask(row.task.id);
                            }}
                            className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
                          >
                            {collapsedTasks.has(row.task.id) ? (
                              <ChevronRight size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            )}
                          </button>
                        )}
                        {!row.hasChildren && <span className="w-3 flex-shrink-0" />}
                        <span className="text-xs text-text-primary truncate">{row.task.title}</span>
                      </div>
                      {/* Assignee column */}
                      <div className="w-16 flex items-center justify-center flex-shrink-0">
                        {row.task.assignees?.[0] ? (
                          <div
                            className="w-5 h-5 rounded-full bg-[#2563EB]/30 flex items-center justify-center text-[8px] font-bold text-[#2563EB] flex-shrink-0"
                            title={row.task.assignees[0].displayName}
                          >
                            {row.task.assignees[0].avatarUrl ? (
                              <img
                                src={row.task.assignees[0].avatarUrl}
                                className="w-5 h-5 rounded-full"
                                alt=""
                              />
                            ) : (
                              row.task.assignees[0].displayName?.[0]?.toUpperCase() ?? '?'
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>--</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className={cn(
            'w-1 cursor-col-resize hover:bg-accent-blue/30 transition-colors flex-shrink-0',
            isResizingPanel && 'bg-accent-blue/40',
          )}
          onMouseDown={handlePanelResizeStart}
        >
          <div className="h-full flex items-center justify-center">
            <GripVertical size={10} className="text-text-tertiary opacity-0 hover:opacity-100" />
          </div>
        </div>

        {/* Right Panel (timeline) */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-auto relative"
          style={{ backgroundColor: '#09090B' }}
          onScroll={handleTimelineScroll}
        >
          {/* Timeline header */}
          <div className="sticky top-0 z-10" style={{ backgroundColor: '#09090B' }}>
            <TimelineHeader
              timelineStart={timelineStart}
              totalCols={totalCols}
              zoom={zoom}
              colWidth={colWidth}
            />
          </div>

          {/* Timeline body */}
          <div className="relative" style={{ width: totalTimelineWidth, height: totalHeight }}>
            {/* Grid columns (faint vertical lines) */}
            {Array.from({ length: totalCols }).map((_, i) => (
              <div
                key={`col-${i}`}
                className="absolute top-0"
                style={{ left: i * colWidth, width: colWidth, height: totalHeight, borderRight: '1px solid rgba(255,255,255,0.04)' }}
              />
            ))}

            {/* Row backgrounds */}
            {rows.map((row, idx) => (
              <div
                key={`rowbg-${idx}`}
                className="absolute left-0 right-0"
                style={{
                  top: idx * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  width: totalTimelineWidth,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  backgroundColor: row.groupName ? 'rgba(255,255,255,0.02)' : idx % 2 !== 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                }}
              />
            ))}

            {/* Today line */}
            <div
              className="absolute top-0 z-20 pointer-events-none"
              style={{ left: todayX, height: totalHeight }}
            >
              <div
                className="w-px h-full"
                style={{ borderLeft: '2px dashed #EF4444' }}
              />
              <div
                className="absolute -top-1 -left-[7px] w-[14px] h-3 rounded-sm text-white text-[7px] font-bold flex items-center justify-center"
                style={{ backgroundColor: '#EF4444', letterSpacing: '-0.5px' }}
              >
                T
              </div>
            </div>

            {/* Dependency Arrows */}
            <DependencyArrows
              tasks={tasks as Task[]}
              rows={rows}
              timelineStart={timelineStart}
              zoom={zoom}
              totalHeight={totalHeight}
              totalWidth={totalTimelineWidth}
            />

            {/* Task bars */}
            {rows.map((row, idx) => {
              if (row.task.id.startsWith('__group_')) return null;

              const task = row.task;
              const start = parseDate(task.startDate);
              const due = parseDate(task.dueDate);

              // No dates: show a small dot at today
              if (!start && !due) {
                const x = todayX;
                return (
                  <div
                    key={`bar-${task.id}`}
                    className="absolute z-10 w-2 h-2 rounded-full bg-[var(--cx-text-3)]/50 cursor-pointer"
                    style={{
                      left: x - 4,
                      top: idx * ROW_HEIGHT + ROW_HEIGHT / 2 - 4,
                    }}
                    onClick={() => onTaskClick(task.id)}
                    title={`${task.title} (no dates)`}
                  />
                );
              }

              const effectiveStart = start ?? due!;
              const effectiveDue = due ?? start!;
              const milestone = isMilestone(task) && !start;

              // Compute bar position (possibly with drag offset)
              let barStartDate = effectiveStart;
              let barDueDate = effectiveDue;

              if (dragState?.taskId === task.id && dragDelta !== 0) {
                const pixelDelta = dragDelta;
                if (dragState.mode === 'move') {
                  const dateDelta = xToDate(Math.abs(pixelDelta), timelineStart, zoom);
                  const daysShift = daysBetween(timelineStart, dateDelta) * (pixelDelta > 0 ? 1 : -1);
                  barStartDate = addDays(dragState.origStartDate, daysShift);
                  barDueDate = addDays(dragState.origDueDate, daysShift);
                } else if (dragState.mode === 'resize-left') {
                  const dateDelta = xToDate(Math.abs(pixelDelta), timelineStart, zoom);
                  const daysShift = daysBetween(timelineStart, dateDelta) * (pixelDelta > 0 ? 1 : -1);
                  barStartDate = addDays(dragState.origStartDate, daysShift);
                  if (barStartDate > barDueDate) barStartDate = barDueDate;
                } else {
                  const dateDelta = xToDate(Math.abs(pixelDelta), timelineStart, zoom);
                  const daysShift = daysBetween(timelineStart, dateDelta) * (pixelDelta > 0 ? 1 : -1);
                  barDueDate = addDays(dragState.origDueDate, daysShift);
                  if (barDueDate < barStartDate) barDueDate = barStartDate;
                }
              }

              const x = dateToX(barStartDate, timelineStart, zoom);
              const xEnd = dateToX(addDays(barDueDate, 1), timelineStart, zoom);
              const barWidth = Math.max(xEnd - x, 8);
              const y = idx * ROW_HEIGHT + BAR_TOP_OFFSET;
              const colors = getBarColor(task, colorMode);
              const progress = getSubtaskProgress(task);

              if (milestone) {
                // Diamond milestone
                return (
                  <div
                    key={`bar-${task.id}`}
                    className="absolute z-10 cursor-pointer"
                    style={{ left: x - 8, top: y + BAR_HEIGHT / 2 - 8 }}
                    onClick={() => onTaskClick(task.id)}
                    title={task.title}
                  >
                    <div
                      className="w-4 h-4 rotate-45 border-2"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={`bar-${task.id}`}
                  className="absolute z-10 group/bar"
                  style={{ left: x, top: y, width: barWidth, height: BAR_HEIGHT }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-20 opacity-0 group-hover/bar:opacity-100 hover:bg-white/20"
                    style={{ borderRadius: '4px 0 0 4px' }}
                    onMouseDown={(e) => handleBarDragStart(e, task, 'resize-left')}
                  />

                  {/* Bar body */}
                  <div
                    className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative transition-all hover:brightness-125 hover:shadow-lg hover:shadow-[#2563EB]/20"
                    style={{
                      borderRadius: '4px',
                      backgroundColor: colors.bg,
                      opacity: progress > 0 ? 0.7 + progress * 0.3 : 0.85,
                      border: `1px solid ${colors.border}`,
                    }}
                    onMouseDown={(e) => handleBarDragStart(e, task, 'move')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task.id);
                    }}
                    title={task.title}
                  >
                    {/* Progress fill */}
                    {progress > 0 && (
                      <div
                        className="absolute top-0 left-0 h-full"
                        style={{
                          borderRadius: '4px 0 0 4px',
                          width: `${progress * 100}%`,
                          backgroundColor: 'rgba(255,255,255,0.15)',
                        }}
                      />
                    )}
                    {/* Title text */}
                    {barWidth > 50 && (
                      <span
                        className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-white truncate z-10"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        {task.title}
                      </span>
                    )}
                  </div>

                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-20 opacity-0 group-hover/bar:opacity-100 hover:bg-white/20"
                    style={{ borderRadius: '0 4px 4px 0' }}
                    onMouseDown={(e) => handleBarDragStart(e, task, 'resize-right')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
