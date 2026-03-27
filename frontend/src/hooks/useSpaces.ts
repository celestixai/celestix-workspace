import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Space {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  memberCount?: number;
  workspaceId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  taskIdPrefix?: string | null;
  taskIdCounter?: number;
}

interface CreateSpacePayload {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

interface UpdateSpacePayload {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  order?: number;
}

export function useSpaces(workspaceId: string | undefined) {
  return useQuery<Space[]>({
    queryKey: ['spaces', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/workspace/${workspaceId}/spaces`);
      return data.data ?? data;
    },
    enabled: !!workspaceId,
  });
}

export function useSpace(spaceId: string | undefined) {
  return useQuery<Space>({
    queryKey: ['space', spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });
}

export function useCreateSpace(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSpacePayload) => {
      const { data } = await api.post(`/spaces/workspace/${workspaceId}/spaces`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces', workspaceId] });
    },
  });
}

export function useUpdateSpace(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateSpacePayload) => {
      const { data } = await api.patch(`/spaces/${spaceId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['space', spaceId] });
    },
  });
}

export function useDeleteSpace(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/spaces/${spaceId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}
