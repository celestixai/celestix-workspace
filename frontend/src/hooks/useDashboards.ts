import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface DashboardCard {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
  createdAt: string;
  updatedAt: string;
}

export interface CustomDashboard {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdById: string;
  createdBy?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  cards: DashboardCard[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardPayload {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateDashboardPayload {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export interface AddCardPayload {
  type: string;
  title: string;
  config?: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface UpdateCardPayload {
  title?: string;
  config?: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface LayoutItem {
  cardId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ==========================================
// Query hooks
// ==========================================

export function useDashboards(workspaceId?: string) {
  return useQuery<CustomDashboard[]>({
    queryKey: ['dashboards-custom', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboards-custom/workspace/${workspaceId}`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useDashboard(dashboardId?: string) {
  return useQuery<CustomDashboard>({
    queryKey: ['dashboard-custom', dashboardId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboards-custom/${dashboardId}`);
      return data.data;
    },
    enabled: !!dashboardId,
  });
}

export function useCardData(cardId?: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ['dashboard-card-data', cardId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboards-custom/cards/${cardId}/data`);
      return data.data;
    },
    enabled: !!cardId,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

// ==========================================
// Mutation hooks
// ==========================================

export function useCreateDashboard(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDashboardPayload) => {
      const { data } = await api.post(`/dashboards-custom/workspace/${workspaceId}`, payload);
      return data.data as CustomDashboard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards-custom', workspaceId] });
    },
  });
}

export function useUpdateDashboard(dashboardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateDashboardPayload) => {
      const { data } = await api.patch(`/dashboards-custom/${dashboardId}`, payload);
      return data.data as CustomDashboard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-custom', dashboardId] });
      qc.invalidateQueries({ queryKey: ['dashboards-custom'] });
    },
  });
}

export function useDeleteDashboard(dashboardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/dashboards-custom/${dashboardId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards-custom'] });
    },
  });
}

export function useDuplicateDashboard(dashboardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/dashboards-custom/${dashboardId}/duplicate`);
      return data.data as CustomDashboard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards-custom'] });
    },
  });
}

export function useAddCard(dashboardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddCardPayload) => {
      const { data } = await api.post(`/dashboards-custom/${dashboardId}/cards`, payload);
      return data.data as DashboardCard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-custom', dashboardId] });
    },
  });
}

export function useUpdateCard(cardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateCardPayload) => {
      const { data } = await api.patch(`/dashboards-custom/cards/${cardId}`, payload);
      return data.data as DashboardCard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-custom'] });
      qc.invalidateQueries({ queryKey: ['dashboard-card-data', cardId] });
    },
  });
}

export function useDeleteCard(cardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/dashboards-custom/cards/${cardId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-custom'] });
    },
  });
}

export function useUpdateLayout(dashboardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (layout: LayoutItem[]) => {
      const { data } = await api.patch(`/dashboards-custom/${dashboardId}/layout`, { layout });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-custom', dashboardId] });
    },
  });
}
