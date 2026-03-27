import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface Watcher {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
  createdAt: string;
}

// ==========================================
// Hooks
// ==========================================

export function useWatchers(taskId: string | undefined) {
  return useQuery<Watcher[]>({
    queryKey: ['watchers', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/watchers`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useWatchTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/tasks/${taskId}/watchers`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchers', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}

export function useUnwatchTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/tasks/${taskId}/watchers`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchers', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}
