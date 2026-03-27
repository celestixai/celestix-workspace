import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TaskList {
  id: string;
  name: string;
  spaceId?: string;
  folderId?: string;
  taskCount?: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  type: 'open' | 'in_progress' | 'done' | 'closed';
}

interface CreateListPayload {
  name: string;
}

export function useListsBySpace(spaceId: string | undefined) {
  return useQuery<TaskList[]>({
    queryKey: ['lists', 'space', spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/space/${spaceId}/lists`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });
}

export function useListsByFolder(folderId: string | undefined) {
  return useQuery<TaskList[]>({
    queryKey: ['lists', 'folder', folderId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/folder/${folderId}/lists`);
      return data.data ?? data;
    },
    enabled: !!folderId,
  });
}

export function useList(listId: string | undefined) {
  return useQuery<TaskList>({
    queryKey: ['list', listId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/${listId}`);
      return data.data ?? data;
    },
    enabled: !!listId,
  });
}

export function useCreateListInSpace(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateListPayload) => {
      const { data } = await api.post(`/task-lists/space/${spaceId}/lists`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists', 'space', spaceId] });
    },
  });
}

export function useCreateListInFolder(folderId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateListPayload) => {
      const { data } = await api.post(`/task-lists/folder/${folderId}/lists`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists', 'folder', folderId] });
    },
  });
}

export function useListStatuses(listId: string | undefined) {
  return useQuery<ListStatus[]>({
    queryKey: ['list-statuses', listId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/${listId}/statuses`);
      return data.data ?? data;
    },
    enabled: !!listId,
  });
}
