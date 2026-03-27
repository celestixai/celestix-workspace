import { AlertTriangle, CalendarCheck, CalendarDays, CalendarOff } from 'lucide-react';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

interface DueDateOverviewCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function DueDateOverviewCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: DueDateOverviewCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const overview = data as {
    overdue?: number;
    dueToday?: number;
    dueThisWeek?: number;
    noDate?: number;
  } | undefined;

  const stats = [
    {
      label: 'Overdue',
      value: overview?.overdue ?? 0,
      color: '#ef4444',
      bgColor: '#ef444420',
      icon: AlertTriangle,
    },
    {
      label: 'Due Today',
      value: overview?.dueToday ?? 0,
      color: '#f59e0b',
      bgColor: '#f59e0b20',
      icon: CalendarCheck,
    },
    {
      label: 'This Week',
      value: overview?.dueThisWeek ?? 0,
      color: '#3b82f6',
      bgColor: '#3b82f620',
      icon: CalendarDays,
    },
    {
      label: 'No Date',
      value: overview?.noDate ?? 0,
      color: '#6b7280',
      bgColor: '#6b728020',
      icon: CalendarOff,
    },
  ];

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full items-center">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center justify-center p-2 rounded-lg"
            style={{ backgroundColor: stat.bgColor }}
          >
            <stat.icon size={14} style={{ color: stat.color }} className="mb-1" />
            <span className="text-lg font-bold text-text-primary">{stat.value}</span>
            <span className="text-[10px] mt-0.5" style={{ color: stat.color }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </CardWrapper>
  );
}
