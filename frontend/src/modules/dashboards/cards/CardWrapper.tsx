import { useState } from 'react';
import { RefreshCw, Settings, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CardWrapperProps {
  title: string;
  isEditMode?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function CardWrapper({
  title,
  isEditMode,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
  onConfigure,
  onDelete,
  children,
  className,
}: CardWrapperProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    if (!onRefresh) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div
      className={cn(
        'bg-bg-secondary border border-border-primary rounded-xl flex flex-col overflow-hidden h-full',
        className
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary min-h-[36px]">
        <div className="flex items-center gap-2 min-w-0">
          {isEditMode && (
            <GripVertical size={14} className="text-text-tertiary flex-shrink-0 cursor-grab" />
          )}
          <span className="text-xs font-medium text-text-secondary truncate">{title}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
              title="Refresh"
            >
              <RefreshCw
                size={12}
                className={cn(refreshing && 'animate-spin')}
              />
            </button>
          )}
          {isEditMode && onConfigure && (
            <button
              onClick={onConfigure}
              className="p-1 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
              title="Configure"
            >
              <Settings size={12} />
            </button>
          )}
          {isEditMode && onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-md text-text-tertiary hover:text-accent-red hover:bg-bg-tertiary transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 overflow-auto">
        {isLoading ? (
          <CardLoadingSkeleton />
        ) : isError ? (
          <CardErrorState message={errorMessage} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function CardLoadingSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full mt-2" />
    </div>
  );
}

function CardErrorState({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
      <p>{message || 'Failed to load card data'}</p>
    </div>
  );
}
