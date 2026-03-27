import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { addTimesheetEntry, updateTimesheetEntry } from '@/hooks/useTimeTracking';

interface TimesheetDay {
  date: string;
  dayName: string;
  entries: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    minutes: number;
    note: string | null;
    isBillable: boolean;
  }>;
  totalMinutes: number;
}

interface Props {
  days: TimesheetDay[];
  weekTotal: number;
  onRefresh: () => void;
}

function formatMinutes(m: number): string {
  if (m === 0) return '-';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function parseTimeInput(val: string): number {
  val = val.trim();
  if (!val) return 0;
  // "2h 30m" or "2h30m"
  const hm = val.match(/(\d+)\s*h\s*(\d+)\s*m?/i);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  // "2h"
  const hOnly = val.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (hOnly) return Math.round(parseFloat(hOnly[1]) * 60);
  // "30m"
  const mOnly = val.match(/^(\d+)\s*m$/i);
  if (mOnly) return parseInt(mOnly[1]);
  // bare number = hours (decimal)
  const num = parseFloat(val);
  if (!isNaN(num)) return Math.round(num * 60);
  return 0;
}

function EditableCell({
  value,
  entryId,
  taskId,
  date,
  onSaved,
}: {
  value: number;
  entryId?: string;
  taskId: string;
  date: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    setEditing(false);
    const minutes = parseTimeInput(text);
    if (minutes === value) return;

    try {
      if (entryId) {
        await updateTimesheetEntry(entryId, { minutes });
      } else if (minutes > 0) {
        await addTimesheetEntry({ taskId, date, minutes });
      }
      onSaved();
    } catch {
      // silent
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Tab') {
            // let tab navigation work naturally
          }
        }}
        className="w-full h-full bg-bg-tertiary text-text-primary text-center text-xs px-1 py-1 rounded border border-accent-blue/50 outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setText(value > 0 ? formatMinutes(value) : '');
        setEditing(true);
      }}
      className="w-full h-full text-center text-xs py-1 px-1 rounded hover:bg-bg-hover transition-colors text-text-secondary"
      title="Click to edit"
    >
      {formatMinutes(value)}
    </button>
  );
}

export function TimesheetGrid({ days, weekTotal, onRefresh }: Props) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskId, setNewTaskId] = useState('');

  // Gather unique tasks across all days
  const taskMap = new Map<string, string>();
  for (const day of days) {
    for (const entry of day.entries) {
      if (!taskMap.has(entry.taskId)) {
        taskMap.set(entry.taskId, entry.taskTitle);
      }
    }
  }
  const tasks = Array.from(taskMap.entries()).map(([id, title]) => ({ id, title }));

  // Build task-row data: taskId -> [minutes for each day]
  const getEntryForTaskDay = (taskId: string, dayIdx: number) => {
    const dayEntries = days[dayIdx]?.entries || [];
    return dayEntries.find((e) => e.taskId === taskId);
  };

  const getMinutesForTaskDay = (taskId: string, dayIdx: number) => {
    const entry = getEntryForTaskDay(taskId, dayIdx);
    return entry?.minutes || 0;
  };

  const getTaskTotal = (taskId: string) => {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      total += getMinutesForTaskDay(taskId, i);
    }
    return total;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left py-2 px-3 text-text-tertiary font-medium w-48">Task</th>
            {days.map((day) => (
              <th key={day.date} className="text-center py-2 px-2 text-text-tertiary font-medium min-w-[80px]">
                <div>{day.dayName}</div>
                <div className="text-[10px] text-text-tertiary/60">
                  {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </th>
            ))}
            <th className="text-center py-2 px-2 text-text-tertiary font-medium min-w-[80px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
              <td className="py-1.5 px-3 text-text-primary truncate max-w-[200px]" title={task.title}>
                {task.title}
              </td>
              {days.map((day, dayIdx) => {
                const entry = getEntryForTaskDay(task.id, dayIdx);
                return (
                  <td key={day.date} className="py-1 px-1">
                    <EditableCell
                      value={getMinutesForTaskDay(task.id, dayIdx)}
                      entryId={entry?.id}
                      taskId={task.id}
                      date={day.date}
                      onSaved={onRefresh}
                    />
                  </td>
                );
              })}
              <td className="py-1.5 px-2 text-center text-text-secondary font-medium text-xs">
                {formatMinutes(getTaskTotal(task.id))}
              </td>
            </tr>
          ))}

          {/* Add task row */}
          {addingTask ? (
            <tr className="border-b border-border-primary/50">
              <td colSpan={9} className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <input
                    value={newTaskId}
                    onChange={(e) => setNewTaskId(e.target.value)}
                    placeholder="Enter Task ID..."
                    className="flex-1 bg-bg-tertiary text-text-primary text-xs px-3 py-1.5 rounded border border-border-secondary outline-none focus:border-accent-blue"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAddingTask(false);
                    }}
                  />
                  <button
                    onClick={() => setAddingTask(false)}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={9} className="py-2 px-3">
                <button
                  onClick={() => setAddingTask(true)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-accent-blue transition-colors"
                >
                  <Plus size={14} />
                  Add Task
                </button>
              </td>
            </tr>
          )}

          {/* Daily totals */}
          <tr className="border-t-2 border-border-primary bg-bg-secondary/30">
            <td className="py-2 px-3 text-text-secondary font-medium text-xs">Daily Total</td>
            {days.map((day) => (
              <td key={day.date} className="py-2 px-2 text-center text-text-primary font-medium text-xs">
                {formatMinutes(day.totalMinutes)}
              </td>
            ))}
            <td className="py-2 px-2 text-center text-accent-blue font-semibold text-xs">
              {formatMinutes(weekTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
