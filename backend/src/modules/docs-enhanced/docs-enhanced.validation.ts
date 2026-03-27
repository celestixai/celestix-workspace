import { z } from 'zod';

// ==========================================
// DOC HUB
// ==========================================

export const docsHubQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  filter: z.enum(['all', 'wikis', 'myDocs', 'shared', 'recent', 'favorites']).optional().default('all'),
  search: z.string().max(200).optional(),
});

// ==========================================
// DOCUMENT CRUD (enhanced)
// ==========================================

export const createDocSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Document'),
  contentJson: z.any().optional(),
  contentHtml: z.string().max(5000000).optional(),
  isWiki: z.boolean().optional(),
  spaceId: z.string().uuid().optional(),
  parentDocId: z.string().uuid().optional(),
  icon: z.string().max(50).optional(),
  coverImageUrl: z.string().url().max(2000).optional(),
});

export const updateDocSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  contentJson: z.any().optional(),
  contentHtml: z.string().max(5000000).nullable().optional(),
  wordCount: z.number().int().min(0).optional(),
  isPublic: z.boolean().optional(),
  isWiki: z.boolean().optional(),
  icon: z.string().max(50).nullable().optional(),
  coverImageUrl: z.string().url().max(2000).nullable().optional(),
});

// ==========================================
// SUB-PAGES
// ==========================================

export const createSubPageSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Sub-page'),
  contentJson: z.any().optional(),
  contentHtml: z.string().max(5000000).optional(),
  icon: z.string().max(50).optional(),
});

// ==========================================
// PUBLISHING
// ==========================================

export const publishDocSchema = z.object({
  customSlug: z.string().max(200).optional(),
});

// ==========================================
// DOC COMMENTS (Enhanced)
// ==========================================

export const createDocCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  highlightedText: z.string().max(5000).optional(),
  positionJson: z.any().optional(),
  parentCommentId: z.string().uuid().optional(),
});

export const updateDocCommentSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  isResolved: z.boolean().optional(),
});

// ==========================================
// TEMPLATES
// ==========================================

export const createDocTemplateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().max(5000000),
  contentJson: z.any().optional(),
  category: z.string().max(100).optional(),
});

export const createFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  parentDocId: z.string().uuid().optional(),
});

export const saveAsTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
});

// ==========================================
// TASK LINKING
// ==========================================

export const linkDocToTaskSchema = z.object({
  taskId: z.string().uuid(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type DocsHubQuery = z.infer<typeof docsHubQuerySchema>;
export type CreateDocInput = z.infer<typeof createDocSchema>;
export type UpdateDocInput = z.infer<typeof updateDocSchema>;
export type CreateSubPageInput = z.infer<typeof createSubPageSchema>;
export type PublishDocInput = z.infer<typeof publishDocSchema>;
export type CreateDocCommentInput = z.infer<typeof createDocCommentSchema>;
export type UpdateDocCommentInput = z.infer<typeof updateDocCommentSchema>;
export type CreateDocTemplateInput = z.infer<typeof createDocTemplateSchema>;
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;
export type LinkDocToTaskInput = z.infer<typeof linkDocToTaskSchema>;
