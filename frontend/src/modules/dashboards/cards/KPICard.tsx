import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

interface KPICardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function KPICard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: KPICardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const kpiData = data as { value?: string | number; label?: string; trend?: 'up' | 'down' | 'none'; trendValue?: string; color?: string } | undefined;
  const value = kpiData?.value ?? config?.value ?? '0';
  const label = kpiData?.label ?? (config?.label as string) ?? title;
  const trend = kpiData?.trend ?? (config?.trend as string) ?? 'none';
  const trendValue = kpiData?.trendValue ?? '';
  const bgColor = kpiData?.color ?? (config?.color as string) ?? undefined;

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
      <div
        className="flex flex-col items-center justify-center h-full rounded-lg px-4 py-3"
        style={bgColor ? { backgroundColor: bgColor + '15' } : undefined}
      >
        {/* Value */}
        <span className="text-3xl font-bold text-text-primary">{String(value)}</span>

        {/* Label */}
        <span className="text-xs text-text-tertiary mt-1">{label}</span>

        {/* Trend */}
        {trend !== 'none' && (
          <div
            className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend !== 'up' && trend !== 'down' && 'text-text-tertiary'
            )}
          >
            {trend === 'up' ? (
              <TrendingUp size={12} />
            ) : trend === 'down' ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    </CardWrapper>
  );
}
