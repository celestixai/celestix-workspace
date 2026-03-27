import { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Users,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  useWorkSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useAssignSchedule,
  useTimeOff,
  useUpdateTimeOff,
  useCancelTimeOff,
  useTeamAvailability,
  type WorkSchedule,
  type TimeOff,
  type TimeOffType,
  type TimeOffStatus,
} from '@/hooks/useSchedules';
import { TimeOffCalendar } from './TimeOffCalendar';
import { RequestTimeOffModal } from './RequestTimeOffModal';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_COLORS: Record<TimeOffType, string> = {
  VACATION: 'bg-blue-500',
  SICK: 'bg-red-500',
  PERSONAL: 'bg-green-500',
  HOLIDAY: 'bg-purple-500',
  OTHER: 'bg-gray-500',
};

type Tab = 'schedules' | 'time-off';

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('schedules');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [filterType, setFilterType] = useState<TimeOffType | null>(null);

  // Get workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId = workspaces?.[0]?.id;

  const { data: schedules = [] } = useWorkSchedules(workspaceId);
  const { data: timeOffList = [] } = useTimeOff();
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: availability = [] } = useTeamAvailability(workspaceId, todayStr);

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateTimeOff = useUpdateTimeOff();
  const cancelTimeOff = useCancelTimeOff();

  const pendingTimeOff = useMemo(() => timeOffList.filter((t) => t.status === 'PENDING'), [timeOffList]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-accent" size={24} />
            <h1 className="text-xl font-semibold text-text-primary">Schedules & Time Off</h1>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'schedules' && (
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg"
              >
                <Plus size={16} />
                New Schedule
              </button>
            )}
            {activeTab === 'time-off' && (
              <button
                onClick={() => setShowTimeOffModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg"
              >
                <Plus size={16} />
                Request Time Off
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          {(['schedules', 'time-off'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              {tab === 'schedules' ? 'Work Schedules' : 'Time Off'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'schedules' && (
          <SchedulesTab
            schedules={schedules}
            onEdit={(s) => {
              setEditingSchedule(s);
              setShowCreateModal(true);
            }}
            onDelete={(id) => deleteSchedule.mutate(id)}
          />
        )}

        {activeTab === 'time-off' && (
          <TimeOffTab
            timeOffList={timeOffList}
            pendingTimeOff={pendingTimeOff}
            availability={availability}
            filterType={filterType}
            onFilterChange={setFilterType}
            onApprove={(id) => updateTimeOff.mutate({ id, status: 'APPROVED' })}
            onReject={(id) => updateTimeOff.mutate({ id, status: 'REJECTED' })}
            onCancel={(id) => cancelTimeOff.mutate(id)}
          />
        )}
      </div>

      {/* Schedule Create/Edit Modal */}
      {showCreateModal && (
        <ScheduleFormModal
          workspaceId={workspaceId}
          schedule={editingSchedule}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSchedule(null);
          }}
          onCreate={(data) => createSchedule.mutateAsync(data).then(() => setShowCreateModal(false))}
          onUpdate={(data) => updateSchedule.mutateAsync(data).then(() => setShowCreateModal(false))}
        />
      )}

      {/* Time Off Modal */}
      <RequestTimeOffModal open={showTimeOffModal} onClose={() => setShowTimeOffModal(false)} />
    </div>
  );
}

// ==========================================
// Schedules Tab
// ==========================================

function SchedulesTab({
  schedules,
  onEdit,
  onDelete,
}: {
  schedules: WorkSchedule[];
  onEdit: (s: WorkSchedule) => void;
  onDelete: (id: string) => void;
}) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-16 text-text-tertiary">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No work schedules yet</p>
        <p className="text-sm mt-1">Create a schedule to define working hours for your team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className="bg-bg-secondary border border-border rounded-xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{schedule.name}</h3>
              {schedule.isDefault && (
                <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">
                  Default
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(schedule)}
                className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-text-primary"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(schedule.id)}
                className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Sun size={14} />
              <span>
                {(schedule.workDays as number[]).map((d) => DAY_LABELS[d]).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{schedule.startTime} - {schedule.endTime}</span>
            </div>
            <span>{schedule.workHoursPerDay}h/day</span>
            <span className="text-text-tertiary">{schedule.timezone}</span>
          </div>

          {schedule.userAssignments && schedule.userAssignments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary mb-2">
                <Users size={12} />
                <span>{schedule.userAssignments.length} assigned</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {schedule.userAssignments.map((a) => (
                  <span
                    key={a.id}
                    className="px-2 py-1 bg-bg-tertiary rounded-md text-xs text-text-secondary"
                  >
                    {a.user.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ==========================================
// Time Off Tab
// ==========================================

function TimeOffTab({
  timeOffList,
  pendingTimeOff,
  availability,
  filterType,
  onFilterChange,
  onApprove,
  onReject,
  onCancel,
}: {
  timeOffList: TimeOff[];
  pendingTimeOff: TimeOff[];
  availability: any[];
  filterType: TimeOffType | null;
  onFilterChange: (t: TimeOffType | null) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Team Availability Today */}
      {availability.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Team Availability Today</h3>
          <div className="flex flex-wrap gap-2">
            {availability.map((a) => (
              <div
                key={a.userId}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                  a.status === 'available' && 'border-green-500/30 bg-green-500/5',
                  a.status === 'off' && 'border-red-500/30 bg-red-500/5',
                  a.status === 'half-day' && 'border-yellow-500/30 bg-yellow-500/5',
                  a.status === 'non-working' && 'border-border bg-bg-tertiary'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    a.status === 'available' && 'bg-green-500',
                    a.status === 'off' && 'bg-red-500',
                    a.status === 'half-day' && 'bg-yellow-500',
                    a.status === 'non-working' && 'bg-gray-500'
                  )}
                />
                <span className="text-text-primary">{a.displayName}</span>
                <span className="text-text-tertiary text-xs capitalize">{a.status.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingTimeOff.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Pending Approvals ({pendingTimeOff.length})
          </h3>
          <div className="space-y-2">
            {pendingTimeOff.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-bg-secondary border border-yellow-500/30 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-2.5 h-2.5 rounded-full', TYPE_COLORS[t.type])} />
                  <span className="text-sm font-medium text-text-primary">{t.user.displayName}</span>
                  <span className="text-xs text-text-tertiary">
                    {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
                  </span>
                  {t.isHalfDay && <span className="text-xs text-yellow-500">Half day</span>}
                  {t.note && <span className="text-xs text-text-tertiary truncate max-w-[200px]">{t.note}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onApprove(t.id)}
                    className="p-1.5 hover:bg-green-500/10 rounded-lg text-green-500"
                    title="Approve"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => onReject(t.id)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500"
                    title="Reject"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter by type */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-tertiary">Filter:</span>
        <button
          onClick={() => onFilterChange(null)}
          className={cn(
            'px-2 py-1 rounded text-xs',
            !filterType ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          All
        </button>
        {(Object.keys(TYPE_COLORS) as TimeOffType[]).map((t) => (
          <button
            key={t}
            onClick={() => onFilterChange(filterType === t ? null : t)}
            className={cn(
              'px-2 py-1 rounded text-xs flex items-center gap-1',
              filterType === t ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', TYPE_COLORS[t])} />
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <TimeOffCalendar timeOffList={timeOffList} filterType={filterType} />

      {/* My Time Off List */}
      {timeOffList.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">All Time Off</h3>
          <div className="space-y-2">
            {timeOffList.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-bg-secondary border border-border rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-2.5 h-2.5 rounded-full', TYPE_COLORS[t.type])} />
                  <span className="text-sm font-medium text-text-primary">{t.user.displayName}</span>
                  <span className="text-xs text-text-secondary capitalize">
                    {t.type.toLowerCase()}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
                  </span>
                  {t.isHalfDay && <span className="text-xs text-yellow-500">Half day</span>}
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      t.status === 'APPROVED' && 'bg-green-500/10 text-green-500',
                      t.status === 'PENDING' && 'bg-yellow-500/10 text-yellow-500',
                      t.status === 'REJECTED' && 'bg-red-500/10 text-red-500'
                    )}
                  >
                    {t.status.toLowerCase()}
                  </span>
                </div>
                {t.status !== 'REJECTED' && (
                  <button
                    onClick={() => onCancel(t.id)}
                    className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-red-400"
                    title="Cancel"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Schedule Form Modal
// ==========================================

function ScheduleFormModal({
  workspaceId,
  schedule,
  onClose,
  onCreate,
  onUpdate,
}: {
  workspaceId: string;
  schedule: WorkSchedule | null;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState(schedule?.name || '');
  const [workDays, setWorkDays] = useState<number[]>(
    (schedule?.workDays as number[]) || [1, 2, 3, 4, 5]
  );
  const [hoursPerDay, setHoursPerDay] = useState(schedule?.workHoursPerDay || 8);
  const [startTime, setStartTime] = useState(schedule?.startTime || '09:00');
  const [endTime, setEndTime] = useState(schedule?.endTime || '17:00');
  const [isDefault, setIsDefault] = useState(schedule?.isDefault || false);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || workDays.length === 0) return;
    setSubmitting(true);
    try {
      if (schedule) {
        await onUpdate({
          scheduleId: schedule.id,
          name,
          workDays,
          workHoursPerDay: hoursPerDay,
          startTime,
          endTime,
          isDefault,
        });
      } else {
        await onCreate({
          workspaceId,
          name,
          workDays,
          workHoursPerDay: hoursPerDay,
          startTime,
          endTime,
          isDefault,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">
            {schedule ? 'Edit Schedule' : 'Create Schedule'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Work Week"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Work Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xs font-medium transition-colors',
                    workDays.includes(i)
                      ? 'bg-accent text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:border-accent border border-border'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Hours/Day</label>
              <input
                type="number"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
                min={0.5}
                max={24}
                step={0.5}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-secondary">Set as default schedule</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || workDays.length === 0}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : schedule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
