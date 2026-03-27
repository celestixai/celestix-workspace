import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface WorkspaceTag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  description?: string | null;
  createdAt: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
  _count: { tasks: number };
}

export interface TaskTagInfo {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}

// ==========================================
// Hooks
// ==========================================

export function useTags(workspaceId: string | undefined) {
  return useQuery<WorkspaceTag[]>({
    queryKey: ['tags', 'workspace', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/tags/workspace/${workspaceId}`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useTaskTags(taskId: string | undefined) {
  return useQuery<TaskTagInfo[]>({
    queryKey: ['tags', 'task', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tags/task/${taskId}/tags`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateTag(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string; description?: string }) => {
      const { data } = await api.post(`/tags/workspace/${workspaceId}`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags', 'workspace', workspaceId] });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tagId, ...input }: { tagId: string; name?: string; color?: string; description?: string }) => {
      const { data } = await api.patch(`/tags/${tagId}`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.delete(`/tags/${tagId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useAddTagsToTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const { data } = await api.post(`/tags/task/${taskId}/tags`, { tagIds });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags', 'task', taskId] });
    },
  });
}

export function useRemoveTagFromTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.delete(`/tags/task/${taskId}/tags/${tagId}`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags', 'task', taskId] });
    },
  });
}
