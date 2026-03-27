import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface WorkloadCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function WorkloadCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: WorkloadCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);

  const workloadData = (data as { assignees?: Array<{ name: string; count: number }> })?.assignees ?? [];

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
      {workloadData.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
          No workload data
        </div>
      ) : (
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workloadData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {workloadData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardWrapper>
  );
}
