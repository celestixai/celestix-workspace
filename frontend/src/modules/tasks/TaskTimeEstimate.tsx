import { useState } from 'react';
import { useTimeSummary, useSetTimeEstimate } from '@/hooks/useTimeEstimate';
import { cn } from '@/lib/utils';
import { Clock, Edit2, Check, X } from 'lucide-react';

interface TaskTimeEstimateProps {
  taskId: string;
  timeEstimate?: number | null;
  timeSummary?: {
    estimatedTotal: number;
    trackedTotal: number;
    remaining: number;
    percentComplete: number;
  } | null;
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TaskTimeEstimate({ taskId, timeEstimate, timeSummary }: TaskTimeEstimateProps) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const { data: fullSummary } = useTimeSummary(taskId);
  const setEstimate = useSetTimeEstimate(taskId);

  // fullSummary uses { estimated: { total }, tracked: { total } } shape
  // timeSummary (inline from getTask) uses { estimatedTotal, trackedTotal } shape
  const estimatedTotal = fullSummary
    ? fullSummary.estimated.total
    : (timeSummary as any)?.estimatedTotal ?? timeEstimate ?? 0;
  const trackedTotal = fullSummary
    ? fullSummary.tracked.total
    : (timeSummary as any)?.trackedTotal ?? 0;
  const percentComplete = fullSummary
    ? fullSummary.percentComplete
    : (timeSummary as any)?.percentComplete ?? 0;

  const startEdit = () => {
    const h = Math.floor(estimatedTotal / 60);
    const m = estimatedTotal % 60;
    setHours(h > 0 ? String(h) : '');
    setMins(m > 0 ? String(m) : '');
    setEditing(true);
  };

  const saveEstimate = () => {
    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(mins) || 0);
    setEstimate.mutate(totalMinutes);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="text-text-tertiary flex-shrink-0" />
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            min="0"
            className="w-12 px-1.5 py-0.5 text-xs bg-bg-tertiary border border-border-secondary rounded text-text-primary text-center"
          />
          <span className="text-xs text-text-tertiary">h</span>
          <input
            type="number"
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            placeholder="0"
            min="0"
            max="59"
            className="w-12 px-1.5 py-0.5 text-xs bg-bg-tertiary border border-border-secondary rounded text-text-primary text-center"
          />
          <span className="text-xs text-text-tertiary">m</span>
        </div>
        <button onClick={saveEstimate} className="p-0.5 text-accent-green hover:bg-accent-green/10 rounded">
          <Check size={14} />
        </button>
        <button onClick={cancelEdit} className="p-0.5 text-text-tertiary hover:text-text-primary rounded">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!estimatedTotal && !trackedTotal) {
    return (
      <button
        onClick={startEdit}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors"
      >
        <Clock size={14} />
        Set Estimate
      </button>
    );
  }

  const clampedPercent = Math.min(percentComplete, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-text-tertiary flex-shrink-0" />
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-primary font-medium">{formatMinutes(trackedTotal)}</span>
          <span className="text-text-tertiary">/</span>
          <span className="text-text-tertiary">{formatMinutes(estimatedTotal)}</span>
          {estimatedTotal > 0 && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              percentComplete >= 100
                ? 'bg-accent-red/10 text-accent-red'
                : percentComplete >= 75
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-accent-green/10 text-accent-green'
            )}>
              {percentComplete}%
            </span>
          )}
        </div>
        <button
          onClick={startEdit}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-all"
        >
          <Edit2 size={12} />
        </button>
      </div>

      {/* Progress bar */}
      {estimatedTotal > 0 && (
        <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              percentComplete >= 100
                ? 'bg-accent-red'
                : percentComplete >= 75
                  ? 'bg-yellow-500'
                  : 'bg-accent-green'
            )}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}

      {/* Per-user breakdown */}
      {fullSummary && fullSummary.tracked.perUser.length > 0 && (
        <div className="space-y-0.5 pl-5">
          {fullSummary.tracked.perUser.map((u) => (
            <div key={u.userId} className="flex items-center gap-2 text-[10px] text-text-tertiary">
              <span className="truncate max-w-[100px]">{u.displayName}</span>
              <span>{formatMinutes(u.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
