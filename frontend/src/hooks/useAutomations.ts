import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type TriggerType =
  | 'STATUS_CHANGED' | 'TASK_CREATED' | 'TASK_MOVED'
  | 'ASSIGNEE_CHANGED' | 'PRIORITY_CHANGED' | 'DUE_DATE_ARRIVES'
  | 'COMMENT_ADDED' | 'TAG_ADDED' | 'CUSTOM_FIELD_CHANGED';

export type ActionType =
  | 'CHANGE_STATUS' | 'CHANGE_PRIORITY' | 'ADD_ASSIGNEE' | 'REMOVE_ASSIGNEE'
  | 'SET_DUE_DATE' | 'ADD_TAG' | 'MOVE_TO_LIST' | 'CREATE_SUBTASK'
  | 'SET_CUSTOM_FIELD' | 'SEND_NOTIFICATION' | 'ADD_COMMENT' | 'ARCHIVE';

export type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'is_set' | 'is_not_set' | 'greater_than' | 'less_than';

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface AutomationAction {
  type: ActionType;
  config: Record<string, unknown>;
  position: number;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  locationType: string;
  locationId: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: AutomationAction[];
  isActive: boolean;
  executionCount: number;
  lastRunAt?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  triggerEvent: string;
  taskId?: string;
  taskName?: string;
  actionsRun: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  duration: number;
  details: Record<string, unknown>;
  error?: string;
  createdAt: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: AutomationAction[];
}

export type CreateAutomationPayload = {
  name: string;
  description?: string;
  workspaceId: string;
  locationType: string;
  locationId: string;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  conditionLogic?: 'AND' | 'OR';
  actions: AutomationAction[];
  isActive?: boolean;
};

export type UpdateAutomationPayload = Partial<Omit<CreateAutomationPayload, 'workspaceId'>>;

// ==========================================
// Queries
// ==========================================

export function useAutomations(workspaceId: string | undefined) {
  return useQuery<Automation[]>({
    queryKey: ['automations', 'workspace', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/automations/workspace/${workspaceId}`);
      return data.data ?? data;
    },
    enabled: !!workspaceId,
  });
}

export function useAutomationsAtLocation(locationType: string | undefined, locationId: string | undefined) {
  return useQuery<Automation[]>({
    queryKey: ['automations', 'location', locationType, locationId],
    queryFn: async () => {
      const { data } = await api.get(`/automations/location/${locationType}/${locationId}`);
      return data.data ?? data;
    },
    enabled: !!locationType && !!locationId,
  });
}

export function useAutomation(automationId: string | undefined) {
  return useQuery<Automation>({
    queryKey: ['automation', automationId],
    queryFn: async () => {
      const { data } = await api.get(`/automations/${automationId}`);
      return data.data ?? data;
    },
    enabled: !!automationId,
  });
}

export function useAutomationLogs(automationId: string | undefined) {
  return useQuery<AutomationLog[]>({
    queryKey: ['automation', automationId, 'logs'],
    queryFn: async () => {
      const { data } = await api.get(`/automations/${automationId}/logs`);
      return data.data ?? data;
    },
    enabled: !!automationId,
  });
}

export function useAutomationTemplates() {
  return useQuery<AutomationTemplate[]>({
    queryKey: ['automations', 'templates'],
    queryFn: async () => {
      const { data } = await api.get('/automations/templates');
      return data.data ?? data;
    },
  });
}

// ==========================================
// Mutations
// ==========================================

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAutomationPayload) => {
      const { data } = await api.post('/automations', payload);
      return data.data ?? data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['automations', 'workspace', variables.workspaceId] });
      qc.invalidateQueries({ queryKey: ['automations', 'location', variables.locationType, variables.locationId] });
    },
  });
}

export function useUpdateAutomation(automationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateAutomationPayload) => {
      const { data } = await api.patch(`/automations/${automationId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', automationId] });
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useDeleteAutomation(automationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/automations/${automationId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useToggleAutomation(automationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/automations/${automationId}/toggle`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', automationId] });
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useTestAutomation(automationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/automations/${automationId}/test`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', automationId, 'logs'] });
    },
  });
}
