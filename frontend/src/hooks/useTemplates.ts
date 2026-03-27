import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type TemplateType = 'TASK' | 'LIST' | 'FOLDER' | 'SPACE';

export interface TaskTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  templateType: TemplateType;
  templateData: any;
  tags?: string[] | null;
  previewImageUrl?: string | null;
  isPublic: boolean;
  isPinned: boolean;
  usageCount: number;
  createdById: string;
  createdBy?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFilters {
  type?: TemplateType;
  tags?: string[];
  search?: string;
}

export interface ApplyTemplateInput {
  targetListId: string;
  remapDates?: boolean;
  dateOffset?: number;
}

export interface ApplyTemplateResult {
  templateId: string;
  templateType: TemplateType;
  applied: boolean;
  createdCount: number;
  items: { id: string; title: string }[];
}

// ==========================================
// Queries
// ==========================================

export function useTemplates(workspaceId: string | undefined, filters?: TemplateFilters) {
  return useQuery<TaskTemplate[]>({
    queryKey: ['templates', workspaceId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      const { data } = await api.get(`/templates/workspace/${workspaceId}${qs ? `?${qs}` : ''}`);
      return data.data ?? data;
    },
    enabled: !!workspaceId,
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery<TaskTemplate>({
    queryKey: ['templates', 'detail', templateId],
    queryFn: async () => {
      const { data } = await api.get(`/templates/${templateId}`);
      return data.data ?? data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateTags(workspaceId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['templates', 'tags', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/templates/workspace/${workspaceId}/tags`);
      return data.data ?? data;
    },
    enabled: !!workspaceId,
  });
}

// ==========================================
// Mutations
// ==========================================

export function useCreateTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      templateType?: TemplateType;
      templateData: any;
      tags?: string[];
      isPublic?: boolean;
    }) => {
      const { data } = await api.post(`/templates/workspace/${workspaceId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', workspaceId] });
    },
  });
}

export function useCreateFromTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, name, description }: { taskId: string; name: string; description?: string }) => {
      const { data } = await api.post(`/templates/from-task/${taskId}`, { name, description });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCreateFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, name, description }: { listId: string; name: string; description?: string }) => {
      const { data } = await api.post(`/templates/from-list/${listId}`, { name, description });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation<ApplyTemplateResult, Error, { templateId: string } & ApplyTemplateInput>({
    mutationFn: async ({ templateId, ...body }) => {
      const { data } = await api.post(`/templates/${templateId}/apply`, body);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/templates/${templateId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useToggleTemplatePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await api.post(`/templates/${templateId}/pin`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
