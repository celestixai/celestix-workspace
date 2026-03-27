import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Crosshair,
  User,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  statusName?: string;
  priority: string;
  assignees?: Array<{ id: string; displayName: string; avatarUrl?: string; user?: { id: string; displayName: string; avatarUrl?: string } }>;
  dueDate?: string;
  startDate?: string;
  timeEstimate?: number;
}

interface TimelineViewProps {
  tasks: any[];
  isLoading: boolean;
  listId?: string;
  spaceId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type TimePeriod = 'week' | '2weeks' | 'month' | '3months';

interface DragState {
  taskId: string;
  mode: 'move' | 'reassign';
  startX: number;
  startY: number;
  origStartDate: Date;
  origDueDate: Date;
  origAssigneeId: string | null;
}

// -----------------------------------------------
// Constants
// -----------------------------------------------

const PERIOD_DAYS: Record<TimePeriod, number> = {
  week: 7,
  '2weeks': 14,
  month: 30,
  '3months': 90,
};

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 48;
const BAR_HEIGHT = 28;
const DAY_WIDTH_MAP: Record<TimePeriod, number> = {
  week: 100,
  '2weeks': 50,
  month: 24,
  '3months': 8,
};
const LEFT_PANEL_WIDTH = 220;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  none: '#6b7280',
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

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAssigneeId(task: Task): string | null {
  if (!task.assignees || task.assignees.length === 0) return null;
  const a = task.assignees[0];
  return a.user?.id ?? a.id ?? null;
}

function getAssigneeName(task: Task): string {
  if (!task.assignees || task.assignees.length === 0) return 'Unassigned';
  const a = task.assignees[0];
  return a.user?.displayName ?? a.displayName ?? 'Unknown';
}

function getAssigneeAvatar(task: Task): string | null {
  if (!task.assignees || task.assignees.length === 0) return null;
  const a = task.assignees[0];
  return a.user?.avatarUrl ?? a.avatarUrl ?? null;
}

// -----------------------------------------------
// TimelineView Component
// -----------------------------------------------

export function TimelineView({
  tasks,
  isLoading,
  listId: _listId,
  spaceId: _spaceId,
  onTaskClick,
  onRefresh,
}: TimelineViewProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [period, setPeriod] = useState<TimePeriod>('2weeks');
  const [viewStart, setViewStart] = useState<Date>(() => addDays(today, -3));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  const timelineRef = useRef<HTMLDivElement>(null);

  const dayWidth = DAY_WIDTH_MAP[period];
  const totalDays = PERIOD_DAYS[period];
  const viewEnd = addDays(viewStart, totalDays);
  const totalWidth = totalDays * dayWidth;

  // ---- Group tasks by assignee ----
  const { assigneeRows, assigneeOrder } = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null; tasks: Task[] }>();

    for (const task of tasks as Task[]) {
      const aid = getAssigneeId(task) ?? '__unassigned__';
      if (!map.has(aid)) {
        map.set(aid, {
          name: aid === '__unassigned__' ? 'Unassigned' : getAssigneeName(task),
          avatar: aid === '__unassigned__' ? null : getAssigneeAvatar(task),
          tasks: [],
        });
      }
      map.get(aid)!.tasks.push(task);
    }

