import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Hash,
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

interface WorkloadViewProps {
  tasks: any[];
  isLoading: boolean;
  spaceId?: string;
  workspaceId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type MeasureBy = 'time' | 'count';
type PeriodMode = 'weekly' | 'daily';

interface PeriodData {
  start: Date;
  end: Date;
  taskCount: number;
  totalMinutes: number;
  capacityMinutes: number;
  tasks: Task[];
}

interface UserRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  periods: PeriodData[];
}

// -----------------------------------------------
// Constants
// -----------------------------------------------

const DEFAULT_CAPACITY_HOURS = 40;
const DEFAULT_CAPACITY_MINUTES = DEFAULT_CAPACITY_HOURS * 60;

// -----------------------------------------------
// Helpers
// -----------------------------------------------

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

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function minutesToHours(m: number): string {
  const h = Math.round(m / 60 * 10) / 10;
  return `${h}h`;
}

function getCapacityColor(ratio: number): { bg: string; bar: string; text: string } {
  if (ratio > 1.0) return { bg: 'bg-cx-danger/10', bar: 'bg-cx-danger', text: 'text-cx-danger' };
  if (ratio > 0.7) return { bg: 'bg-cx-warning/10', bar: 'bg-cx-warning', text: 'text-cx-warning' };
  return { bg: 'bg-cx-success/10', bar: 'bg-cx-success', text: 'text-cx-success' };
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
// WorkloadView Component
// -----------------------------------------------

export function WorkloadView({
  tasks,
  isLoading,
  spaceId: _spaceId,
  workspaceId: _workspaceId,
  onTaskClick,
  onRefresh: _onRefresh,
}: WorkloadViewProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');
  const [measureBy, setMeasureBy] = useState<MeasureBy>('time');
  const [capacityHours, setCapacityHours] = useState(DEFAULT_CAPACITY_HOURS);
  const [viewStart, setViewStart] = useState<Date>(() => startOfWeek(today));
  const [expandedCell, setExpandedCell] = useState<string | null>(null); // "userId:periodIdx"

  const numPeriods = periodMode === 'weekly' ? 4 : 7;
  const periodDays = periodMode === 'weekly' ? 7 : 1;
  const capacityMinutes = periodMode === 'weekly' ? capacityHours * 60 : (capacityHours / 5) * 60;

  // ---- Build periods ----
  const periods = useMemo(() => {
    const result: Array<{ start: Date; end: Date }> = [];
    const cursor = new Date(viewStart);
    for (let i = 0; i < numPeriods; i++) {
      const start = new Date(cursor);
      const end = addDays(cursor, periodDays - 1);
      end.setHours(23, 59, 59, 999);
      result.push({ start, end });
      cursor.setDate(cursor.getDate() + periodDays);
    }
    return result;
  }, [viewStart, numPeriods, periodDays]);

  // ---- Build user rows from tasks ----
  const userRows = useMemo(() => {
    const userMap = new Map<string, { name: string; avatar: string | null; tasks: Task[] }>();

    for (const task of tasks as Task[]) {
      const assigneeIds = task.assignees && task.assignees.length > 0
        ? task.assignees.map((a) => a.user?.id ?? a.id)
        : ['__unassigned__'];

      for (const aid of assigneeIds) {
        if (!userMap.has(aid)) {
          userMap.set(aid, {
            name: aid === '__unassigned__' ? 'Unassigned' : getAssigneeName(task),
            avatar: aid === '__unassigned__' ? null : getAssigneeAvatar(task),
            tasks: [],
          });
        }
        userMap.get(aid)!.tasks.push(task);
      }
    }

    const rows: UserRow[] = [];

    const sortedKeys = Array.from(userMap.keys()).sort((a, b) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      return userMap.get(a)!.name.localeCompare(userMap.get(b)!.name);
    });

    for (const uid of sortedKeys) {
      const info = userMap.get(uid)!;
      const userPeriods: PeriodData[] = periods.map((period) => {
        const periodTasks = info.tasks.filter((t) => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          return due >= period.start && due <= period.end;
        });

        const totalMinutes = periodTasks.reduce(
          (sum, t) => sum + (t.timeEstimate ?? 0),
          0,
        );

        return {
          start: period.start,
          end: period.end,
          taskCount: periodTasks.length,
          totalMinutes,
          capacityMinutes,
          tasks: periodTasks,
        };
      });

      rows.push({
        userId: uid,
        displayName: info.name,
        avatarUrl: info.avatar,
        periods: userPeriods,
      });
    }

    return rows;
  }, [tasks, periods, capacityMinutes]);

  // ---- Summary row ----
  const summaryPeriods = useMemo(() => {
    return periods.map((_, periodIdx) => {
      let totalTasks = 0;
      let totalMinutes = 0;

      for (const row of userRows) {
        totalTasks += row.periods[periodIdx].taskCount;
        totalMinutes += row.periods[periodIdx].totalMinutes;
      }

      return { taskCount: totalTasks, totalMinutes };
    });
  }, [periods, userRows]);

  // ---- Navigation ----
  const handlePrev = useCallback(() => {
    setViewStart((prev) => addDays(prev, -(periodMode === 'weekly' ? 7 * numPeriods : numPeriods)));
  }, [periodMode, numPeriods]);

  const handleNext = useCallback(() => {
    setViewStart((prev) => addDays(prev, periodMode === 'weekly' ? 7 * numPeriods : numPeriods));
  }, [periodMode, numPeriods]);

  const handleToday = useCallback(() => {
    setViewStart(startOfWeek(today));
  }, [today]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedCell((prev) => (prev === key ? null : key));
  }, []);

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        <div className="animate-pulse">Loading workload...</div>
      </div>
    );
  }

  const LEFT_COL_WIDTH = 200;
  const CELL_WIDTH = 160;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-secondary bg-bg-secondary/50 flex-wrap">
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
          {formatWeekLabel(periods[0]?.start ?? today)} - {formatWeekLabel(periods[periods.length - 1]?.end ?? today)}
        </span>

        {/* Period mode */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => setPeriodMode('weekly')}
            className={cn('px-2 py-1 text-xs rounded', periodMode === 'weekly' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary')}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriodMode('daily')}
            className={cn('px-2 py-1 text-xs rounded', periodMode === 'daily' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary')}
          >
            Daily
          </button>
        </div>

        {/* Measure by */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => setMeasureBy('time')}
            className={cn('px-2 py-1 text-xs rounded flex items-center gap-1', measureBy === 'time' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary')}
          >
            <Clock size={12} /> Time
          </button>
          <button
            onClick={() => setMeasureBy('count')}
            className={cn('px-2 py-1 text-xs rounded flex items-center gap-1', measureBy === 'count' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary')}
          >
            <Hash size={12} /> Count
          </button>
        </div>

        {/* Capacity input */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-text-tertiary">Capacity:</span>
          <input
            type="number"
            value={capacityHours}
            onChange={(e) => setCapacityHours(Math.max(1, parseInt(e.target.value) || DEFAULT_CAPACITY_HOURS))}
            className="w-12 px-1 py-0.5 text-xs rounded border border-border-secondary bg-bg-primary text-text-primary text-center"
          />
          <span className="text-xs text-text-tertiary">h/wk</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse min-w-full">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-bg-primary">
            <tr>
              <th
                className="border-b border-r border-border-secondary px-3 py-2 text-left text-xs font-medium text-text-secondary bg-bg-secondary/30"
                style={{ width: LEFT_COL_WIDTH, minWidth: LEFT_COL_WIDTH }}
              >
                Member
              </th>
              {periods.map((period, idx) => (
                <th
                  key={idx}
                  className="border-b border-r border-border-secondary px-2 py-2 text-center text-xs font-medium text-text-secondary bg-bg-secondary/30"
                  style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                >
                  {periodMode === 'weekly' ? formatWeekLabel(period.start) : formatDayLabel(period.start)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {userRows.map((row) => (
              <>
                <tr key={row.userId}>
                  {/* User cell */}
                  <td className="border-b border-r border-border-secondary px-3 py-2 bg-bg-secondary/10">
                    <div className="flex items-center gap-2">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-text-tertiary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-text-primary truncate">{row.displayName}</div>
                      </div>
                    </div>
                  </td>

                  {/* Period cells */}
                  {row.periods.map((pd, periodIdx) => {
                    const ratio = pd.capacityMinutes > 0 ? pd.totalMinutes / pd.capacityMinutes : 0;
                    const countRatio = pd.capacityMinutes > 0 ? (pd.taskCount * (capacityMinutes / 5)) / pd.capacityMinutes : 0;
                    const displayRatio = measureBy === 'time' ? ratio : countRatio;
                    const colors = getCapacityColor(displayRatio);
                    const cellKey = `${row.userId}:${periodIdx}`;
                    const isExpanded = expandedCell === cellKey;

                    return (
                      <td
                        key={periodIdx}
                        className={cn(
                          'border-b border-r border-border-secondary px-2 py-2 cursor-pointer hover:bg-bg-tertiary/30 transition-colors',
                          colors.bg,
                        )}
                        onClick={() => pd.taskCount > 0 && toggleExpand(cellKey)}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {/* Capacity bar */}
                          <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', colors.bar)}
                              style={{ width: `${Math.min(displayRatio * 100, 100)}%` }}
                            />
                          </div>

                          {/* Hours / Count label */}
                          {measureBy === 'time' ? (
                            <span className={cn('text-[11px] font-medium', colors.text)}>
                              {minutesToHours(pd.totalMinutes)} / {minutesToHours(pd.capacityMinutes)}
                            </span>
                          ) : (
                            <span className={cn('text-[11px] font-medium', colors.text)}>
                              {pd.taskCount} tasks
                            </span>
                          )}

                          {/* Task count */}
                          {measureBy === 'time' && (
                            <span className="text-[10px] text-text-quaternary">
                              {pd.taskCount} task{pd.taskCount !== 1 ? 's' : ''}
                            </span>
                          )}

                          {/* Expand arrow */}
                          {pd.taskCount > 0 && (
                            <div className="text-text-quaternary">
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Expanded task list for any cell in this row */}
                {row.periods.map((pd, periodIdx) => {
                  const cellKey = `${row.userId}:${periodIdx}`;
                  if (expandedCell !== cellKey || pd.taskCount === 0) return null;

                  return (
                    <tr key={`expand-${cellKey}`}>
                      <td colSpan={1 + periods.length} className="border-b border-border-secondary bg-bg-secondary/20 px-4 py-2">
                        <div className="text-xs font-medium text-text-secondary mb-2">
                          {row.displayName} - {periodMode === 'weekly' ? formatWeekLabel(pd.start) : formatDayLabel(pd.start)}
                        </div>
                        <div className="space-y-1">
                          {pd.tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-tertiary cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
                            >
                              <span className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0',
                                task.priority === 'URGENT' ? 'bg-cx-danger' :
                                task.priority === 'HIGH' ? 'bg-orange-500' :
                                task.priority === 'MEDIUM' ? 'bg-cx-warning' :
                                task.priority === 'LOW' ? 'bg-cx-brand' : 'bg-[var(--cx-text-3)]',
                              )} />
                              <span className="text-xs text-text-primary truncate flex-1">{task.title}</span>
                              {task.timeEstimate != null && task.timeEstimate > 0 && (
                                <span className="text-[10px] text-text-quaternary flex-shrink-0">
                                  {minutesToHours(task.timeEstimate)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}

            {/* Summary row */}
            <tr className="bg-bg-secondary/40">
              <td className="border-b border-r border-border-secondary px-3 py-2">
                <span className="text-xs font-semibold text-text-secondary">TOTAL</span>
              </td>
              {summaryPeriods.map((sp, idx) => (
                <td key={idx} className="border-b border-r border-border-secondary px-2 py-2 text-center">
                  <div className="text-xs font-semibold text-text-secondary">
                    {measureBy === 'time' ? minutesToHours(sp.totalMinutes) : `${sp.taskCount} tasks`}
                  </div>
                  {measureBy === 'time' && (
                    <div className="text-[10px] text-text-quaternary">{sp.taskCount} tasks</div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
