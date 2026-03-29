import { useState, useMemo, useEffect, useRef, forwardRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatFullDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  AlignLeft,
  Check,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday as isTodayFn,
  parseISO,
  setHours,
  differenceInMinutes,
  startOfDay,
} from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  color: string;
  allDay?: boolean;
  attendees?: { id: string; name: string; avatarUrl?: string; status: string }[];
  calendarId: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

type ViewMode = 'day' | 'week' | 'month';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 22;
const VISIBLE_HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAY_NAMES_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EVENT_COLORS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Violet', value: '#8B5CF6' },
];

/* ------------------------------------------------------------------ */
/*  Calendar Page                                                      */
/* ------------------------------------------------------------------ */

export function CalendarPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());

  const gridRef = useRef<HTMLDivElement>(null);

  /* -- Derived dates -- */

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const rangeStart =
    viewMode === 'month'
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      : viewMode === 'day'
        ? startOfDay(currentDate)
        : weekStart;
  const rangeEnd =
    viewMode === 'month'
      ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      : viewMode === 'day'
        ? addDays(startOfDay(currentDate), 1)
        : weekEnd;

  /* -- Mini calendar -- */

  const miniCalDays = useMemo(() => {
    const mStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(mStart, i));
    return days;
  }, [currentDate]);

  /* -- Month view days -- */

  const monthViewWeeks = useMemo(() => {
    const mStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    let d = mStart;
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(d);
        d = addDays(d, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [currentDate]);

  /* -- Queries -- */

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['calendar-events', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const { data } = await api.get('/calendar/events', {
        params: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      });
      return (data.data as any[]).map((e: any) => ({
        ...e,
        start: e.startAt || e.start,
        end: e.endAt || e.end,
      })) as CalendarEvent[];
    },
  });

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery({
    queryKey: ['calendars'],
    queryFn: async () => {
      const { data } = await api.get('/calendar/calendars');
      const raw = data.data;
      // Backend returns { owned: [...], shared: [...] } — flatten into single array
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return [...(raw.owned || []), ...(raw.shared || [])].map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          visible: c.isVisible !== false,
        })) as CalendarInfo[];
      }
      return (raw as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        visible: c.isVisible !== false,
      })) as CalendarInfo[];
    },
  });

  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenCalendars.has(e.calendarId)),
    [events, hiddenCalendars]
  );

  /* -- Mutations -- */

  const createEvent = useMutation({
    mutationFn: async (payload: Partial<CalendarEvent>) => {
      const { start, end, ...rest } = payload;
      const { data } = await api.post('/calendar/events', {
        ...rest,
        startAt: start,
        endAt: end,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowCreateModal(false);
      setSelectedSlot(null);
      toast('Event created', 'success');
    },
    onError: () => toast('Failed to create event', 'error'),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/calendar/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setSelectedEvent(null);
      toast('Event deleted', 'success');
    },
    onError: () => toast('Failed to delete event', 'error'),
  });

  /* -- Navigation -- */

  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const goNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const toggleCalendar = (calId: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(calId)) next.delete(calId);
      else next.add(calId);
      return next;
    });
  };

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour });
    setShowCreateModal(true);
  };

  /* -- Scroll to current time on mount -- */

  useEffect(() => {
    if (gridRef.current && viewMode !== 'month') {
      const now = new Date();
      const h = now.getHours();
      const scrollTo = Math.max(0, (h - START_HOUR - 2) * HOUR_HEIGHT);
      gridRef.current.scrollTop = scrollTo;
    }
  }, [viewMode]);

  /* -- Header title -- */

  const headerTitle = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'week')
      return `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`;
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate, viewMode, weekDays]);

  /* -- Helpers -- */

  const getEventsForDay = (day: Date) =>
    visibleEvents.filter((e) => isSameDay(parseISO(e.start), day));

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Sidebar (220px) ===== */}
      <aside className="w-[220px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        {/* Create event button */}
        <div className="p-3 flex-shrink-0">
          <Button
            className="w-full"
            onClick={() => {
              setSelectedSlot(null);
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            New Event
          </Button>
        </div>

        {/* Mini calendar navigation */}
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text-primary">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                aria-label="Previous month"
                className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                aria-label="Next month"
                className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-text-tertiary py-1">
                {d}
              </div>
            ))}
            {miniCalDays.map((day, i) => {
              const inMonth = isSameMonth(day, currentDate);
              const selected = isSameDay(day, currentDate);
              const today = isTodayFn(day);
              return (
                <button
                  key={i}
                  onClick={() => setCurrentDate(day)}
                  className={cn(
                    'h-6 w-6 mx-auto rounded-full text-[11px] flex items-center justify-center transition-colors',
                    selected && 'bg-accent-blue text-white font-bold',
                    !selected && today && 'bg-accent-blue/20 text-accent-blue font-semibold',
                    !selected && !today && inMonth && 'text-text-primary hover:bg-bg-hover',
                    !inMonth && !selected && 'text-text-tertiary/50'
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar list with color toggles */}
        <div className="flex-1 overflow-y-auto px-3 border-t border-border-primary pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            My Calendars
          </p>

          {calendarsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : calendars.length > 0 ? (
            <div className="space-y-0.5">
              {calendars.map((cal) => {
                const hidden = hiddenCalendars.has(cal.id);
                return (
                  <button
                    key={cal.id}
                    onClick={() => toggleCalendar(cal.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                  >
                    <span
                      className={cn(
                        'h-3.5 w-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                        hidden && 'border-border-secondary bg-transparent'
                      )}
                      style={{
                        borderColor: hidden ? undefined : cal.color,
                        backgroundColor: hidden ? undefined : cal.color,
                      }}
                    >
                      {!hidden && <Check size={8} className="text-white" />}
                    </span>
                    <span className="truncate">{cal.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary px-2">No calendars</p>
          )}
        </div>
      </aside>

      {/* ===== Main Area ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-primary">
        {/* Header toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-border-primary flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goNext}
              aria-label="Next"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="text-base font-semibold text-text-primary flex-1">{headerTitle}</h2>

          {/* View switcher: Day / Week / Month */}
          <div className="flex items-center bg-bg-tertiary rounded-lg border border-border-primary p-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                  viewMode === mode
                    ? 'bg-bg-primary text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        {eventsLoading ? (
          <CalendarSkeleton viewMode={viewMode} />
        ) : !eventsLoading && events.length === 0 ? (
          <div className="flex-1 flex flex-col">
            <EmptyState
              icon={CalendarIcon}
              title="No events"
              description="Schedule your first event"
              actionLabel="+ New Event"
              onAction={() => setShowCreateModal(true)}
            />
          </div>
        ) : viewMode === 'month' ? (
          <MonthView
            weeks={monthViewWeeks}
            currentDate={currentDate}
            events={visibleEvents}
            onDayClick={(day) => {
              setCurrentDate(day);
              setViewMode('day');
            }}
            onEventClick={setSelectedEvent}
          />
        ) : (
          <WeekDayGrid
            ref={gridRef}
            days={viewMode === 'day' ? [currentDate] : weekDays}
            events={visibleEvents}
            getEventsForDay={getEventsForDay}
            onSlotClick={handleSlotClick}
            onEventClick={setSelectedEvent}
          />
        )}
      </main>

      {/* ===== Create Event Modal ===== */}
      <CreateEventModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedSlot(null);
        }}
        onCreate={(payload) => createEvent.mutate(payload)}
        loading={createEvent.isPending}
        initialDate={selectedSlot?.date}
        initialHour={selectedSlot?.hour}
        calendars={calendars}
      />

      {/* ===== Event Detail Modal ===== */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={() => deleteEvent.mutate(selectedEvent.id)}
          deleting={deleteEvent.isPending}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Week / Day Grid                                                    */
/* ------------------------------------------------------------------ */

interface WeekDayGridProps {
  days: Date[];
  events: CalendarEvent[];
  getEventsForDay: (day: Date) => CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WeekDayGrid = forwardRef<HTMLDivElement, WeekDayGridProps>(
  function WeekDayGrid({ days, events, getEventsForDay, onSlotClick, onEventClick }, ref) {
    /* -- Current time indicator position -- */
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const timeLineTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const showTimeLine = now.getHours() >= START_HOUR && now.getHours() <= END_HOUR;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day column headers */}
        <div className="flex border-b border-border-primary flex-shrink-0">
          <div className="w-16 flex-shrink-0" />
          {days.map((day, i) => {
            const today = isTodayFn(day);
            return (
              <div
                key={i}
                className={cn('flex-1 text-center py-2', i > 0 && 'border-l border-border-primary')}
              >
                <div className="text-[11px] text-text-tertiary uppercase font-medium">
                  {format(day, 'EEE')}
                </div>
                <div
                  className={cn(
                    'text-lg font-semibold mx-auto w-9 h-9 flex items-center justify-center rounded-full',
                    today ? 'bg-accent-blue text-white' : 'text-text-primary'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={ref} className="flex-1 overflow-y-auto">
          <div
            className="flex relative"
            style={{ height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT }}
          >
            {/* Time gutter (hours 7AM-10PM) */}
            <div className="w-16 flex-shrink-0">
              {VISIBLE_HOURS.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-3 text-[11px] text-text-tertiary">
                    {h === 0
                      ? '12 AM'
                      : h < 12
                        ? `${h} AM`
                        : h === 12
                          ? '12 PM'
                          : `${h - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, dayIdx) => {
              const dayEvents = getEventsForDay(day);
              const today = isTodayFn(day);

              return (
                <div
                  key={dayIdx}
                  className={cn('flex-1 relative', dayIdx > 0 && 'border-l border-border-primary')}
                >
                  {/* Click-to-create hour slots */}
                  {VISIBLE_HOURS.map((h) => (
                    <div
                      key={h}
                      onClick={() => onSlotClick(day, h)}
                      className="border-b border-border-primary hover:bg-bg-hover/50 cursor-pointer transition-colors"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Event blocks positioned by time */}
                  {dayEvents.map((event) => {
                    const start = parseISO(event.start);
                    const end = parseISO(event.end);
                    const startMin = start.getHours() * 60 + start.getMinutes();
                    const duration = Math.max(differenceInMinutes(end, start), 30);
                    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = (duration / 60) * HOUR_HEIGHT;

                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="absolute left-1 right-1 rounded-md px-2 py-1 text-left overflow-hidden hover:opacity-90 transition-opacity cursor-pointer z-[5]"
                        style={{
                          top: Math.max(top, 0),
                          height: Math.max(height, 24),
                          backgroundColor: event.color + '22',
                          borderLeft: `3px solid ${event.color}`,
                        }}
                      >
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: event.color }}
                        >
                          {event.title}
                        </p>
                        {height > 30 && (
                          <p className="text-[10px] text-text-tertiary truncate">
                            {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                          </p>
                        )}
                        {height > 50 && event.location && (
                          <p className="text-[10px] text-text-tertiary truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={8} />
                            {event.location}
                          </p>
                        )}
                      </button>
                    );
                  })}

                  {/* Current time indicator line */}
                  {today && showTimeLine && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: timeLineTop }}
                    >
                      <div className="flex items-center">
                        <div className="h-3 w-3 rounded-full bg-accent-red -ml-1.5 flex-shrink-0" />
                        <div className="flex-1 h-0.5 bg-accent-red" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Month View                                                         */
/* ------------------------------------------------------------------ */

function MonthView({
  weeks,
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  weeks: Date[][];
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start), day));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-primary">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center py-2 text-xs font-medium text-text-tertiary uppercase border-l border-border-primary first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-border-primary last:border-b-0"
          >
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, currentDate);
              const today = isTodayFn(day);
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'border-l border-border-primary first:border-l-0 p-1 cursor-pointer hover:bg-bg-hover/50 transition-colors min-h-[80px] overflow-hidden',
                    !inMonth && 'bg-bg-tertiary/20'
                  )}
                >
                  <div
                    className={cn(
                      'text-xs font-medium mb-0.5 h-6 w-6 flex items-center justify-center rounded-full mx-auto',
                      today && 'bg-accent-blue text-white',
                      !today && inMonth && 'text-text-primary',
                      !today && !inMonth && 'text-text-tertiary'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate block hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: ev.color + '22',
                          color: ev.color,
                        }}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-text-tertiary text-center">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Event Modal                                                 */
/* ------------------------------------------------------------------ */

function CreateEventModal({
  open,
  onClose,
  onCreate,
  loading,
  initialDate,
  initialHour,
  calendars,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<CalendarEvent>) => void;
  loading: boolean;
  initialDate?: Date;
  initialHour?: number;
  calendars: CalendarInfo[];
}) {
  const defaultDate = initialDate || new Date();
  const defaultHour = initialHour ?? 9;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(`${String(defaultHour).padStart(2, '0')}:00`);
  const [endTime, setEndTime] = useState(
    `${String(Math.min(defaultHour + 1, 23)).padStart(2, '0')}:00`
  );
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(EVENT_COLORS[0].value);
  const [calendarId, setCalendarId] = useState(calendars[0]?.id || '');

  /* Reset form when opening */
  useEffect(() => {
    if (open) {
      const d = initialDate || new Date();
      const h = initialHour ?? 9;
      setTitle('');
      setDate(format(d, 'yyyy-MM-dd'));
      setStartTime(`${String(h).padStart(2, '0')}:00`);
      setEndTime(`${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`);
      setLocation('');
      setDescription('');
      setColor(EVENT_COLORS[0].value);
      setCalendarId(calendars[0]?.id || '');
    }
  }, [open, initialDate, initialHour, calendars]);

  const handleCreate = () => {
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    const startDT = new Date(`${date}T${startTime}:00`);
    const endDT = new Date(`${date}T${endTime}:00`);
    if (endDT <= startDT) {
      toast('End time must be after start time', 'error');
      return;
    }
    onCreate({
      title: title.trim(),
      start: startDT.toISOString(),
      end: endDT.toISOString(),
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      color,
      calendarId: calendarId || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Event" size="md">
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <Input
          label="Location"
          placeholder="Add location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          icon={<MapPin size={14} />}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>

        {/* Color picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Color</label>
          <div className="flex items-center gap-2">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-transform',
                  color === c.value && 'ring-2 ring-offset-2 ring-offset-bg-secondary scale-110'
                )}
                style={{ backgroundColor: c.value } as React.CSSProperties}
                title={c.label}
              >
                {color === c.value && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar selector */}
        {calendars.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Calendar</label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue appearance-none"
            >
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading} disabled={!title.trim()}>
            Create Event
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Event Detail Modal                                                 */
/* ------------------------------------------------------------------ */

function EventDetailModal({
  event,
  onClose,
  onDelete,
  deleting,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);

  return (
    <Modal open onClose={onClose} title={event.title} size="sm">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-4 rounded flex-shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <div>
            <p className="text-sm text-text-primary font-medium">
              {format(start, 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-xs text-text-secondary">
              {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
            </p>
          </div>
        </div>

        {event.location && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin size={14} className="text-text-tertiary flex-shrink-0" />
            {event.location}
          </div>
        )}

        {event.description && (
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <AlignLeft size={14} className="text-text-tertiary mt-0.5 flex-shrink-0" />
            <p className="whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-2">Attendees</p>
            <div className="space-y-2">
              {event.attendees.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Avatar src={a.avatarUrl} name={a.name} size="xs" />
                  <span className="text-sm text-text-primary">{a.name}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      a.status === 'accepted' && 'bg-accent-emerald/10 text-accent-emerald',
                      a.status === 'declined' && 'bg-accent-red/10 text-accent-red',
                      a.status === 'pending' && 'bg-accent-amber/10 text-accent-amber'
                    )}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-border-primary">
          <Button variant="ghost" onClick={onClose} size="sm">
            Close
          </Button>
          <Button variant="danger" onClick={onDelete} loading={deleting} size="sm">
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function CalendarSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'month') {
    return (
      <div className="flex-1 p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-5 w-5 rounded-full mx-auto" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="flex gap-2">
        <div className="w-16 space-y-[44px] pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-10 ml-auto" />
          ))}
        </div>
        {Array.from({ length: viewMode === 'day' ? 1 : 7 }).map((_, i) => (
          <div key={i} className="flex-1 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
