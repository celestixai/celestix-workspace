import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETE' | 'CLOSED';

export interface SprintFolder {
  id: string;
  spaceId: string;
  name: string;
  description?: string;
  defaultDuration: number;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  _count: { sprints: number };
}

export interface Sprint {
  id: string;
  sprintFolderId: string;
  listId?: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  totalPoints: number;
  completedPoints: number;
  velocity?: number;
  createdAt: string;
  updatedAt: string;
  _count: { tasks: number };
}

export interface SprintDetail extends Sprint {
  folder: { id: string; name: string; spaceId: string };
  totalTasks: number;
  completedTasks: number;
  statusBreakdown: Record<string, number>;
}

export interface SprintTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  storyPoints?: number;
  statusName?: string;
  statusColor?: string;
  dueDate?: string;
  assignees: Array<{
    user: { id: string; displayName: string; avatarUrl?: string };
  }>;
}

export interface BurndownData {
  idealLine: Array<{ date: string; points: number }>;
  actualLine: Array<{ date: string; points: number }>;
  totalPoints: number;
}

export interface BurnupPoint {
  date: string;
  completedPoints: number;
  totalPoints: number;
  totalTasks: number;
  completedTasks: number;
}

export interface VelocityPoint {
  sprintId: string;
  name: string;
  velocity: number;
  completedPoints: number;
  totalPoints: number;
  startDate: string;
  endDate: string;
}

export interface SprintReport {
  sprint: {
    id: string;
    name: string;
    goal?: string;
    status: SprintStatus;
    startDate: string;
    endDate: string;
    folder: { id: string; name: string };
  };
  totalTasks: number;
  completedTasks: number;
  carryover: number;
  addedDuringSprint: number;
  totalPoints: number;
  completedPoints: number;
  velocity: number;
  completionPercent: number;
}

// ==========================================
// Folder hooks
// ==========================================

export function useSprintFolders(spaceId?: string) {
  return useQuery<SprintFolder[]>({
    queryKey: ['sprint-folders', spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/space/${spaceId}/folders`);
      return data.data;
    },
    enabled: !!spaceId,
  });
}

export function useCreateSprintFolder(spaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; defaultDuration?: number }) => {
      const { data } = await api.post(`/sprints/space/${spaceId}/folders`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-folders', spaceId] });
    },
  });
}

export function useUpdateSprintFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, ...payload }: { folderId: string; name?: string; description?: string; defaultDuration?: number; isActive?: boolean; position?: number }) => {
      const { data } = await api.patch(`/sprints/folders/${folderId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-folders'] });
    },
  });
}

export function useDeleteSprintFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`/sprints/folders/${folderId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-folders'] });
    },
  });
}

// ==========================================
// Sprint hooks
// ==========================================

export function useSprints(folderId?: string) {
  return useQuery<Sprint[]>({
    queryKey: ['sprints', folderId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/folder/${folderId}`);
      return data.data;
    },
    enabled: !!folderId,
  });
}

export function useSprint(sprintId?: string) {
  return useQuery<SprintDetail>({
    queryKey: ['sprint', sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/${sprintId}`);
      return data.data;
    },
    enabled: !!sprintId,
  });
}

export function useCreateSprint(folderId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; goal?: string; startDate: string; endDate: string; listId?: string }) => {
      const { data } = await api.post(`/sprints/folder/${folderId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', folderId] });
    },
  });
}

export function useUpdateSprint(sprintId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; goal?: string; startDate?: string; endDate?: string }) => {
      const { data } = await api.patch(`/sprints/${sprintId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

export function useStartSprint(sprintId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/sprints/${sprintId}/start`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

export function useCompleteSprint(sprintId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { moveIncompleteToSprintId?: string }) => {
      const { data } = await api.post(`/sprints/${sprintId}/complete`, payload ?? {});
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

// ==========================================
// Task hooks
// ==========================================

export function useSprintTasks(sprintId?: string) {
  return useQuery<SprintTask[]>({
    queryKey: ['sprint-tasks', sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/${sprintId}/tasks`);
      return data.data;
    },
    enabled: !!sprintId,
  });
}

export function useAddTasksToSprint(sprintId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { data } = await api.post(`/sprints/${sprintId}/tasks`, { taskIds });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-tasks', sprintId] });
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] });
    },
  });
}

export function useRemoveTaskFromSprint(sprintId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/sprints/${sprintId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-tasks', sprintId] });
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] });
    },
  });
}

// ==========================================
// Analytics hooks
// ==========================================

export function useBurndownData(sprintId?: string) {
  return useQuery<BurndownData>({
    queryKey: ['sprint-burndown', sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/${sprintId}/burndown`);
      return data.data;
    },
    enabled: !!sprintId,
  });
}

export function useBurnupData(sprintId?: string) {
  return useQuery<BurnupPoint[]>({
    queryKey: ['sprint-burnup', sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/${sprintId}/burnup`);
      return data.data;
    },
    enabled: !!sprintId,
  });
}

export function useVelocityData(folderId?: string) {
  return useQuery<VelocityPoint[]>({
    queryKey: ['sprint-velocity', folderId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/folder/${folderId}/velocity`);
      return data.data;
    },
    enabled: !!folderId,
  });
}

export function useSprintReport(sprintId?: string) {
  return useQuery<SprintReport>({
    queryKey: ['sprint-report', sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/sprints/${sprintId}/report`);
      return data.data;
    },
    enabled: !!sprintId,
  });
}
