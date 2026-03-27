import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Target,
  ListTodo,
  MessageCircle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useProfile, useProfileActivity, useProfileTasks, useProfileGoals } from '@/hooks/useProfiles';
import type { ProfileActivity, ProfileTask, ProfileGoal } from '@/hooks/useProfiles';

type Tab = 'tasks' | 'activity' | 'goals';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusColors: Record<string, string> = {
  TODO: 'bg-gray-500',
  IN_PROGRESS: 'bg-blue-500',
  REVIEW: 'bg-yellow-500',
  DONE: 'bg-green-500',
  BACKLOG: 'bg-gray-400',
};

const priorityLabels: Record<string, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  NONE: 'None',
};

interface ProfilePageProps {
  userId?: string;
  onBack?: () => void;
}

export function ProfilePage({ userId: propUserId, onBack }: ProfilePageProps) {
  const params = useParams<{ userId: string }>();
  const targetUserId = propUserId || params.userId;
  const currentUser = useAuthStore((s) => s.user);
  const setActiveModule = useUIStore((s) => s.setActiveModule);

  const { data: profile, isLoading } = useProfile(targetUserId);
  const { data: activity } = useProfileActivity(targetUserId);
  const { data: tasks } = useProfileTasks(targetUserId);
  const { data: goals } = useProfileGoals(targetUserId);

  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const isOwnProfile = currentUser?.id === targetUserId;

  const filteredTasks = useMemo(() => {
    let list = tasks ?? [];
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
    return list;
  }, [tasks, statusFilter, priorityFilter]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-text-secondary">
        User not found
      </div>
    );
  }

  const workspaceRole = profile.workspaceMembers?.[0]?.role ?? 'MEMBER';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Back button */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to People
          </button>
        )}

        {/* Header */}
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-accent-blue">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary truncate">{profile.displayName}</h1>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent-blue/20 text-accent-blue">
                {workspaceRole}
              </span>
            </div>
            <p className="text-text-secondary text-sm mt-1">{profile.email}</p>
            {profile.bio && <p className="text-text-secondary text-sm mt-2">{profile.bio}</p>}
            {profile.teamMemberships.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.teamMemberships.map((tm) => (
                  <span
                    key={tm.team.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium border border-border-primary text-text-secondary"
                    style={tm.team.color ? { borderColor: tm.team.color, color: tm.team.color } : undefined}
                  >
                    {tm.team.icon && <span className="mr-1">{tm.team.icon}</span>}
                    {tm.team.name}
                  </span>
                ))}
              </div>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setActiveModule('settings')}
                className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
            <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
              <ListTodo className="w-3.5 h-3.5" />
              Active Tasks
            </div>
            <div className="text-2xl font-bold text-text-primary">{profile.stats.activeTasks}</div>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
            <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed (30d)
            </div>
            <div className="text-2xl font-bold text-text-primary">{profile.stats.completedTasks}</div>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
            <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Time Tracked (30d)
            </div>
            <div className="text-2xl font-bold text-text-primary">{formatDuration(profile.stats.totalTimeTracked)}</div>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
            <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
              <Target className="w-3.5 h-3.5" />
              Goals
            </div>
            <div className="text-2xl font-bold text-text-primary">{profile.stats.goalsInProgress}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-primary">
          <div className="flex gap-6">
            {(['tasks', 'activity', 'goals'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'pb-3 text-sm font-medium transition-colors border-b-2 capitalize',
                  activeTab === tab
                    ? 'border-accent-blue text-accent-blue'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-bg-secondary border border-border-primary rounded px-3 py-1.5 text-sm text-text-primary"
              >
                <option value="">All Status</option>
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-bg-secondary border border-border-primary rounded px-3 py-1.5 text-sm text-text-primary"
              >
                <option value="">All Priority</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="space-y-2">
              {filteredTasks.length === 0 && (
                <div className="text-center text-text-secondary py-8 text-sm">No tasks found</div>
              )}
              {filteredTasks.map((task: ProfileTask) => (
                <div key={task.id} className="flex items-center gap-3 bg-bg-secondary border border-border-primary rounded-lg p-3">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[task.status] || 'bg-gray-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{task.title}</div>
                    {task.list && <div className="text-xs text-text-secondary">{task.list.name}</div>}
                  </div>
                  <span className="text-xs text-text-secondary">{priorityLabels[task.priority] || task.priority}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {(!activity || activity.length === 0) && (
              <div className="text-center text-text-secondary py-8 text-sm">No recent activity</div>
            )}
            {activity?.map((item: ProfileActivity, i: number) => (
              <div key={i} className="flex items-start gap-3 bg-bg-secondary border border-border-primary rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                  {item.type === 'comment' ? (
                    <MessageCircle className="w-4 h-4 text-accent-blue" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary">{item.description}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{formatTimeAgo(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-3">
            {(!goals || goals.length === 0) && (
              <div className="text-center text-text-secondary py-8 text-sm">No goals</div>
            )}
            {goals?.map((goal: ProfileGoal) => {
              const progress = goal.targets.length > 0
                ? Math.round(goal.targets.reduce((sum, t) => sum + (t.targetValue > 0 ? (t.currentValue / t.targetValue) * 100 : 0), 0) / goal.targets.length)
                : 0;
              return (
                <div key={goal.id} className="bg-bg-secondary border border-border-primary rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-medium text-text-primary">{goal.name}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      goal.status === 'ON_TRACK' ? 'bg-green-500/20 text-green-400' :
                      goal.status === 'AT_RISK' ? 'bg-yellow-500/20 text-yellow-400' :
                      goal.status === 'BEHIND' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>
                      {goal.status?.replace(/_/g, ' ') || 'N/A'}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-xs text-text-secondary mb-2">{goal.description}</p>
                  )}
                  <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-blue rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-secondary">{progress}% complete</span>
                    <div className="flex -space-x-1">
                      {goal.members.slice(0, 4).map((m) => (
                        <div
                          key={m.user.id}
                          className="w-5 h-5 rounded-full bg-accent-blue/20 border border-bg-secondary flex items-center justify-center"
                          title={m.user.displayName}
                        >
                          {m.user.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-[8px] font-bold text-accent-blue">{m.user.displayName.charAt(0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
