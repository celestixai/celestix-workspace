import { useBurndownData } from '@/hooks/useSprints';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';

interface Props {
  sprintId: string;
}

export function BurndownChart({ sprintId }: Props) {
  const { data, isLoading } = useBurndownData(sprintId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Loading burndown data...
      </div>
    );
  }

  if (!data || data.actualLine.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        No burndown data yet. Start the sprint and record daily snapshots.
      </div>
    );
  }

  // Merge ideal and actual into one dataset keyed by date
  const dateMap = new Map<string, { date: string; ideal?: number; actual?: number }>();

  for (const pt of data.idealLine) {
    dateMap.set(pt.date, { date: pt.date, ideal: Math.round(pt.points * 10) / 10 });
  }
  for (const pt of data.actualLine) {
    const existing = dateMap.get(pt.date) ?? { date: pt.date };
    existing.actual = pt.points;
    dateMap.set(pt.date, existing);
  }

  const chartData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            label={{ value: 'Points', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--color-text-secondary)' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="ideal"
            fill="var(--color-accent-blue)"
            fillOpacity={0.05}
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="var(--color-accent-blue)"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={false}
            name="Ideal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--color-accent-green)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-accent-green)' }}
            name="Actual"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
