import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUIStore } from '@/stores/ui.store';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Mail,
  FileText,
  MessageSquare,
  Clock,
  ChevronRight,
  Video,
  Inbox,
  Sparkles,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  color?: string;
}

interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  dueDate?: string;
}

interface DashboardEmail {
  id: string;
  subject: string;
  fromName?: string;
  fromAddress: string;
  receivedAt: string;
}

interface DashboardNote {
  id: string;
  title: string;
  preview?: string;
  updatedAt: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt: string;
}

interface DashboardData {
  upcomingEvents: DashboardEvent[];
  myTasks: DashboardTask[];
  unreadEmails: { count: number; recent: DashboardEmail[] };
  recentNotes: DashboardNote[];
  recentActivity: ActivityItem[];
}

/* ------------------------------------------------------------------ */
/*  Quick Action Config                                                */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { icon: Mail, label: 'New Email', module: 'email' as const },
  { icon: CheckSquare, label: 'New Task', module: 'tasks' as const },
  { icon: Calendar, label: 'New Event', module: 'calendar' as const },
  { icon: FileText, label: 'New Note', module: 'notes' as const },
  { icon: Video, label: 'Start Meeting', module: 'meetings' as const },
];

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                     */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const setActiveModule = useUIStore((s) => s.setActiveModule);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data.data as DashboardData;
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex-1 overflow-auto p-6 bg-bg-primary">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Welcome back</h1>
          <p className="text-text-tertiary text-sm">Here's what's happening today</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => setActiveModule(action.module)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border-secondary text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <action.icon size={16} />
              {action.label}
            </button>
          ))}
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Upcoming Events */}
          <WidgetCard
            title="Upcoming Events"
            icon={Calendar}
            onViewAll={() => setActiveModule('calendar')}
          >
            {data?.upcomingEvents?.length ? (
              <div className="space-y-1">
                {data.upcomingEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color || 'var(--accent-blue)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{event.title}</div>
                      <div className="text-xs text-text-tertiary">
                        {new Date(event.startAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <WidgetEmpty text="No upcoming events" />
            )}
          </WidgetCard>

          {/* My Tasks */}
          <WidgetCard
            title="My Tasks"
            icon={CheckSquare}
            onViewAll={() => setActiveModule('tasks')}
          >
            {data?.myTasks?.length ? (
              <div className="space-y-1">
                {data.myTasks.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        task.priority === 'URGENT' && 'bg-accent-red',
                        task.priority === 'HIGH' && 'bg-accent-amber',
                        task.priority === 'MEDIUM' && 'bg-accent-yellow',
                        (task.priority === 'LOW' || task.priority === 'NONE') && 'bg-text-tertiary/40'
                      )}
                    />
                    <span className="text-sm text-text-primary truncate flex-1">{task.title}</span>
                    {task.dueDate && (
                      <span className="text-xs text-text-tertiary flex-shrink-0">
                        {new Date(task.dueDate).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <WidgetEmpty text="All caught up!" />
            )}
          </WidgetCard>

          {/* Unread Emails */}
          <WidgetCard
            title="Unread Emails"
            icon={Mail}
            badge={data?.unreadEmails?.count}
            onViewAll={() => setActiveModule('email')}
          >
            {data?.unreadEmails?.recent?.length ? (
              <div className="space-y-1">
                {data.unreadEmails.recent.slice(0, 5).map((email) => (
                  <div
                    key={email.id}
                    className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div className="text-sm text-text-primary truncate">{email.subject}</div>
                    <div className="text-xs text-text-tertiary truncate">
                      {email.fromName || email.fromAddress}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <WidgetEmpty text="Inbox zero!" icon={<Inbox size={24} />} />
            )}
          </WidgetCard>

          {/* Recent Notes */}
          <WidgetCard
            title="Recent Notes"
            icon={FileText}
            onViewAll={() => setActiveModule('notes')}
          >
            {data?.recentNotes?.length ? (
              <div className="space-y-1">
                {data.recentNotes.slice(0, 5).map((note) => (
                  <div
                    key={note.id}
                    className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div className="text-sm text-text-primary truncate">{note.title}</div>
                    <div className="text-xs text-text-tertiary">
                      {formatRelativeTime(note.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <WidgetEmpty text="No notes yet" />
            )}
          </WidgetCard>

          {/* Recent Activity */}
          <WidgetCard
            title="Recent Activity"
            icon={Clock}
            className="md:col-span-2"
          >
            {data?.recentActivity?.length ? (
              <div className="space-y-1">
                {data.recentActivity.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-blue/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ActivityIcon type={item.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">{item.title}</div>
                      {item.body && (
                        <div className="text-xs text-text-tertiary truncate mt-0.5">
                          {item.body}
                        </div>
                      )}
                      <div className="text-xs text-text-tertiary/60 mt-1">
                        {formatRelativeTime(item.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <WidgetEmpty text="No recent activity" />
            )}
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget Card                                                        */
/* ------------------------------------------------------------------ */

function WidgetCard({
  title,
  icon: Icon,
  badge,
  children,
  onViewAll,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  children: React.ReactNode;
  onViewAll?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-bg-secondary border border-border-primary rounded-xl p-4',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-text-tertiary" />
          <span className="text-sm font-medium text-text-secondary">{title}</span>
          {badge != null && badge > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-accent-blue text-white rounded-full min-w-[18px] text-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-accent-blue hover:brightness-125 flex items-center gap-0.5 transition-all"
          >
            View all <ChevronRight size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Icon                                                      */
/* ------------------------------------------------------------------ */

function ActivityIcon({ type }: { type: string }) {
  const iconClass = 'text-accent-blue';
  switch (type) {
    case 'task':
      return <CheckSquare size={14} className={iconClass} />;
    case 'calendar':
      return <Calendar size={14} className={iconClass} />;
    case 'email':
      return <Mail size={14} className={iconClass} />;
    case 'note':
      return <FileText size={14} className={iconClass} />;
    case 'meeting':
      return <Video size={14} className={iconClass} />;
    default:
      return <MessageSquare size={14} className={iconClass} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Widget Empty State                                                 */
/* ------------------------------------------------------------------ */

function WidgetEmpty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-8 text-text-tertiary text-sm flex flex-col items-center gap-2">
      {icon}
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="flex-1 p-6 bg-bg-primary">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ))}
          <div className="md:col-span-2 bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
