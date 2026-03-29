import { useState, useEffect, useMemo } from 'react';
import { X, Repeat, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRecurrence,
  useCreateRecurrence,
  useUpdateRecurrence,
  useDeleteRecurrence,
  usePauseRecurrence,
  useResumeRecurrence,
  type RecurrenceConfig,
} from '@/hooks/useRecurring';

interface RecurrenceModalProps {
  taskId: string;
  onClose: () => void;
  existingConfig?: any;
}

const FREQUENCIES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Biweekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;

type EndCondition = 'never' | 'after' | 'on_date';

export function RecurrenceModal({ taskId, onClose }: RecurrenceModalProps) {
  const { data: existing, isLoading } = useRecurrence(taskId);
  const createMutation = useCreateRecurrence(taskId);
  const updateMutation = useUpdateRecurrence(taskId);
  const deleteMutation = useDeleteRecurrence(taskId);
  const pauseMutation = usePauseRecurrence(taskId);
  const resumeMutation = useResumeRecurrence(taskId);

  const hasSchedule = !!existing && !isLoading;

  const [frequency, setFrequency] = useState<string>('DAILY');
  const [interval, setInterval_] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endCondition, setEndCondition] = useState<EndCondition>('never');
  const [maxOccurrences, setMaxOccurrences] = useState(10);
  const [endDate, setEndDate] = useState('');

  // Populate from existing schedule
  useEffect(() => {
    if (existing) {
      setFrequency(existing.frequency);
      setInterval_(existing.interval);
      if (existing.daysOfWeek) setDaysOfWeek(existing.daysOfWeek);
      if (existing.dayOfMonth) setDayOfMonth(existing.dayOfMonth);
      setStartDate(existing.startDate.slice(0, 10));
      if (existing.maxOccurrences) {
        setEndCondition('after');
        setMaxOccurrences(existing.maxOccurrences);
      } else if (existing.endDate) {
        setEndCondition('on_date');
        setEndDate(existing.endDate.slice(0, 10));
      }
    }
  }, [existing]);

  const intervalLabel = useMemo(() => {
    switch (frequency) {
      case 'DAILY': return 'day(s)';
      case 'WEEKLY': return 'week(s)';
      case 'MONTHLY': return 'month(s)';
      case 'YEARLY': return 'year(s)';
      default: return 'interval(s)';
    }
  }, [frequency]);

  const showInterval = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency);
  const showDaysOfWeek = frequency === 'WEEKLY';
  const showDayOfMonth = ['MONTHLY', 'QUARTERLY'].includes(frequency);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function buildConfig(): RecurrenceConfig {
    const config: RecurrenceConfig = {
      frequency,
      interval,
      startDate: new Date(startDate).toISOString(),
    };
    if (showDaysOfWeek) config.daysOfWeek = daysOfWeek;
    if (showDayOfMonth) config.dayOfMonth = dayOfMonth;
    if (endCondition === 'after') config.maxOccurrences = maxOccurrences;
    if (endCondition === 'on_date' && endDate) config.endDate = new Date(endDate).toISOString();
    return config;
  }

  async function handleSave() {
    const config = buildConfig();
    if (hasSchedule) {
      await updateMutation.mutateAsync(config);
    } else {
      await createMutation.mutateAsync(config);
    }
    onClose();
  }

  async function handleDelete() {
    await deleteMutation.mutateAsync();
    onClose();
  }

  async function handlePause() {
    await pauseMutation.mutateAsync();
  }

  async function handleResume() {
    await resumeMutation.mutateAsync();
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-bg-primary border border-border-primary rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-accent-blue" />
            <h3 className="text-base font-semibold text-text-primary">
              {hasSchedule ? 'Edit Recurrence' : 'Make Task Recurring'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover transition-colors">
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Status banner for existing schedules */}
            {hasSchedule && (
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs',
                existing.status === 'ACTIVE' ? 'bg-cx-success/10 text-cx-success' :
                existing.status === 'PAUSED' ? 'bg-cx-warning/10 text-cx-warning' :
                'bg-[var(--cx-text-3)]/10 text-[var(--cx-text-2)]'
              )}>
                <span>Status: {existing.status} ({existing.occurrenceCount} occurrences)</span>
                <div className="flex gap-1">
                  {existing.status === 'ACTIVE' && (
                    <button onClick={handlePause} className="p-1 rounded hover:bg-bg-hover" title="Pause">
                      <Pause size={14} />
                    </button>
                  )}
                  {existing.status === 'PAUSED' && (
                    <button onClick={handleResume} className="p-1 rounded hover:bg-bg-hover" title="Resume">
                      <Play size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Frequency selector */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Frequency</label>
              <div className="grid grid-cols-3 gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFrequency(f.value)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      frequency === f.value
                        ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                        : 'border-border-secondary text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interval */}
            {showInterval && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  Every
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={interval}
                    onChange={(e) => setInterval_(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:border-accent-blue"
                  />
                  <span className="text-xs text-text-secondary">{intervalLabel}</span>
                </div>
              </div>
            )}

            {/* Day of week selector (for weekly) */}
            {showDaysOfWeek && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">On days</label>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      className={cn(
                        'w-9 h-9 text-xs rounded-lg border transition-colors',
                        daysOfWeek.includes(d.value)
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-border-secondary text-text-secondary hover:bg-bg-hover',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Day of month (for monthly/quarterly) */}
            {showDayOfMonth && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:border-accent-blue"
                />
              </div>
            )}

            {/* Start date */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:border-accent-blue"
              />
            </div>

            {/* End condition */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Ends</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    checked={endCondition === 'never'}
                    onChange={() => setEndCondition('never')}
                    className="accent-accent-blue"
                  />
                  Never
                </label>
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    checked={endCondition === 'after'}
                    onChange={() => setEndCondition('after')}
                    className="accent-accent-blue"
                  />
                  After
                  <input
                    type="number"
                    min={1}
                    value={maxOccurrences}
                    onChange={(e) => setMaxOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={endCondition !== 'after'}
                    className="w-16 px-2 py-1 text-xs bg-bg-secondary border border-border-secondary rounded text-text-primary disabled:opacity-40"
                  />
                  occurrences
                </label>
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="radio"
                    checked={endCondition === 'on_date'}
                    onChange={() => setEndCondition('on_date')}
                    className="accent-accent-blue"
                  />
                  On date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={endCondition !== 'on_date'}
                    className="px-2 py-1 text-xs bg-bg-secondary border border-border-secondary rounded text-text-primary disabled:opacity-40"
                  />
                </label>
              </div>
            </div>

            {/* Preview upcoming dates */}
            {hasSchedule && existing.upcomingDates && existing.upcomingDates.length > 0 && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Next occurrences</label>
                <div className="space-y-0.5">
                  {existing.upcomingDates.map((d: string, i: number) => (
                    <div key={i} className="text-xs text-text-primary pl-2">
                      {new Date(d).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-secondary">
          <div>
            {hasSchedule && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-accent-red hover:text-cx-danger transition-colors"
              >
                <Trash2 size={12} />
                Remove recurrence
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-border-secondary text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs px-4 py-1.5 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : hasSchedule ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
