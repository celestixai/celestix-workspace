import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type TimeOffType = 'VACATION' | 'SICK' | 'PERSONAL' | 'HOLIDAY' | 'OTHER';
export type TimeOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorkSchedule {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  workDays: number[];
  workHoursPerDay: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt: string;
  userAssignments?: UserWorkScheduleAssignment[];
}

export interface UserWorkScheduleAssignment {
  id: string;
  userId: string;
  scheduleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface TimeOff {
  id: string;
  userId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  note: string | null;
  status: TimeOffStatus;
  approvedById: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  approvedBy?: {
    id: string;
    displayName: string;
  } | null;
}

export interface TeamAvailability {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'available' | 'off' | 'half-day' | 'non-working';
  timeOffType: string | null;
  schedule: { startTime: string; endTime: string } | null;
}

// ==========================================
// Work Schedule Hooks
// ==========================================

export function useWorkSchedules(workspaceId?: string) {
  return useQuery({
    queryKey: ['work-schedules', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/schedules/workspace/${workspaceId}`);
      return data.data as WorkSchedule[];
    },
    enabled: !!workspaceId,
  });
}

export function useUserSchedule(userId?: string) {
  return useQuery({
    queryKey: ['user-schedule', userId],
    queryFn: async () => {
      const { data } = await api.get(`/schedules/user/${userId}`);
      return data.data as WorkSchedule | null;
    },
    enabled: !!userId,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...body }: { workspaceId: string; name: string; workDays: number[]; isDefault?: boolean; workHoursPerDay?: number; startTime?: string; endTime?: string; timezone?: string }) => {
      const { data } = await api.post(`/schedules/workspace/${workspaceId}`, body);
      return data.data as WorkSchedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, ...body }: { scheduleId: string; name?: string; workDays?: number[]; isDefault?: boolean; workHoursPerDay?: number; startTime?: string; endTime?: string; timezone?: string }) => {
      const { data } = await api.patch(`/schedules/${scheduleId}`, body);
      return data.data as WorkSchedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      await api.delete(`/schedules/${scheduleId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
    },
  });
}

export function useAssignSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { userId: string; scheduleId: string; effectiveFrom: string }) => {
      const { data } = await api.post('/schedules/assign', body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
      qc.invalidateQueries({ queryKey: ['user-schedule'] });
    },
  });
}

// ==========================================
// Time Off Hooks
// ==========================================

export function useTimeOff(filters?: { userId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['time-off', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/schedules/time-off${qs ? `?${qs}` : ''}`);
      return data.data as TimeOff[];
    },
  });
}

export function useRequestTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { type: TimeOffType; startDate: string; endDate: string; isHalfDay?: boolean; note?: string }) => {
      const { data } = await api.post('/schedules/time-off', body);
      return data.data as TimeOff;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-off'] });
      qc.invalidateQueries({ queryKey: ['team-availability'] });
    },
  });
}

export function useUpdateTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      const { data } = await api.patch(`/schedules/time-off/${id}`, { status });
      return data.data as TimeOff;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-off'] });
      qc.invalidateQueries({ queryKey: ['team-availability'] });
    },
  });
}

export function useCancelTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedules/time-off/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-off'] });
      qc.invalidateQueries({ queryKey: ['team-availability'] });
    },
  });
}

export function useTeamAvailability(workspaceId?: string, date?: string) {
  return useQuery({
    queryKey: ['team-availability', workspaceId, date],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) params.set('workspaceId', workspaceId);
      if (date) params.set('date', date);
      const { data } = await api.get(`/schedules/team-availability?${params.toString()}`);
      return data.data as TeamAvailability[];
    },
    enabled: !!workspaceId,
  });
}
