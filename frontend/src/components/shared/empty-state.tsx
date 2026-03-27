import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Direct ReactNode action — takes precedence over actionLabel/onAction */
  action?: React.ReactNode;
  /** Simple button label (used when action is not provided) */
  actionLabel?: string;
  /** Called when the simple action button is clicked */
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, description, action, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="text-text-tertiary mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-md mb-4">{description}</p>
      )}
      {action}
      {!action && actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