    // Put unassigned at the end
    const order = Array.from(map.keys()).sort((a, b) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      return (map.get(a)!.name).localeCompare(map.get(b)!.name);
    });

    return { assigneeRows: map, assigneeOrder: order };
  }, [tasks]);

  const totalHeight = assigneeOrder.length * ROW_HEIGHT;

  // ---- Detect overlaps per row ----
  const overlapZones = useMemo(() => {
    const zones: Array<{ assigneeId: string; startDay: number; endDay: number }> = [];

    for (const aid of assigneeOrder) {
      const row = assigneeRows.get(aid)!;
      const intervals: Array<{ start: number; end: number }> = [];

      for (const t of row.tasks) {
        const s = parseDate(t.startDate);
        const e = parseDate(t.dueDate);
        if (!s && !e) continue;
        const start = s ? daysBetween(viewStart, s) : (e ? daysBetween(viewStart, e) : 0);
        const end = e ? daysBetween(viewStart, e) + 1 : start + 1;
        intervals.push({ start, end });
      }

      // Simple sweep to find overlaps
      intervals.sort((a, b) => a.start - b.start);
      for (let i = 0; i < intervals.length; i++) {
        for (let j = i + 1; j < intervals.length; j++) {
          if (intervals[j].start < intervals[i].end) {
            const overlapStart = Math.max(intervals[i].start, intervals[j].start);
            const overlapEnd = Math.min(intervals[i].end, intervals[j].end);
            if (overlapEnd > overlapStart) {
              zones.push({ assigneeId: aid, startDay: overlapStart, endDay: overlapEnd });
            }
          }
        }
      }
    }

    return zones;
  }, [assigneeRows, assigneeOrder, viewStart]);

  // ---- Today line X ----
  const todayX = daysBetween(viewStart, today) * dayWidth;

  // ---- Navigation ----
  const handlePrev = useCallback(() => {
    setViewStart((prev) => addDays(prev, -PERIOD_DAYS[period]));
  }, [period]);

  const handleNext = useCallback(() => {
    setViewStart((prev) => addDays(prev, PERIOD_DAYS[period]));
  }, [period]);

  const handleToday = useCallback(() => {
    setViewStart(addDays(today, -3));
  }, [today]);

  // ---- Zoom ----
  const zoomIn = useCallback(() => {
    const levels: TimePeriod[] = ['3months', 'month', '2weeks', 'week'];
    const idx = levels.indexOf(period);
    if (idx < levels.length - 1) setPeriod(levels[idx + 1]);
  }, [period]);

  const zoomOut = useCallback(() => {
    const levels: TimePeriod[] = ['3months', 'month', '2weeks', 'week'];
    const idx = levels.indexOf(period);
    if (idx > 0) setPeriod(levels[idx - 1]);
  }, [period]);

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

  const updateAssigneeMutation = useMutation({
    mutationFn: async ({ taskId, userIds }: { taskId: string; userIds: string[] }) => {
      const { data } = await api.post(`/tasks/${taskId}/assignees`, { userIds });
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onRefresh();
      toast('Task reassigned', 'success');
    },
    onError: () => {
      toast('Failed to reassign task', 'error');
    },
  });

  // ---- Drag handling ----
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      e.stopPropagation();
      const s = parseDate(task.startDate) ?? parseDate(task.dueDate) ?? today;
      const d = parseDate(task.dueDate) ?? addDays(s, 1);
      setDragState({
        taskId: task.id,
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
        origStartDate: s,
        origDueDate: d,
        origAssigneeId: getAssigneeId(task),
      });
      setDragDelta({ x: 0, y: 0 });
    },
    [today],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragDelta({
        x: e.clientX - dragState.startX,
        y: e.clientY - dragState.startY,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const dayShift = Math.round(dx / dayWidth);
      const rowShift = Math.round(dy / ROW_HEIGHT);

      if (Math.abs(dayShift) > 0) {
        const newStart = addDays(dragState.origStartDate, dayShift);
        const newDue = addDays(dragState.origDueDate, dayShift);
        updateDatesMutation.mutate({
          taskId: dragState.taskId,
          startDate: newStart.toISOString(),
          dueDate: newDue.toISOString(),
        });
      }

      if (Math.abs(rowShift) > 0) {
        const origIdx = assigneeOrder.indexOf(dragState.origAssigneeId ?? '__unassigned__');
        const newIdx = Math.max(0, Math.min(assigneeOrder.length - 1, origIdx + rowShift));
        const newAssigneeId = assigneeOrder[newIdx];
        if (newAssigneeId && newAssigneeId !== '__unassigned__' && newAssigneeId !== dragState.origAssigneeId) {
          updateAssigneeMutation.mutate({
            taskId: dragState.taskId,
            userIds: [newAssigneeId],
          });
        }
      }

      setDragState(null);
      setDragDelta({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dayWidth, assigneeOrder, updateDatesMutation, updateAssigneeMutation]);

  // ---- Build header columns ----
  const headerCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(viewStart, i);
      const isToday = date.getTime() === today.getTime();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const showLabel = period === 'week' || period === '2weeks'
        ? true
        : (period === 'month' ? i % 3 === 0 : i % 7 === 0);

      cells.push(
        <div
          key={i}
          className={cn(
            'flex-shrink-0 border-r border-border-secondary/20 flex items-end justify-center pb-1',
            isToday && 'bg-accent-blue/10',
            isWeekend && !isToday && 'bg-bg-secondary/30',
          )}
          style={{ width: dayWidth, height: HEADER_HEIGHT }}
        >
          {showLabel && (
            <span className={cn(
              'text-[10px] text-text-tertiary truncate',
              isToday && 'text-accent-blue font-semibold',
            )}>
              {formatDate(date)}
            </span>
          )}
        </div>,
      );
    }
    return cells;
  }, [viewStart, totalDays, dayWidth, period, today]);

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        <div className="animate-pulse">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-secondary bg-bg-secondary/50">
        <div className="flex items-center gap-1">
          <button onClick={handlePrev} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleToday} className="px-2 py-1 rounded hover:bg-bg-tertiary text-text-secondary text-xs font-medium">
            Today
          </button>
          <button onClick={handleNext} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary">
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="text-xs text-text-tertiary mx-2">
          {formatDate(viewStart)} - {formatDate(viewEnd)}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          {(['week', '2weeks', 'month', '3months'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2 py-1 text-xs rounded',
                period === p
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:bg-bg-tertiary',
              )}
            >
              {p === 'week' ? '1W' : p === '2weeks' ? '2W' : p === 'month' ? '1M' : '3M'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button onClick={zoomIn} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button onClick={zoomOut} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary" title="Zoom out">
            <ZoomOut size={14} />
          </button>
        </div>
      </div>

      {/* Timeline area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: assignee names */}
        <div className="flex-shrink-0 border-r border-border-secondary bg-bg-secondary/30" style={{ width: LEFT_PANEL_WIDTH }}>
          <div className="h-[48px] border-b border-border-secondary flex items-center px-3">
            <span className="text-xs font-medium text-text-secondary">Assignee</span>
          </div>
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {assigneeOrder.map((aid) => {
              const row = assigneeRows.get(aid)!;
              return (
                <div
                  key={aid}
                  className="flex items-center gap-2 px-3 border-b border-border-secondary/30"
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.avatar ? (
                    <img src={row.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-text-tertiary" />
                    </div>
                  )}
                  <span className="text-xs text-text-primary truncate">{row.name}</span>
                  <span className="text-[10px] text-text-quaternary ml-auto">{row.tasks.length}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: timeline */}
        <div className="flex-1 min-w-0 overflow-auto" ref={timelineRef}>
          {/* Header */}
          <div className="flex sticky top-0 z-10 bg-bg-primary border-b border-border-secondary" style={{ width: totalWidth }}>
            {headerCells}
          </div>

          {/* Rows */}
          <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
            {/* Grid lines */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const date = addDays(viewStart, i);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div
                  key={`grid-${i}`}
                  className={cn(
                    'absolute top-0 border-r border-border-secondary/15',
                    isWeekend && 'bg-bg-secondary/20',
                  )}
                  style={{ left: i * dayWidth, width: dayWidth, height: totalHeight }}
                />
              );
            })}

            {/* Row separators */}
            {assigneeOrder.map((_, idx) => (
              <div
                key={`row-${idx}`}
                className="absolute left-0 right-0 border-b border-border-secondary/20"
                style={{ top: (idx + 1) * ROW_HEIGHT }}
              />
            ))}

            {/* Overlap zones */}
            {overlapZones.map((zone, idx) => {
              const rowIdx = assigneeOrder.indexOf(zone.assigneeId);
              if (rowIdx === -1) return null;
              const left = zone.startDay * dayWidth;
              const width = (zone.endDay - zone.startDay) * dayWidth;
              return (
                <div
                  key={`overlap-${idx}`}
                  className="absolute bg-red-500/10 border border-red-400/20 rounded-sm"
                  style={{
                    left,
                    top: rowIdx * ROW_HEIGHT + 2,
                    width,
                    height: ROW_HEIGHT - 4,
                  }}
                />
              );
            })}

            {/* Today line */}
            {todayX >= 0 && todayX <= totalWidth && (
              <div
                className="absolute top-0 w-[2px] bg-accent-blue z-10"
                style={{ left: todayX, height: totalHeight }}
              >
                <div className="absolute -top-1 -left-[5px] w-3 h-3 rounded-full bg-accent-blue">
                  <Crosshair size={8} className="text-white m-[2px]" />
                </div>
              </div>
            )}

            {/* Task bars */}
            {assigneeOrder.map((aid, rowIdx) => {
              const row = assigneeRows.get(aid)!;
              return row.tasks.map((task) => {
                const s = parseDate(task.startDate);
                const e = parseDate(task.dueDate);
                if (!s && !e) return null;

                const taskStart = s ?? e!;
                const taskEnd = e ?? addDays(taskStart, 1);
                const startDay = daysBetween(viewStart, taskStart);
                const endDay = daysBetween(viewStart, taskEnd);
                const barLeft = startDay * dayWidth;
                const barWidth = Math.max((endDay - startDay + 1) * dayWidth - 2, dayWidth * 0.5);
                const barTop = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;

                const isDragging = dragState?.taskId === task.id;
                const color = PRIORITY_COLORS[(task.priority ?? 'none').toLowerCase()] ?? PRIORITY_COLORS.none;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'absolute rounded-md cursor-grab select-none flex items-center px-2 overflow-hidden',
                      'shadow-sm hover:shadow-md transition-shadow border',
                      isDragging && 'opacity-70 cursor-grabbing z-20',
                    )}
                    style={{
                      left: barLeft + (isDragging ? dragDelta.x : 0),
                      top: barTop + (isDragging ? dragDelta.y : 0),
                      width: barWidth,
                      height: BAR_HEIGHT,
                      backgroundColor: color + '22',
                      borderColor: color + '55',
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, task)}
                    onClick={(e) => {
                      if (Math.abs(dragDelta.x) < 3 && Math.abs(dragDelta.y) < 3) {
                        e.stopPropagation();
                        onTaskClick(task.id);
                      }
                    }}
                    title={`${task.title}\n${formatDate(taskStart)} - ${formatDate(taskEnd)}`}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] text-text-primary truncate ml-2 font-medium">
                      {task.title}
                    </span>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
