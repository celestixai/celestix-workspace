import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

interface GoalItem {
  id: string;
  name: string;
  progress: number;
  color?: string;
}

interface GoalProgressCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function GoalProgressCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: GoalProgressCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const goals = (data as { goals?: GoalItem[] })?.goals ?? [];

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
      {goals.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
          No goals found
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-primary truncate">{goal.name}</span>
                <span className="text-[10px] font-medium text-text-secondary flex-shrink-0 ml-2">
                  {goal.progress}%
                </span>
              </div>
              <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(goal.progress, 100)}%`,
                    backgroundColor: goal.color || 'var(--accent-blue)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CardWrapper>
  );
}
