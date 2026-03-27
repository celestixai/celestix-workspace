import { useState, useMemo } from 'react';
import {
  Clock,
  DollarSign,
  Timer,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  useReport,
  useReportSummary,
  exportReportCsv,
  useTimesheet,
} from '@/hooks/useTimeTracking';
import { TimeReportChart } from './TimeReportChart';
import { TimesheetGrid } from './TimesheetGrid';
import { useAuthStore } from '@/stores/auth.store';

type Tab = 'reports' | 'timesheet';
type DatePreset = 'this-week' | 'last-week' | 'this-month' | 'custom';
type GroupBy = 'user' | 'task' | 'project' | 'tag';

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  switch (preset) {
    case 'this-week': {
      const start = getWeekStart(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'last-week': {
      const start = getWeekStart(now);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    default:
      return { start: now.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, '0')}`;
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

export function TimeReportPage() {
  const [tab, setTab] = useState<Tab>('reports');
  const [preset, setPreset] = useState<DatePreset>('this-week');
  const [groupBy, setGroupBy] = useState<GroupBy>('user');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Timesheet state
  const user = useAuthStore((s) => s.user);
  const [weekStartDate, setWeekStartDate] = useState(() => getWeekStart(new Date()));

  const dateRange = useMemo(() => {
    if (preset === 'custom') return { start: customStart, end: customEnd };
    return getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const { data: report, loading: reportLoading } = useReport(dateRange.start, dateRange.end, groupBy);
  const { data: summary, loading: summaryLoading } = useReportSummary(dateRange.start, dateRange.end);
  const weekStartStr = weekStartDate.toISOString().split('T')[0];
  const { data: timesheet, loading: tsLoading, refetch: refetchTimesheet } = useTimesheet(user?.id, weekStartStr);

  const handleExport = () => {
    exportReportCsv(dateRange.start, dateRange.end);
  };

  const navigateWeek = (dir: -1 | 1) => {
    setWeekStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <Timer size={20} className="text-accent-blue" />
          <h1 className="text-lg font-semibold text-text-primary">Time Tracking</h1>
        </div>
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'reports' ? 'bg-accent-blue text-white' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setTab('timesheet')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'timesheet' ? 'bg-accent-blue text-white' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Timesheet
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'reports' ? (
          <ReportsTab
            preset={preset}
            setPreset={setPreset}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            dateRange={dateRange}
            report={report}
            summary={summary}
            reportLoading={reportLoading}
            summaryLoading={summaryLoading}
            onExport={handleExport}
          />
        ) : (
          <TimesheetTab
            weekStartDate={weekStartDate}
            timesheet={timesheet}
            loading={tsLoading}
            onNavigateWeek={navigateWeek}
            onRefresh={refetchTimesheet}
          />
        )}
      </div>
    </div>
  );
}

// ======================== REPORTS TAB ========================

function ReportsTab({
  preset,
  setPreset,
  groupBy,
  setGroupBy,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  dateRange,
  report,
  summary,
  reportLoading,
  summaryLoading,
  onExport,
}: any) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5">
          {(['this-week', 'last-week', 'this-month', 'custom'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                preset === p ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {p === 'this-week' ? 'This Week' : p === 'last-week' ? 'Last Week' : p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-bg-secondary text-text-primary text-xs px-3 py-1.5 rounded border border-border-secondary outline-none"
            />
            <span className="text-text-tertiary text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-bg-secondary text-text-primary text-xs px-3 py-1.5 rounded border border-border-secondary outline-none"
            />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-text-tertiary">Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="bg-bg-secondary text-text-primary text-xs px-3 py-1.5 rounded border border-border-secondary outline-none"
          >
            <option value="user">User</option>
            <option value="task">Task</option>
            <option value="project">Project</option>
            <option value="tag">Tag</option>
          </select>

          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-secondary hover:bg-bg-tertiary text-text-secondary rounded border border-border-secondary transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Clock size={18} className="text-accent-blue" />}
          label="Total Tracked"
          value={summary ? formatMinutes(summary.totalTracked) : '--:--'}
          loading={summaryLoading}
        />
        <SummaryCard
          icon={<DollarSign size={18} className="text-green-400" />}
          label="Billable"
          value={summary ? formatMinutes(summary.totalBillable) : '--:--'}
          loading={summaryLoading}
        />
        <SummaryCard
          icon={<Timer size={18} className="text-text-tertiary" />}
          label="Non-Billable"
          value={summary ? formatMinutes(summary.totalNonBillable) : '--:--'}
          loading={summaryLoading}
        />
      </div>

      {/* Chart */}
      <div className="bg-bg-secondary rounded-xl border border-border-primary p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Hours by Day</h3>
        {reportLoading ? (
          <div className="h-80 flex items-center justify-center text-text-tertiary text-sm">Loading...</div>
        ) : report && report.groups.length > 0 ? (
          <TimeReportChart groups={report.groups} startDate={dateRange.start} endDate={dateRange.end} />
        ) : (
          <div className="h-80 flex items-center justify-center text-text-tertiary text-sm">No time entries found for this period</div>
        )}
      </div>

      {/* Grouped Table */}
      {report && report.groups.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
          <div className="px-4 py-3 border-b border-border-primary">
            <h3 className="text-sm font-medium text-text-primary">Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-text-tertiary">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-right py-2 px-4 font-medium">Total</th>
                <th className="text-right py-2 px-4 font-medium">Billable</th>
                <th className="text-right py-2 px-4 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((g: any, i: number) => (
                <tr key={i} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                  <td className="py-2 px-4 text-text-primary">{g.name}</td>
                  <td className="py-2 px-4 text-right text-text-secondary">{formatMinutes(g.totalMinutes)}</td>
                  <td className="py-2 px-4 text-right text-green-400">{formatMinutes(g.billableMinutes)}</td>
                  <td className="py-2 px-4 text-right text-text-tertiary">{g.entries.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-bg-tertiary/30">
                <td className="py-2 px-4 font-medium text-text-primary">Total</td>
                <td className="py-2 px-4 text-right font-medium text-text-primary">{formatMinutes(report.totalMinutes)}</td>
                <td className="py-2 px-4 text-right font-medium text-green-400">{formatMinutes(report.totalBillable)}</td>
                <td className="py-2 px-4 text-right text-text-tertiary">
                  {report.groups.reduce((s: number, g: any) => s + g.entries.length, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-primary p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-text-tertiary">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary">
        {loading ? (
          <div className="h-8 w-20 bg-bg-tertiary rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

// ======================== TIMESHEET TAB ========================

function TimesheetTab({
  weekStartDate,
  timesheet,
  loading,
  onNavigateWeek,
  onRefresh,
}: {
  weekStartDate: Date;
  timesheet: any;
  loading: boolean;
  onNavigateWeek: (dir: -1 | 1) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Week Picker */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onNavigateWeek(-1)}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-text-primary min-w-[240px] text-center">
          {formatWeekRange(weekStartDate)}
        </span>
        <button
          onClick={() => onNavigateWeek(1)}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-text-tertiary text-sm">Loading timesheet...</div>
        ) : timesheet ? (
          <TimesheetGrid days={timesheet.days} weekTotal={timesheet.weekTotal} onRefresh={onRefresh} />
        ) : (
          <div className="h-64 flex items-center justify-center text-text-tertiary text-sm">
            No timesheet data. Start tracking time on tasks to see entries here.
          </div>
        )}
      </div>
    </div>
  );
}
