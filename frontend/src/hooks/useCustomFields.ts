import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type CustomFieldType =
  | 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'MONEY'
  | 'DROPDOWN' | 'MULTI_SELECT' | 'LABEL'
  | 'DATE' | 'CHECKBOX' | 'EMAIL' | 'PHONE' | 'URL'
  | 'RATING' | 'PROGRESS' | 'FILE' | 'RELATIONSHIP'
  | 'FORMULA' | 'ROLLUP' | 'LOCATION' | 'VOTING' | 'PEOPLE'
  | 'AI_SUMMARY' | 'AI_SENTIMENT' | 'AI_CUSTOM';

export type HierarchyLevel = 'WORKSPACE' | 'SPACE' | 'FOLDER' | 'LIST';

export interface FieldOption {
  id: string;
  name: string;
  color?: string;
}

export interface FieldConfig {
  options?: FieldOption[];
  max?: number;
  min?: number;
  currency?: string;
  formula?: string;
  rollupField?: string;
  rollupFunction?: string;
  [key: string]: any;
}

export interface FieldDefinition {
  id: string;
  name: string;
  fieldType: CustomFieldType;
  description?: string;
  config: FieldConfig;
  isRequired: boolean;
  workspaceId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldValue {
  id: string;
  fieldId: string;
  taskId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
  valueJson?: any;
  field?: FieldDefinition;
}

export interface FieldLocation {
  id: string;
  fieldId: string;
  locationType: HierarchyLevel;
  locationId: string;
}

// ==========================================
// Queries
// ==========================================

export function useCustomFields(workspaceId: string | undefined) {
  return useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/custom-fields/workspace/${workspaceId}`);
      return data.data ?? data;
    },
    enabled: !!workspaceId,
  });
}

export function useCustomFieldsAtLocation(locationType: HierarchyLevel | undefined, locationId: string | undefined) {
  return useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', 'location', locationType, locationId],
    queryFn: async () => {
      const { data } = await api.get(`/custom-fields/location/${locationType}/${locationId}`);
      return data.data ?? data;
    },
    enabled: !!locationType && !!locationId,
  });
}

export function useCustomFieldValues(taskId: string | undefined) {
  return useQuery<FieldValue[]>({
    queryKey: ['custom-field-values', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/custom-fields/task/${taskId}`);
      return data.data ?? data;
    },
    enabled: !!taskId,
  });
}

// ==========================================
// Mutations
// ==========================================

export function useSetFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, fieldId, value }: { taskId: string; fieldId: string; value: any }) => {
      const { data } = await api.put(`/custom-fields/task/${taskId}/${fieldId}`, value);
      return data.data ?? data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-field-values', variables.taskId] });
    },
  });
}

export function useClearFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, fieldId }: { taskId: string; fieldId: string }) => {
      await api.delete(`/custom-fields/task/${taskId}/${fieldId}`);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-field-values', variables.taskId] });
    },
  });
}

export function useCreateField(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      fieldType: CustomFieldType;
      description?: string;
      config?: FieldConfig;
      isRequired?: boolean;
    }) => {
      const { data } = await api.post(`/custom-fields/workspace/${workspaceId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', workspaceId] });
      qc.invalidateQueries({ queryKey: ['custom-fields', 'location'] });
    },
  });
}

export function useRefreshAIField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, fieldId }: { taskId: string; fieldId: string }) => {
      const { data } = await api.post(`/custom-fields/task/${taskId}/${fieldId}/refresh-ai`);
      return data.data ?? data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-field-values', variables.taskId] });
    },
  });
}

export function useAddFieldLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fieldId, locationType, locationId }: { fieldId: string; locationType: HierarchyLevel; locationId: string }) => {
      const { data } = await api.post(`/custom-fields/${fieldId}/locations`, { locationType, locationId });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', 'location'] });
    },
  });
}
