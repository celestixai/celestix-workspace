import { formatRelativeTime } from '@/lib/utils';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

interface ActivityItem {
  id: string;
  user?: {
    displayName: string;
    avatarUrl?: string;
  };
  action: string;
  timestamp: string;
}

interface RecentActivityCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function RecentActivityCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: RecentActivityCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const activities = ((data as { activities?: ActivityItem[] })?.activities ?? []).slice(0, 10);

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
      {activities.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
          No recent activity
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2 p-1.5 rounded-md hover:bg-bg-tertiary transition-colors"
            >
              {/* Avatar */}
              {item.user?.avatarUrl ? (
                <img
                  src={item.user.avatarUrl}
                  alt={item.user.displayName}
                  className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center text-[9px] font-medium text-accent-blue flex-shrink-0 mt-0.5">
                  {item.user?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-secondary leading-tight">
                  {item.action}
                </p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {formatRelativeTime(item.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardWrapper>
  );
}
