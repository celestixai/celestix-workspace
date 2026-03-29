import { useVelocityData } from '@/hooks/useSprints';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  folderId: string;
}

export function VelocityChart({ folderId }: Props) {
  const { data, isLoading } = useVelocityData(folderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--cx-text-2)]">
        Loading velocity data...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--cx-text-2)]">
        No completed sprints yet. Velocity data will appear after completing sprints.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    velocity: d.velocity,
    completedPoints: d.completedPoints,
    totalPoints: d.totalPoints,
  }));

  const avgVelocity = chartData.reduce((s, d) => s + d.velocity, 0) / chartData.length;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-sm text-[var(--cx-text-2)]">
        <span>Average velocity: <span className="font-semibold text-[var(--cx-text-1)]">{Math.round(avgVelocity * 10) / 10}</span> pts/sprint</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
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
            <Bar dataKey="completedPoints" fill="var(--color-accent-green)" name="Completed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="totalPoints" fill="var(--color-accent-blue)" name="Committed" radius={[4, 4, 0, 0]} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
