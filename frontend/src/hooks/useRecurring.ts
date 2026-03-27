import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RecurrenceConfig {
  frequency: string;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  createBefore?: number;
  timezone?: string;
}

export interface RecurringSchedule {
  id: string;
  taskId: string;
  frequency: string;
  interval: number;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  occurrenceCount: number;
  nextRunAt: string;
  createBefore: number;
  status: string;
  timezone: string;
  upcomingDates?: string[];
}

export function useRecurrence(taskId: string | undefined) {
  return useQuery<RecurringSchedule>({
    queryKey: ['recurrence', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/recurring/tasks/${taskId}/recurrence`);
      return data.data ?? data;
    },
    enabled: !!taskId,
    retry: false,
  });
}

export function useCreateRecurrence(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: RecurrenceConfig) => {
      const { data } = await api.post(`/recurring/tasks/${taskId}/recurrence`, config);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurrence', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateRecurrence(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<RecurrenceConfig>) => {
      const { data } = await api.patch(`/recurring/tasks/${taskId}/recurrence`, config);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurrence', taskId] });
    },
  });
}

export function useDeleteRecurrence(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/recurring/tasks/${taskId}/recurrence`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurrence', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function usePauseRecurrence(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/recurring/tasks/${taskId}/recurrence/pause`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurrence', taskId] });
    },
  });
}

export function useResumeRecurrence(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/recurring/tasks/${taskId}/recurrence/resume`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurrence', taskId] });
    },
  });
}
