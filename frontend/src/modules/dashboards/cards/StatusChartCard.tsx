import { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCardData } from '@/hooks/useDashboards';
import { CardWrapper } from './CardWrapper';

const DEFAULT_COLORS = ['#3B82F6', '#22c55e', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];

interface StatusChartCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
}

export function StatusChartCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
}: StatusChartCardProps) {
  const { data, isLoading, isError, refetch } = useCardData(cardId);
  const [chartType, setChartType] = useState<'pie' | 'bar'>(
    (config?.chartType as 'pie' | 'bar') ?? 'pie'
  );

  const chartData = (data as { labels?: string[]; values?: number[]; colors?: string[] }) ?? {};
  const labels = chartData.labels ?? [];
  const values = chartData.values ?? [];
  const colors = chartData.colors ?? DEFAULT_COLORS;

  const items = labels.map((label, i) => ({
    name: label,
    value: values[i] ?? 0,
    color: colors[i % colors.length],
  }));

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
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
          No data available
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* Toggle */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setChartType('pie')}
              className={`text-[10px] px-2 py-0.5 rounded ${chartType === 'pie' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Pie
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`text-[10px] px-2 py-0.5 rounded ${chartType === 'bar' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Bar
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    strokeWidth={0}
                  >
                    {items.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px' }}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                </PieChart>
              ) : (
                <BarChart data={items}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {items.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </CardWrapper>
  );
}
