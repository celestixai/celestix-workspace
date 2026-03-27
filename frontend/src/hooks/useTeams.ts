import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
  members: TeamMember[];
  _count: { members: number };
}

// ==========================================
// Hooks
// ==========================================

export function useTeams(workspaceId?: string) {
  return useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/teams/workspace/${workspaceId}`);
      return data.data as Team[];
    },
    enabled: !!workspaceId,
  });
}

export function useTeam(teamId?: string) {
  return useQuery({
    queryKey: ['teams', 'detail', teamId],
    queryFn: async () => {
      const { data } = await api.get(`/teams/${teamId}`);
      return data.data as Team;
    },
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; name: string; description?: string; color?: string; icon?: string }) => {
      const { data } = await api.post('/teams', input);
      return data.data as Team;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teams', vars.workspaceId] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, ...input }: { teamId: string; name?: string; description?: string; color?: string; icon?: string }) => {
      const { data } = await api.patch(`/teams/${teamId}`, input);
      return data.data as Team;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`/teams/${teamId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role?: string }) => {
      const { data } = await api.post(`/teams/${teamId}/members`, { userId, role });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
