import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface ProfileStats {
  activeTasks: number;
  completedTasks: number;
  totalTimeTracked: number;
  goalsInProgress: number;
}

export interface ProfileTeam {
  team: {
    id: string;
    name: string;
    color?: string;
    icon?: string;
  };
}

export interface Profile {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  timezone: string;
  status: string;
  customStatus?: string;
  customStatusEmoji?: string;
  lastSeenAt?: string;
  createdAt: string;
  teamMemberships: ProfileTeam[];
  workspaceMembers: Array<{ role: string; workspace: { id: string; name: string } }>;
  stats: ProfileStats;
}

export interface ProfileActivity {
  type: string;
  description: string;
  taskId?: string;
  taskTitle?: string;
  timestamp: string;
  user?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
}

export interface ProfileTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  assignees: Array<{
    user: { id: string; displayName: string; avatarUrl?: string };
  }>;
  list?: { id: string; name: string };
}

export interface ProfileGoal {
  id: string;
  name: string;
  description?: string;
  color?: string;
  status: string;
  progress: number;
  targets: Array<{
    id: string;
    name: string;
    currentValue: number;
    targetValue: number;
    unit?: string;
  }>;
  members: Array<{
    user: { id: string; displayName: string; avatarUrl?: string };
  }>;
  _count: { targets: number; members: number };
}

// ==========================================
// Hooks
// ==========================================

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profiles', userId],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${userId}`);
      return data.data as Profile;
    },
    enabled: !!userId,
  });
}

export function useProfileActivity(userId?: string) {
  return useQuery({
    queryKey: ['profiles', userId, 'activity'],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${userId}/activity`);
      return data.data as ProfileActivity[];
    },
    enabled: !!userId,
  });
}

export function useProfileTasks(userId?: string, filters?: { status?: string; priority?: string }) {
  return useQuery({
    queryKey: ['profiles', userId, 'tasks', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.priority) params.set('priority', filters.priority);
      const { data } = await api.get(`/profiles/${userId}/tasks?${params.toString()}`);
      return data.data as ProfileTask[];
    },
    enabled: !!userId,
  });
}

export function useProfileGoals(userId?: string) {
  return useQuery({
    queryKey: ['profiles', userId, 'goals'],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${userId}/goals`);
      return data.data as ProfileGoal[];
    },
    enabled: !!userId,
  });
}
