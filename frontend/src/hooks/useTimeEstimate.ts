import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface TimeSummary {
  estimated: {
    total: number;
    perUser: Array<{ userId: string; displayName: string; minutes: number }>;
  };
  tracked: {
    total: number;
    perUser: Array<{ userId: string; displayName: string; minutes: number }>;
  };
  remaining: number;
  percentComplete: number;
}

// ==========================================
// Hooks
// ==========================================

export function useTimeSummary(taskId: string | undefined) {
  return useQuery<TimeSummary>({
    queryKey: ['time-summary', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/time-summary`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useSetTimeEstimate(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (minutes: number) => {
      const { data } = await api.put(`/tasks/${taskId}/time-estimate`, { minutes });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-summary', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useSetUserTimeEstimate(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, minutes }: { userId: string; minutes: number }) => {
      const { data } = await api.put(`/tasks/${taskId}/time-estimate/${userId}`, { minutes });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-summary', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}

export function useRemoveUserTimeEstimate(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/tasks/${taskId}/time-estimate/${userId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-summary', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}
