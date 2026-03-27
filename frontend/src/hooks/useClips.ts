import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type ClipType = 'SCREEN_RECORDING' | 'VOICE_CLIP';

export interface Clip {
  id: string;
  workspaceId: string;
  createdById: string;
  title: string;
  type: ClipType;
  duration: number | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  transcriptText: string | null;
  transcriptJson: unknown | null;
  fileSize: number | null;
  mimeType: string;
  isPublic: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ClipsHub {
  clips: Clip[];
  stats: {
    totalClips: number;
    totalDuration: number;
    byType: Record<string, { count: number; duration: number }>;
  };
}

// ==========================================
// Hooks
// ==========================================

export function useClips(workspaceId?: string, filters?: { type?: ClipType; userId?: string; search?: string }) {
  return useQuery({
    queryKey: ['clips', workspaceId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      const { data } = await api.get(`/clips/workspace/${workspaceId}${qs ? `?${qs}` : ''}`);
      return data.data as Clip[];
    },
    enabled: !!workspaceId,
  });
}

export function useClip(clipId?: string) {
  return useQuery({
    queryKey: ['clip', clipId],
    queryFn: async () => {
      const { data } = await api.get(`/clips/${clipId}`);
      return data.data as Clip;
    },
    enabled: !!clipId,
  });
}

export function useClipsHub(workspaceId?: string) {
  return useQuery({
    queryKey: ['clips-hub', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/clips/hub/${workspaceId}`);
      return data.data as ClipsHub;
    },
    enabled: !!workspaceId,
  });
}

export function useUploadClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/clips/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as Clip;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clips'] });
      qc.invalidateQueries({ queryKey: ['clips-hub'] });
    },
  });
}

export function useUpdateClip(clipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title?: string; isPublic?: boolean }) => {
      const { data } = await api.patch(`/clips/${clipId}`, body);
      return data.data as Clip;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clips'] });
      qc.invalidateQueries({ queryKey: ['clip', clipId] });
      qc.invalidateQueries({ queryKey: ['clips-hub'] });
    },
  });
}

export function useDeleteClip(clipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/clips/${clipId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clips'] });
      qc.invalidateQueries({ queryKey: ['clips-hub'] });
    },
  });
}

export function useShareClip(clipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/clips/${clipId}/share`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clips'] });
      qc.invalidateQueries({ queryKey: ['clip', clipId] });
    },
  });
}
