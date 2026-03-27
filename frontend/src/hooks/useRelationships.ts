import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type RelationType = 'BLOCKS' | 'WAITING_ON' | 'LINKED_TO';

export interface RelatedTask {
  id: string;
  title: string;
  status: string;
  customTaskId?: string | null;
  assignees?: Array<{
    user: { id: string; displayName: string; avatarUrl?: string };
  }>;
}

export interface RelationshipEntry {
  id: string;
  task: RelatedTask;
}

export interface RelationshipsGrouped {
  blocking: RelationshipEntry[];
  waitingOn: RelationshipEntry[];
  linkedTo: RelationshipEntry[];
}

export interface DependencyWarning {
  severity: 'warning' | 'info';
  message: string;
  blockingTask: {
    id: string;
    title: string;
    status: string;
    customTaskId: string | null;
  };
}

// ==========================================
// Hooks
// ==========================================

export function useRelationships(taskId: string | undefined) {
  return useQuery<RelationshipsGrouped>({
    queryKey: ['relationships', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/relationships`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateRelationship(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetTaskId: string; type: RelationType }) => {
      const { data } = await api.post(`/tasks/${taskId}/relationships`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relationships', taskId] });
      qc.invalidateQueries({ queryKey: ['dependency-warnings', taskId] });
    },
  });
}

export function useDeleteRelationship(taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relationshipId: string) => {
      const { data } = await api.delete(`/tasks/relationships/${relationshipId}`);
      return data;
    },
    onSuccess: () => {
      if (taskId) {
        qc.invalidateQueries({ queryKey: ['relationships', taskId] });
        qc.invalidateQueries({ queryKey: ['dependency-warnings', taskId] });
      }
      // Also invalidate broadly since the target task's relationships changed too
      qc.invalidateQueries({ queryKey: ['relationships'] });
      qc.invalidateQueries({ queryKey: ['dependency-warnings'] });
    },
  });
}

export function useDependencyWarnings(taskId: string | undefined) {
  return useQuery<DependencyWarning[]>({
    queryKey: ['dependency-warnings', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/dependency-warnings`);
      return data.data;
    },
    enabled: !!taskId,
  });
}
