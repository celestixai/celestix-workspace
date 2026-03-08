import { z } from 'zod';

// ==========================================
// DOCUMENT SCHEMAS
// ==========================================

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Document'),
  contentJson: z.any().optional(),
  contentHtml: z.string().max(5000000).optional(),
  templateId: z.string().max(100).optional(),
  isPublic: z.boolean().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  contentJson: z.any().optional(),
  contentHtml: z.string().max(5000000).nullable().optional(),
  wordCount: z.number().int().min(0).optional(),
  isPublic: z.boolean().optional(),
});

// ==========================================
// COMMENT SCHEMAS
// ==========================================

export const createCommentSchema = z.object({
  text: z.string().min(1).max(10000),
  selectionFrom: z.number().int().min(0).optional(),
  selectionTo: z.number().int().min(0).optional(),
  parentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1).max(10000),
});

// ==========================================
// COLLABORATOR SCHEMAS
// ==========================================

export const addCollaboratorSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['view', 'comment', 'edit']).default('edit'),
});

// ==========================================
// VERSION SCHEMAS
// ==========================================

export const createVersionSchema = z.object({
  contentJson: z.any(),
  comment: z.string().max(500).optional(),
});

// ==========================================
// EXPORT SCHEMA
// ==========================================

export const exportDocumentSchema = z.object({
  format: z.enum(['pdf', 'docx', 'html', 'markdown', 'txt']),
});

// ==========================================
// IMPORT SCHEMA
// ==========================================

export const importDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  contentHtml: z.string().max(5000000).optional(),
  contentJson: z.any().optional(),
  format: z.enum(['html', 'markdown', 'txt']).optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
export type ImportDocumentInput = z.infer<typeof importDocumentSchema>;
