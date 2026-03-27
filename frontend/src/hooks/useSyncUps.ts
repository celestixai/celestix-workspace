import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface SyncUpUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SyncUpParticipant {
  id: string;
  syncUpId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  user: SyncUpUser;
}

export interface SyncUp {
  id: string;
  channelId: string;
  startedById: string;
  title?: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endedAt?: string;
  recordingUrl?: string;
  createdAt: string;
  startedBy: SyncUpUser;
  participants: SyncUpParticipant[];
}

// ==========================================
// Query Keys
// ==========================================

const SYNCUP_KEYS = {
  active: (channelId: string) => ['syncups', 'active', channelId],
  detail: (syncUpId: string) => ['syncups', 'detail', syncUpId],
  participants: (syncUpId: string) => ['syncups', 'participants', syncUpId],
};

// ==========================================
// Hooks
// ==========================================

export function useActiveSyncUp(channelId?: string) {
  return useQuery<SyncUp | null>({
    queryKey: SYNCUP_KEYS.active(channelId || ''),
    queryFn: async () => {
      const { data } = await api.get(`/workspace/channels/${channelId}/syncups/active`);
      return data.data || null;
    },
    enabled: !!channelId,
    refetchInterval: 10_000,
  });
}

export function useSyncUpParticipants(syncUpId?: string) {
  return useQuery<SyncUpParticipant[]>({
    queryKey: SYNCUP_KEYS.participants(syncUpId || ''),
    queryFn: async () => {
      // We need channelId for the URL but participants endpoint ignores it in service
      // We'll pass a placeholder since it's only used for routing
      const { data } = await api.get(`/workspace/channels/_/syncups/${syncUpId}/participants`);
      return data.data;
    },
    enabled: !!syncUpId,
    refetchInterval: 5_000,
  });
}

function useInvalidateSyncUps(channelId?: string) {
  const qc = useQueryClient();
  return () => {
    if (channelId) {
      qc.invalidateQueries({ queryKey: SYNCUP_KEYS.active(channelId) });
    }
    qc.invalidateQueries({ queryKey: ['syncups'] });
  };
}

export function useStartSyncUp(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/start`, { title });
      return data.data as SyncUp;
    },
    onSuccess: invalidate,
  });
}

export function useJoinSyncUp(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async (syncUpId: string) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/${syncUpId}/join`);
      return data.data as SyncUp;
    },
    onSuccess: invalidate,
  });
}

export function useLeaveSyncUp(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async (syncUpId: string) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/${syncUpId}/leave`);
      return data.data as SyncUp;
    },
    onSuccess: invalidate,
  });
}

export function useEndSyncUp(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async (syncUpId: string) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/${syncUpId}/end`);
      return data.data as SyncUp;
    },
    onSuccess: invalidate,
  });
}

export function useToggleSyncUpAudio(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async ({ syncUpId, enabled }: { syncUpId: string; enabled: boolean }) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/${syncUpId}/audio`, { enabled });
      return data.data as SyncUpParticipant;
    },
    onSuccess: invalidate,
  });
}

export function useToggleSyncUpVideo(channelId?: string) {
  const invalidate = useInvalidateSyncUps(channelId);
  return useMutation({
    mutationFn: async ({ syncUpId, enabled }: { syncUpId: string; enabled: boolean }) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/syncups/${syncUpId}/video`, { enabled });
      return data.data as SyncUpParticipant;
    },
    onSuccess: invalidate,
  });
}
