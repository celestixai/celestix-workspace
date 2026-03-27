import { cn } from '@/lib/utils';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  statusColor?: string;
  assignee?: {
    displayName: string;
    avatarUrl?: string;
  };
  dueDate?: string;
}

interface TaskListCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function TaskListCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: TaskListCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const tasks = ((data as { tasks?: TaskItem[] })?.tasks ?? []).slice(0, 10);

  return (
    <CardWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
      onConfigure={onConfigure}
      onDelete={onDelete}
    >
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
          No tasks found
        </div>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              {/* Title */}
              <span className="text-xs text-text-primary truncate flex-1 min-w-0">
                {task.title}
              </span>

              {/* Status pill */}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium"
                style={{
                  backgroundColor: (task.statusColor ?? '#6b7280') + '20',
                  color: task.statusColor ?? '#6b7280',
                }}
              >
                {task.status}
              </span>

              {/* Assignee avatar */}
              {task.assignee && (
                <div className="flex-shrink-0">
                  {task.assignee.avatarUrl ? (
                    <img
                      src={task.assignee.avatarUrl}
                      alt={task.assignee.displayName}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center text-[9px] font-medium text-accent-blue">
                      {task.assignee.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
              )}

              {/* Due date */}
              {task.dueDate && (
                <span className="text-[10px] text-text-tertiary flex-shrink-0">
                  {new Date(task.dueDate).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          ))}

          {((data as { total?: number })?.total ?? 0) > 10 && (
            <div className="text-center pt-1">
              <span className="text-[10px] text-accent-blue cursor-pointer hover:brightness-125">
                View all
              </span>
            </div>
          )}
        </div>
      )}
    </CardWrapper>
  );
}
