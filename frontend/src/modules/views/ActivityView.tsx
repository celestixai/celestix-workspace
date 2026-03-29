import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Activity,
  Filter,
  Calendar,
  ChevronDown,
  User,
  Loader2,
  ExternalLink,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface ActivityEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  user: { id: string; displayName: string; avatarUrl: string | null } | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface ActivityViewProps {
  tasks: any[];
  isLoading: boolean;
  listId?: string;
  spaceId?: string;
  locationType?: string;
  locationId?: string;
}

type ActivityFilter = 'all' | 'status_changed' | 'comment' | 'assigned' | 'created';
type DateRange = 'all' | 'today' | 'week' | 'month';

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getActionText(entry: ActivityEntry): string {
  switch (entry.action) {
    case 'status_changed':
      return `changed status to "${entry.newValue}" on`;
    case 'priority_changed':
      return `changed priority to "${entry.newValue}" on`;
    case 'assignee_added':
      return `assigned ${entry.newValue ?? 'someone'} to`;
    case 'assignee_removed':
      return `unassigned ${entry.oldValue ?? 'someone'} from`;
    case 'comment_added':
      return 'commented on';
    case 'created':
    case 'task_created':
      return 'created task';
    case 'due_date_changed':
      return `changed due date on`;
    case 'description_changed':
      return 'updated description of';
    case 'title_changed':
      return `renamed task to "${entry.newValue}" from`;
    default:
      return `${entry.action.replace(/_/g, ' ')} on`;
  }
}

function matchesFilter(entry: ActivityEntry, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'status_changed') return entry.action === 'status_changed';
  if (filter === 'comment') return entry.action === 'comment_added';
  if (filter === 'assigned') return entry.action === 'assignee_added' || entry.action === 'assignee_removed';
  if (filter === 'created') return entry.action === 'created' || entry.action === 'task_created';
  return true;
}

function matchesDateRange(dateStr: string, range: DateRange): boolean {
  if (range === 'all') return true;
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'today') return date >= startOfDay;
  if (range === 'week') {
    const weekAgo = new Date(startOfDay);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  }
  if (range === 'month') {
    const monthAgo = new Date(startOfDay);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return date >= monthAgo;
  }
  return true;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-cx-brand', 'bg-cx-success', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function ActivityView({
  tasks: _tasks,
  isLoading: _isLoadingTasks,
  listId,
  spaceId,
  locationType: propLocationType,
  locationId: propLocationId,
}: ActivityViewProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allActivities, setAllActivities] = useState<ActivityEntry[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const locationType = propLocationType || (listId ? 'LIST' : spaceId ? 'SPACE' : '');
  const locationId = propLocationId || listId || spaceId || '';

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity-feed', locationType, locationId, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({
        locationType,
        locationId,
        limit: '50',
      });
      if (cursor) params.set('cursor', cursor);
      const { data: resp } = await api.get(`/views/activity?${params}`);
      return resp.data as { activities: ActivityEntry[]; nextCursor: string | null; hasMore: boolean };
    },
    enabled: !!locationType && !!locationId,
  });

  // Merge paginated results
  const activities = useMemo(() => {
    if (!data) return allActivities;
    const existing = new Set(allActivities.map(a => a.id));
    const newOnes = data.activities.filter(a => !existing.has(a.id));
    return [...allActivities, ...newOnes];
  }, [data, allActivities]);

  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor) {
      setAllActivities(activities);
      setCursor(data.nextCursor);
    }
  }, [data, activities]);

  // Apply client-side filters
  const filtered = useMemo(() => {
    return activities.filter(a =>
      matchesFilter(a, activityFilter) && matchesDateRange(a.createdAt, dateRange)
    );
  }, [activities, activityFilter, dateRange]);

  const filterLabels: Record<ActivityFilter, string> = {
    all: 'All Activity',
    status_changed: 'Status Changes',
    comment: 'Comments',
    assigned: 'Assignments',
    created: 'Created',
  };

  const dateLabels: Record<DateRange, string> = {
    all: 'All Time',
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/50">
        <Activity size={16} className="text-text-tertiary" />
        <span className="text-sm font-medium text-text-secondary">Activity</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Activity type filter */}
          <div className="relative">
            <button
              onClick={() => { setShowFilterDropdown(p => !p); setShowDateDropdown(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors"
            >
              <Filter size={12} />
              {filterLabels[activityFilter]}
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showFilterDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-full mt-1 z-50 bg-bg-primary border border-border rounded-md shadow-lg py-1 min-w-[160px]"
                >
                  {(Object.keys(filterLabels) as ActivityFilter[]).map(key => (
                    <button
                      key={key}
                      onClick={() => { setActivityFilter(key); setShowFilterDropdown(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary transition-colors',
                        activityFilter === key && 'bg-bg-secondary font-medium',
                      )}
                    >
                      {filterLabels[key]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date range filter */}
          <div className="relative">
            <button
              onClick={() => { setShowDateDropdown(p => !p); setShowFilterDropdown(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors"
            >
              <Calendar size={12} />
              {dateLabels[dateRange]}
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showDateDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-full mt-1 z-50 bg-bg-primary border border-border rounded-md shadow-lg py-1 min-w-[140px]"
                >
                  {(Object.keys(dateLabels) as DateRange[]).map(key => (
                    <button
                      key={key}
                      onClick={() => { setDateRange(key); setShowDateDropdown(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary transition-colors',
                        dateRange === key && 'bg-bg-secondary font-medium',
                      )}
                    >
                      {dateLabels[key]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-tertiary">
            <Activity size={32} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs opacity-70 mt-1">Activity will appear here as tasks are updated</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filtered.map((entry, idx) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-bg-secondary/50 transition-colors',
                  idx < filtered.length - 1 && 'border-b border-border/50',
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0 mt-0.5',
                    avatarColor(entry.userId),
                  )}
                >
                  {entry.user?.avatarUrl ? (
                    <img
                      src={entry.user.avatarUrl}
                      alt={entry.user.displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(entry.user?.displayName ?? 'U')
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">
                    <span className="font-medium text-text-primary">
                      {entry.user?.displayName ?? 'Unknown'}
                    </span>{' '}
                    <span className="text-text-secondary">
                      {getActionText(entry)}
                    </span>{' '}
                    <button
                      onClick={() => console.log('Open task:', entry.taskId)}
                      className="font-medium text-brand-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      {entry.taskTitle}
                      <ExternalLink size={10} className="opacity-50" />
                    </button>
                  </p>
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-text-tertiary whitespace-nowrap shrink-0 mt-0.5">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
            ))}

            {/* Load more */}
            {data?.hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  className="px-4 py-1.5 text-xs font-medium rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors disabled:opacity-50"
                >
                  {isFetching ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
