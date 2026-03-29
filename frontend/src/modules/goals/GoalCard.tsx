import { useMemo } from 'react';
import { Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Goal } from '@/hooks/useGoals';
import { Avatar } from '@/components/shared/avatar';

interface GoalCardProps {
  goal: Goal;
  onClick: (goal: Goal) => void;
}

function CircularProgress({ percentage, color, size = 80 }: { percentage: number; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-text-primary">{percentage}%</span>
      </div>
    </div>
  );
}

export function GoalCard({ goal, onClick }: GoalCardProps) {
  const dueInfo = useMemo(() => {
    if (!goal.dueDate) return null;
    const now = new Date();
    const due = new Date(goal.dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', overdue: true };
    if (diffDays === 0) return { text: 'Due today', overdue: false };
    if (diffDays === 1) return { text: '1 day left', overdue: false };
    return { text: `${diffDays} days left`, overdue: false };
  }, [goal.dueDate]);

  const targetCount = goal.targets?.length ?? 0;

  return (
    <button
      onClick={() => onClick(goal)}
      className="w-full text-left px-6 py-5 rounded-[12px] bg-[#111113] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:shadow-md transition-all duration-150 group"
    >
      {/* Top: name + color indicator */}
      <div className="flex items-start gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: goal.color || 'var(--accent-blue)' }}
        />
        <h3 className="text-[16px] font-semibold text-white truncate flex-1 group-hover:text-accent-blue transition-colors">
          {goal.name}
        </h3>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="text-[11px] text-[rgba(255,255,255,0.40)] truncate mb-3 ml-4">
          {goal.description}
        </p>
      )}

      {/* Target value */}
      <div className="flex items-baseline gap-1.5 my-3 ml-4">
        <span className="font-mono text-[24px] text-white font-medium">{goal.progress ?? 0}%</span>
        <span className="font-mono text-[14px] text-[rgba(255,255,255,0.40)]">/ 100%</span>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-1">
        <div className="h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${goal.progress ?? 0}%`,
              backgroundColor:
                (goal.progress ?? 0) >= 90 ? '#22c55e' :
                (goal.progress ?? 0) >= 60 ? '#3b82f6' : '#eab308',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {/* Owner avatar */}
          {goal.owner && (
            <Avatar
              src={goal.owner.avatarUrl}
              name={goal.owner.displayName}
              size="xs"
              userId={goal.owner.id}
            />
          )}
          {/* Target count */}
          <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
            <Target size={10} />
            {targetCount} target{targetCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Due date */}
        {dueInfo && (
          <span
            className={cn(
              'flex items-center gap-1 text-[12px] font-medium',
              dueInfo.overdue ? 'text-accent-red' : 'text-[rgba(255,255,255,0.40)]'
            )}
          >
            <Clock size={10} />
            {dueInfo.text}
          </span>
        )}
      </div>
    </button>
  );
}

export { CircularProgress };
