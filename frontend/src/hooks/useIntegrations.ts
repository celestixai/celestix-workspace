import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type IntegrationType =
  | 'GOOGLE_CALENDAR'
  | 'OUTLOOK_CALENDAR'
  | 'SLACK'
  | 'GITHUB'
  | 'GOOGLE_DRIVE'
  | 'WEBHOOK_INCOMING'
  | 'WEBHOOK_OUTGOING'
  | 'ZAPIER';

export interface Integration {
  id: string;
  workspaceId: string;
  type: IntegrationType;
  name: string;
  config: any;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  connectedById: string;
  createdAt: string;
  updatedAt: string;
  connectedBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface WebhookLog {
  id: string;
  event: string;
  url: string;
  status: number | null;
  response: string | null;
  attempts: number;
  createdAt: string;
}

// ==========================================
// Hooks
// ==========================================

export function useIntegrations(workspaceId?: string) {
  return useQuery({
    queryKey: ['integrations', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/integrations/workspace/${workspaceId}`);
      return data.data as Integration[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { workspaceId: string; type: IntegrationType; name: string; config?: any }) => {
      const { data } = await api.post('/integrations', body);
      return data.data as Integration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useUpdateIntegration(integrationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name?: string; config?: any; isActive?: boolean }) => {
      const { data } = await api.patch(`/integrations/${integrationId}`, body);
      return data.data as Integration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useDeleteIntegration(integrationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/integrations/${integrationId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useSyncIntegration(integrationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/integrations/${integrationId}/sync`);
      return data.data as Integration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useTestIntegration(integrationId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/integrations/${integrationId}/test`);
      return data.data as { success: boolean; message: string };
    },
  });
}

export function useWebhookLogs(integrationId?: string) {
  return useQuery({
    queryKey: ['webhook-logs', integrationId],
    queryFn: async () => {
      const { data } = await api.get(`/integrations/${integrationId}/webhook-logs`);
      return data.data as WebhookLog[];
    },
    enabled: !!integrationId,
  });
}
