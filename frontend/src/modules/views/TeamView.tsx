import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Users,
  ChevronDown,
  ChevronUp,
  User,
  CheckCircle2,
  Circle,
  ArrowUpDown,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  statusName?: string;
  priority: string;
  assignees?: Array<{
    id?: string;
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
    user?: { id: string; displayName: string; avatarUrl?: string };
  }>;
  dueDate?: string;
  createdAt?: string;
}

interface TeamMember {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  tasks: Task[];
  activeTasks: number;
  completedThisWeek: number;
  statusBreakdown: Record<string, number>;
}

interface TeamViewProps {
  tasks: any[];
  isLoading: boolean;
  spaceId?: string;
}

type SortBy = 'name' | 'taskCount' | 'active';

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-cx-brand', 'bg-cx-success', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-[var(--cx-text-2)]',
  'In Progress': 'bg-cx-brand',
  'In Review': 'bg-cx-warning',
  'Done': 'bg-cx-success',
  'Blocked': 'bg-cx-danger',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-[var(--cx-text-2)]';
}

function isCompletedStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return lower === 'done' || lower === 'complete' || lower === 'completed' || lower === 'closed';
}

function isWithinThisWeek(dateStr?: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function TeamView({ tasks, isLoading, spaceId: _spaceId }: TeamViewProps) {
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Build team members from tasks
  const { members, unassignedCount } = useMemo(() => {
    const memberMap = new Map<string, TeamMember>();
    let unassigned = 0;

    for (const task of tasks) {
      const assignees = task.assignees ?? [];
      if (assignees.length === 0) {
        unassigned++;
        continue;
      }

      for (const assignee of assignees) {
        const userId = assignee.user?.id ?? assignee.userId ?? assignee.id;
        const displayName = assignee.user?.displayName ?? assignee.displayName ?? 'Unknown';
        const avatarUrl = assignee.user?.avatarUrl ?? assignee.avatarUrl;

        if (!userId) continue;

        if (!memberMap.has(userId)) {
          memberMap.set(userId, {
            id: userId,
            displayName,
            avatarUrl,
            tasks: [],
            activeTasks: 0,
            completedThisWeek: 0,
            statusBreakdown: {},
          });
        }

        const member = memberMap.get(userId)!;
        member.tasks.push(task);

        const statusName = task.statusName ?? task.status ?? 'Unknown';
        member.statusBreakdown[statusName] = (member.statusBreakdown[statusName] ?? 0) + 1;

        if (isCompletedStatus(statusName)) {
          if (isWithinThisWeek(task.updatedAt ?? task.createdAt)) {
            member.completedThisWeek++;
          }
        } else {
          member.activeTasks++;
        }
      }
    }

    return { members: Array.from(memberMap.values()), unassignedCount: unassigned };
  }, [tasks]);

  // Sort members
  const sorted = useMemo(() => {
    const copy = [...members];
    switch (sortBy) {
      case 'name':
        copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'taskCount':
        copy.sort((a, b) => b.tasks.length - a.tasks.length);
        break;
      case 'active':
        copy.sort((a, b) => b.activeTasks - a.activeTasks);
        break;
    }
    return copy;
  }, [members, sortBy]);

  const sortLabels: Record<SortBy, string> = {
    name: 'Name',
    taskCount: 'Task Count',
    active: 'Most Active',
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (members.length === 0 && unassignedCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
        <Users size={32} className="mb-2 opacity-30" />
        <p className="text-sm font-medium">No team members</p>
        <p className="text-xs opacity-70 mt-1">Assign tasks to team members to see them here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/50">
        <Users size={16} className="text-text-tertiary" />
        <span className="text-sm font-medium text-text-secondary">
          Team ({members.length} member{members.length !== 1 ? 's' : ''})
        </span>

        <div className="ml-auto relative">
          <button
            onClick={() => setShowSortDropdown(p => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors"
          >
            <ArrowUpDown size={12} />
            Sort: {sortLabels[sortBy]}
            <ChevronDown size={12} />
          </button>
          <AnimatePresence>
            {showSortDropdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ transformOrigin: 'top right' }}
                className="absolute right-0 top-full mt-1 z-50 bg-bg-primary border border-border rounded-md shadow-lg py-1 min-w-[140px]"
              >
                {(Object.keys(sortLabels) as SortBy[]).map(key => (
                  <button
                    key={key}
                    onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary transition-colors',
                      sortBy === key && 'bg-bg-secondary font-medium',
                    )}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(member => {
            const isExpanded = expandedMember === member.id;
            const totalTasks = member.tasks.length;
            const statusEntries = Object.entries(member.statusBreakdown);

            return (
              <div
                key={member.id}
                className="border border-border rounded-lg bg-bg-primary hover:border-border-hover transition-colors"
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-medium mb-2',
                        avatarColor(member.id),
                      )}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(member.displayName)
                      )}
                    </div>

                    {/* Name */}
                    <p className="text-sm font-semibold text-text-primary truncate max-w-full">
                      {member.displayName}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Circle size={10} className="text-cx-brand" />
                        {member.activeTasks} active
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-cx-success" />
                        {member.completedThisWeek} done this week
                      </span>
                    </div>

                    {/* Status breakdown bar */}
                    {totalTasks > 0 && (
                      <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-3 bg-bg-tertiary">
                        {statusEntries.map(([status, count]) => (
                          <div
                            key={status}
                            className={cn('h-full', getStatusColor(status))}
                            style={{ width: `${(count / totalTasks) * 100}%` }}
                            title={`${status}: ${count}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Expand indicator */}
                    <div className="mt-2">
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-text-tertiary" />
                      ) : (
                        <ChevronDown size={14} className="text-text-tertiary" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded task list */}
                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 max-h-60 overflow-y-auto">
                    {member.tasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => console.log('Open task:', task.id)}
                        className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-bg-secondary/50 cursor-pointer text-xs"
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            getStatusColor(task.statusName ?? task.status ?? ''),
                          )}
                        />
                        <span className="truncate text-text-primary">{task.title}</span>
                        <span className="ml-auto text-[10px] text-text-tertiary shrink-0">
                          {task.statusName ?? task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned card */}
          {unassignedCount > 0 && (
            <div className="border border-border border-dashed rounded-lg bg-bg-primary p-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-bg-tertiary text-text-tertiary mb-2">
                  <User size={20} />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Unassigned</p>
                <p className="text-[11px] text-text-tertiary mt-1">
                  {unassignedCount} task{unassignedCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
