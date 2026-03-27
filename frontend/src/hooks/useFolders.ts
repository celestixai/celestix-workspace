import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Folder {
  id: string;
  name: string;
  spaceId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateFolderPayload {
  name: string;
}

export function useFolders(spaceId: string | undefined) {
  return useQuery<Folder[]>({
    queryKey: ['folders', spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/folders/space/${spaceId}/folders`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });
}

export function useFolder(folderId: string | undefined) {
  return useQuery<Folder>({
    queryKey: ['folder', folderId],
    queryFn: async () => {
      const { data } = await api.get(`/folders/${folderId}`);
      return data.data ?? data;
    },
    enabled: !!folderId,
  });
}

export function useCreateFolder(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFolderPayload) => {
      const { data } = await api.post(`/folders/space/${spaceId}/folders`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', spaceId] });
    },
  });
}
