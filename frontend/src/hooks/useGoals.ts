import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type GoalTargetType = 'NUMBER' | 'CURRENCY' | 'TRUE_FALSE' | 'TASK_COMPLETION';
export type GoalPrivacy = 'PUBLIC' | 'PRIVATE';
export type GoalMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface GoalTarget {
  id: string;
  goalId: string;
  name: string;
  type: GoalTargetType;
  targetValue: number;
  currentValue: number;
  unit?: string;
  listId?: string;
  listName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMember {
  id: string;
  goalId: string;
  userId: string;
  role: GoalMemberRole;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface GoalFolder {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  workspaceId: string;
  folderId?: string;
  name: string;
  description?: string;
  color: string;
  dueDate?: string;
  privacy: GoalPrivacy;
  progress: number;
  ownerId: string;
  owner: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  targets: GoalTarget[];
  members: GoalMember[];
  folder?: GoalFolder;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalFolderPayload {
  name: string;
  color?: string;
}

export interface CreateGoalPayload {
  workspaceId: string;
  folderId?: string;
  name: string;
  description?: string;
  color?: string;
  dueDate?: string;
  privacy?: GoalPrivacy;
  targets?: Array<{
    name: string;
    type: GoalTargetType;
    targetValue: number;
    unit?: string;
    listId?: string;
  }>;
}

export interface UpdateGoalPayload {
  name?: string;
  description?: string;
  color?: string;
  dueDate?: string | null;
  privacy?: GoalPrivacy;
  folderId?: string | null;
}

export interface CreateTargetPayload {
  name: string;
  type: GoalTargetType;
  targetValue: number;
  unit?: string;
  listId?: string;
}

export interface UpdateTargetPayload {
  name?: string;
  targetValue?: number;
  unit?: string;
}

export interface UpdateTargetProgressPayload {
  currentValue: number;
}

export interface AddGoalMemberPayload {
  userId: string;
  role?: GoalMemberRole;
}

// ==========================================
// Query hooks
// ==========================================

export function useGoalFolders(workspaceId?: string) {
  return useQuery<GoalFolder[]>({
    queryKey: ['goal-folders', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/goals/workspace/${workspaceId}/folders`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useGoals(workspaceId?: string, folderId?: string) {
  return useQuery<Goal[]>({
    queryKey: ['goals', workspaceId, folderId],
    queryFn: async () => {
      const params = folderId ? `?folderId=${folderId}` : '';
      const { data } = await api.get(`/goals/workspace/${workspaceId}${params}`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useGoal(goalId?: string) {
  return useQuery<Goal>({
    queryKey: ['goal', goalId],
    queryFn: async () => {
      const { data } = await api.get(`/goals/${goalId}`);
      return data.data;
    },
    enabled: !!goalId,
  });
}

// ==========================================
// Mutation hooks
// ==========================================

export function useCreateGoalFolder(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateGoalFolderPayload) => {
      const { data } = await api.post(`/goals/workspace/${workspaceId}/folders`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-folders', workspaceId] });
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateGoalPayload) => {
      const { data } = await api.post('/goals', payload);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['goals', variables.workspaceId] });
    },
  });
}

export function useUpdateGoal(goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateGoalPayload) => {
      const { data } = await api.patch(`/goals/${goalId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteGoal(goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/goals/${goalId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useAddTarget(goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTargetPayload) => {
      const { data } = await api.post(`/goals/${goalId}/targets`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateTarget(targetId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateTargetPayload) => {
      const { data } = await api.patch(`/goals/targets/${targetId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateTargetProgress(targetId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateTargetProgressPayload) => {
      const { data } = await api.post(`/goals/targets/${targetId}/progress`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useAddGoalMember(goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddGoalMemberPayload) => {
      const { data } = await api.post(`/goals/${goalId}/members`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
    },
  });
}

export function useRemoveGoalMember(goalId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/goals/${goalId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
    },
  });
}
