import { cn } from '@/lib/utils';

interface BadgeProps {
  count?: number;
  variant?: 'default' | 'dot';
  color?: string;
  className?: string;
}

export function Badge({ count, variant = 'default', color, className }: BadgeProps) {
  if (variant === 'dot') {
    return (
      <span
        className={cn('h-2 w-2 rounded-full', className)}
        style={{ backgroundColor: color || 'var(--accent-blue)' }}
      />
    );
  }

  if (!count || count === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white',
        className
      )}
      style={{ backgroundColor: color || 'var(--accent-blue)' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
