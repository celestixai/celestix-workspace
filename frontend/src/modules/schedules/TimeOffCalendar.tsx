import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeOff, TimeOffType } from '@/hooks/useSchedules';

const TYPE_COLORS: Record<TimeOffType, string> = {
  VACATION: 'bg-blue-500/80',
  SICK: 'bg-red-500/80',
  PERSONAL: 'bg-green-500/80',
  HOLIDAY: 'bg-purple-500/80',
  OTHER: 'bg-gray-500/80',
};

const TYPE_LABELS: Record<TimeOffType, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  HOLIDAY: 'Holiday',
  OTHER: 'Other',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  timeOffList: TimeOff[];
  filterType?: TimeOffType | null;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}

export function TimeOffCalendar({ timeOffList, filterType }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const firstDayOfWeek = days[0].getDay();

  const filtered = useMemo(() => {
    if (!filterType) return timeOffList;
    return timeOffList.filter((t) => t.type === filterType);
  }, [timeOffList, filterType]);

  const getTimeOffForDay = (date: Date) => {
    return filtered.filter((t) =>
      isDateInRange(date, new Date(t.startDate), new Date(t.endDate)) && t.status === 'APPROVED'
    );
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const today = new Date();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-bg-tertiary rounded-lg text-text-secondary">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-text-primary">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={nextMonth} className="p-1 hover:bg-bg-tertiary rounded-lg text-text-secondary">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={cn('w-2.5 h-2.5 rounded-sm', TYPE_COLORS[key as TimeOffType])} />
            {label}
          </div>
        ))}
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-xs font-medium text-text-tertiary text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-bg-secondary min-h-[80px] p-1" />
        ))}

        {days.map((day) => {
          const dayTimeOff = getTimeOffForDay(day);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'bg-bg-secondary min-h-[80px] p-1',
                isToday && 'ring-1 ring-inset ring-accent'
              )}
            >
              <div
                className={cn(
                  'text-xs font-medium mb-1',
                  isToday ? 'text-accent' : 'text-text-secondary'
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTimeOff.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'text-[10px] text-white px-1 py-0.5 rounded truncate',
                      TYPE_COLORS[t.type]
                    )}
                    title={`${t.user.displayName} - ${TYPE_LABELS[t.type]}${t.isHalfDay ? ' (half day)' : ''}`}
                  >
                    {t.user.displayName.split(' ')[0]}
                    {t.isHalfDay ? ' (H)' : ''}
                  </div>
                ))}
                {dayTimeOff.length > 3 && (
                  <div className="text-[10px] text-text-tertiary px-1">
                    +{dayTimeOff.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
