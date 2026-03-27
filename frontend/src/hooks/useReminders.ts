import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type ReminderFilter = 'upcoming' | 'overdue' | 'completed' | 'all';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueAt: string;
  isCompleted: boolean;
  isRecurring: boolean;
  recurrenceConfig?: Record<string, unknown>;
  relatedTaskId?: string;
  relatedMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderPayload {
  title: string;
  description?: string;
  dueAt: string;
  isRecurring?: boolean;
  recurrenceConfig?: Record<string, unknown>;
  relatedTaskId?: string;
  relatedMessageId?: string;
}

export interface UpdateReminderPayload {
  title?: string;
  description?: string | null;
  dueAt?: string;
  isRecurring?: boolean;
  recurrenceConfig?: Record<string, unknown>;
  relatedTaskId?: string | null;
  relatedMessageId?: string | null;
}

export type SnoozeDuration = '15m' | '1h' | '3h' | 'tomorrow' | 'next_week';

// ==========================================
// Query hooks
// ==========================================

const REMINDERS_KEY = ['reminders'];

export function useReminders(filter: ReminderFilter = 'all') {
  return useQuery<Reminder[]>({
    queryKey: [...REMINDERS_KEY, filter],
    queryFn: async () => {
      const { data } = await api.get(`/reminders?filter=${filter}`);
      return data.data;
    },
  });
}

// ==========================================
// Mutation hooks
// ==========================================

function useInvalidateReminders() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: REMINDERS_KEY });
  };
}

export function useCreateReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: async (payload: CreateReminderPayload) => {
      const { data } = await api.post('/reminders', payload);
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateReminder(reminderId?: string) {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: async (payload: UpdateReminderPayload) => {
      const { data } = await api.patch(`/reminders/${reminderId}`, payload);
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteReminder(reminderId?: string) {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/reminders/${reminderId}`);
    },
    onSuccess: invalidate,
  });
}

export function useCompleteReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { data } = await api.post(`/reminders/${reminderId}/complete`);
      return data.data;
    },
    onSuccess: invalidate,
  });
}

export function useSnoozeReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: async ({ reminderId, duration }: { reminderId: string; duration: SnoozeDuration }) => {
      const { data } = await api.post(`/reminders/${reminderId}/snooze`, { duration });
      return data.data;
    },
    onSuccess: invalidate,
  });
}
