import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ViewConfig {
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  groupBy?: string;
  subGroupBy?: string;
  showSubtasks?: boolean;
  showClosedTasks?: boolean;
  collapsed?: Record<string, boolean>;
}

export interface FilterCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface View {
  id: string;
  name: string;
  viewType: string;
  locationType: string;
  locationId: string;
  config: ViewConfig;
  isPersonal: boolean;
  isPinned: boolean;
  position: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export function useViewsAtLocation(locationType: string | undefined, locationId: string | undefined) {
  return useQuery<View[]>({
    queryKey: ['views', 'location', locationType, locationId],
    queryFn: async () => {
      const { data } = await api.get(`/views/location/${locationType}/${locationId}`);
      return data.data ?? data;
    },
    enabled: !!locationType && !!locationId,
  });
}

export function useView(viewId: string | undefined) {
  return useQuery<View>({
    queryKey: ['view', viewId],
    queryFn: async () => {
      const { data } = await api.get(`/views/${viewId}`);
      return data.data ?? data;
    },
    enabled: !!viewId,
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      viewType: string;
      locationType: string;
      locationId: string;
      config?: ViewConfig;
      isPersonal?: boolean;
    }) => {
      const { data } = await api.post('/views', payload);
      return data.data ?? data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['views', 'location', variables.locationType, variables.locationId] });
    },
  });
}

export function useUpdateView(viewId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Pick<View, 'name' | 'config' | 'isPinned' | 'position'>>) => {
      const { data } = await api.patch(`/views/${viewId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['view', viewId] });
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useDeleteView(viewId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/views/${viewId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useDuplicateView(viewId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/views/${viewId}/duplicate`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useTogglePin(viewId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/views/${viewId}/pin`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] });
      qc.invalidateQueries({ queryKey: ['view', viewId] });
    },
  });
}
