import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ReportGroup {
  name: string;
  totalMinutes: number;
  billableMinutes: number;
  entries: any[];
}

interface Props {
  groups: ReportGroup[];
  startDate: string;
  endDate: string;
}

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B',
  '#14B8A6', '#F97316', '#22c55e', '#f97316', '#60A5FA',
];

export function TimeReportChart({ groups, startDate, endDate }: Props) {
  // Build daily data across the date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayMap = new Map<string, Record<string, number>>();
  const groupNames = groups.map((g) => g.name).slice(0, 10);

  // Initialize days
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    const row: Record<string, number> = { date: 0 };
    groupNames.forEach((n) => (row[n] = 0));
    dayMap.set(key, row);
  }

  // Populate from entries
  for (const group of groups) {
    if (!groupNames.includes(group.name)) continue;
    for (const entry of group.entries) {
      const dateStr = new Date(entry.startedAt).toISOString().split('T')[0];
      const row = dayMap.get(dateStr);
      if (row) {
        row[group.name] = (row[group.name] || 0) + (entry.durationMinutes || 0) / 60;
      }
    }
  }

  const chartData = Array.from(dayMap.entries()).map(([date, values]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...values,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--cx-text-3)] text-sm">
        No data for selected range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.40)', fontSize: 11 }} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.40)', fontSize: 11 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.40)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#161618', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
          labelStyle={{ color: 'rgba(255,255,255,0.90)' }}
          formatter={(value: number) => [`${value.toFixed(1)}h`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {groupNames.map((name, i) => (
          <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === groupNames.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
