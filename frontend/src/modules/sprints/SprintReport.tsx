import { useSprintReport } from '@/hooks/useSprints';
import { X, CheckCircle2, ArrowRight, Plus, Gauge } from 'lucide-react';

interface Props {
  sprintId: string;
  onClose: () => void;
}

export function SprintReport({ sprintId, onClose }: Props) {
  const { data: report, isLoading } = useSprintReport(sprintId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-cx-bg rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="text-[var(--cx-text-2)] text-center py-8">Loading report...</div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const progressColor =
    report.completionPercent >= 80 ? 'bg-cx-success' :
    report.completionPercent >= 50 ? 'bg-cx-warning' : 'bg-cx-danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-cx-bg rounded-xl shadow-xl w-full max-w-lg border border-[var(--cx-border-1)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--cx-border-1)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">Sprint Report</h2>
            <p className="text-sm text-[var(--cx-text-2)]">{report.sprint.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cx-raised text-[var(--cx-text-2)]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Goal */}
          {report.sprint.goal && (
            <div className="text-sm text-[var(--cx-text-2)]">
              <span className="font-medium text-[var(--cx-text-1)]">Goal:</span> {report.sprint.goal}
            </div>
          )}

          {/* Completion bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-[var(--cx-text-2)]">Completion</span>
              <span className="font-semibold text-[var(--cx-text-1)]">{report.completionPercent}%</span>
            </div>
            <div className="h-3 bg-cx-raised rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${report.completionPercent}%` }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<CheckCircle2 size={16} className="text-cx-success" />}
              label="Completed"
              value={`${report.completedTasks} / ${report.totalTasks} tasks`}
              sub={`${report.completedPoints} / ${report.totalPoints} pts`}
            />
            <StatCard
              icon={<ArrowRight size={16} className="text-orange-500" />}
              label="Carryover"
              value={`${report.carryover} tasks`}
              sub="Not completed"
            />
            <StatCard
              icon={<Plus size={16} className="text-cx-brand" />}
              label="Added During"
              value={`${report.addedDuringSprint} tasks`}
              sub="Scope change"
            />
            <StatCard
              icon={<Gauge size={16} className="text-purple-500" />}
              label="Velocity"
              value={`${Math.round(report.velocity * 10) / 10} pts`}
              sub="Completed points"
            />
          </div>

          {/* Date range */}
          <div className="text-xs text-[var(--cx-text-3)] text-center">
            {new Date(report.sprint.startDate).toLocaleDateString()} - {new Date(report.sprint.endDate).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-cx-surface rounded-lg p-3 border border-[var(--cx-border-1)]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-[var(--cx-text-2)]">{label}</span>
      </div>
      <div className="text-sm font-semibold text-[var(--cx-text-1)]">{value}</div>
      <div className="text-xs text-[var(--cx-text-3)]">{sub}</div>
    </div>
  );
}
