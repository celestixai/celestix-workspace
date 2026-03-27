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
        <div className="bg-bg-primary rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="text-text-secondary text-center py-8">Loading report...</div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const progressColor =
    report.completionPercent >= 80 ? 'bg-green-500' :
    report.completionPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Sprint Report</h2>
            <p className="text-sm text-text-secondary">{report.sprint.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Goal */}
          {report.sprint.goal && (
            <div className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Goal:</span> {report.sprint.goal}
            </div>
          )}

          {/* Completion bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-text-secondary">Completion</span>
              <span className="font-semibold text-text-primary">{report.completionPercent}%</span>
            </div>
            <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${report.completionPercent}%` }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<CheckCircle2 size={16} className="text-green-500" />}
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
              icon={<Plus size={16} className="text-blue-500" />}
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
          <div className="text-xs text-text-tertiary text-center">
            {new Date(report.sprint.startDate).toLocaleDateString()} - {new Date(report.sprint.endDate).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 border border-border">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <div className="text-sm font-semibold text-text-primary">{value}</div>
      <div className="text-xs text-text-tertiary">{sub}</div>
    </div>
  );
}
