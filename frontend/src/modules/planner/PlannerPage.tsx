import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReminders } from '@/hooks/useReminders';
import type { Reminder } from '@/hooks/useReminders';
import { PlannerSidebar } from './PlannerSidebar';

type ViewMode = 'day' | 'week';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM - 10 PM

function formatHour(hour: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  start.setDate(start.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getHourFromISO(iso: string): number {
  return new Date(iso).getHours();
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

interface TimelineBlockProps {
  item: Reminder;
  style: React.CSSProperties;
}

function TimelineBlock({ item, style }: TimelineBlockProps) {
  const isOverdue = !item.isCompleted && new Date(item.dueAt) <= new Date();
  return (
    <div
      className={cn(
        'absolute left-14 right-2 rounded-md px-2 py-1 text-[11px] font-medium truncate border-l-2 cursor-pointer transition-colors',
        isOverdue
          ? 'bg-accent-red/10 text-accent-red border-accent-red'
          : item.isCompleted
            ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald'
            : 'bg-accent-blue/10 text-accent-blue border-accent-blue',
      )}
      style={style}
      title={`${item.title} — ${new Date(item.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
    >
      <span className="flex items-center gap-1">
        <CalendarDays size={10} className="flex-shrink-0" />
        {item.title}
      </span>
    </div>
  );
}

// Day view timeline
function DayTimeline({ date, reminders }: { date: Date; reminders: Reminder[] }) {
  const dayReminders = useMemo(
    () => reminders.filter((r) => isSameDay(new Date(r.dueAt), date)),
    [reminders, date],
  );

  return (
    <div className="relative">
      {HOURS.map((hour) => (
        <div key={hour} className="flex h-14 border-b border-border-primary/50">
          <div className="w-14 flex-shrink-0 text-[10px] text-text-tertiary text-right pr-2 -mt-1.5">
            {formatHour(hour)}
          </div>
          <div className="flex-1 border-l border-border-primary/50" />
        </div>
      ))}
      {/* Render reminder blocks */}
      {dayReminders.map((r) => {
        const hour = getHourFromISO(r.dueAt);
        const minutes = new Date(r.dueAt).getMinutes();
        const topOffset = (hour - 6) * 56 + (minutes / 60) * 56; // 56px = h-14
        if (hour < 6 || hour > 22) return null;
        return (
          <TimelineBlock
            key={r.id}
            item={r}
            style={{ top: `${topOffset}px`, height: '28px' }}
          />
        );
      })}
      {/* Current time indicator */}
      {isSameDay(date, new Date()) && (() => {
        const now = new Date();
        const nowHour = now.getHours();
        const nowMin = now.getMinutes();
        if (nowHour < 6 || nowHour > 22) return null;
        const top = (nowHour - 6) * 56 + (nowMin / 60) * 56;
        return (
          <div className="absolute left-14 right-0 flex items-center" style={{ top: `${top}px` }}>
            <div className="w-2 h-2 rounded-full bg-accent-red -ml-1" />
            <div className="flex-1 h-px bg-accent-red" />
          </div>
        );
      })()}
    </div>
  );
}

// Week view
function WeekTimeline({ weekDays, reminders }: { weekDays: Date[]; reminders: Reminder[] }) {
  const today = new Date();

  return (
    <div className="flex flex-1 min-h-0">
      {weekDays.map((day) => {
        const dayReminders = reminders.filter((r) => isSameDay(new Date(r.dueAt), day));
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} className="flex-1 border-r border-border-primary/50 last:border-r-0 min-w-0">
            <div className={cn(
              'text-center py-2 border-b border-border-primary text-xs font-medium sticky top-0 bg-bg-primary z-10',
              isToday ? 'text-accent-blue' : 'text-text-secondary',
            )}>
              {formatShortDay(day)}
              {isToday && <div className="w-1.5 h-1.5 rounded-full bg-accent-blue mx-auto mt-0.5" />}
            </div>
            <div className="p-1 space-y-1">
              {dayReminders.map((r) => {
                const isOverdue = !r.isCompleted && new Date(r.dueAt) <= new Date();
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'rounded px-1.5 py-1 text-[10px] font-medium truncate border-l-2',
                      isOverdue
                        ? 'bg-accent-red/10 text-accent-red border-accent-red'
                        : r.isCompleted
                          ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald'
                          : 'bg-accent-blue/10 text-accent-blue border-accent-blue',
                    )}
                    title={r.title}
                  >
                    <div className="truncate">{r.title}</div>
                    <div className="text-[9px] opacity-70">
                      {new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlannerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: reminders } = useReminders('all');

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const navigatePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (viewMode === 'day' ? 1 : 7));
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (viewMode === 'day' ? 1 : 7));
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex h-full bg-bg-primary">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-sm font-semibold text-text-primary min-w-[200px] text-center">
              {viewMode === 'day'
                ? formatDateHeader(currentDate)
                : `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </h2>
            <button
              onClick={navigateNext}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-primary transition-colors ml-2"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'day'
                  ? 'bg-bg-primary text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-bg-primary text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Week
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'day' ? (
            <DayTimeline date={currentDate} reminders={reminders ?? []} />
          ) : (
            <WeekTimeline weekDays={weekDays} reminders={reminders ?? []} />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block">
        <PlannerSidebar />
      </div>
    </div>
  );
}
