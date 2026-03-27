import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TargetProgressBarProps {
  current: number;
  target: number;
  color?: string;
  showLabel?: boolean;
}

export function TargetProgressBar({ current, target, color, showLabel = true }: TargetProgressBarProps) {
  const percentage = useMemo(() => {
    if (target <= 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  }, [current, target]);

  const barColor = useMemo(() => {
    if (color) return color;
    if (percentage <= 33) return 'var(--accent-red)';
    if (percentage <= 66) return 'var(--accent-amber)';
    return 'var(--accent-emerald)';
  }, [percentage, color]);

  return (
    <div className="w-full">
      <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-text-tertiary">
            {current} / {target}
          </span>
          <span className="text-[10px] font-medium text-text-secondary">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
