import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TaskType {
  id: string;
  spaceId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isDefault: boolean;
  position: number;
  createdAt: string;
}

interface CreateTaskTypePayload {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  isDefault?: boolean;
}

interface UpdateTaskTypePayload {
  name?: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isDefault?: boolean;
  position?: number;
}

export function useTaskTypes(spaceId: string | undefined) {
  return useQuery<TaskType[]>({
    queryKey: ['task-types', spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/task-types/space/${spaceId}`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });
}

export function useCreateTaskType(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTaskTypePayload) => {
      const { data } = await api.post(`/task-types/space/${spaceId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types', spaceId] });
    },
  });
}

export function useUpdateTaskType(spaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ typeId, ...payload }: UpdateTaskTypePayload & { typeId: string }) => {
      const { data } = await api.patch(`/task-types/${typeId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      if (spaceId) {
        qc.invalidateQueries({ queryKey: ['task-types', spaceId] });
      }
    },
  });
}

export function useDeleteTaskType(spaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (typeId: string) => {
      await api.delete(`/task-types/${typeId}`);
    },
    onSuccess: () => {
      if (spaceId) {
        qc.invalidateQueries({ queryKey: ['task-types', spaceId] });
      }
    },
  });
}
