import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled'),
  contentJson: z.any().optional(),
  contentText: z.string().optional(),
  folderId: z.string().uuid().optional().nullable(),
  parentNoteId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
});

export const updateNoteSchema = z.object({
  title: z.string().max(500).optional(),
  contentJson: z.any().optional(),
  contentText: z.string().optional(),
  folderId: z.string().uuid().optional().nullable(),
  isPinned: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentFolderId: z.string().uuid().optional().nullable(),
  icon: z.string().max(10).optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  position: z.number().optional(),
});

export const shareNoteSchema = z.object({
  userId: z.string().uuid().optional(),
  permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
  generateLink: z.boolean().optional().default(false),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4F8EF7'),
});

export const notesQuerySchema = z.object({
  folderId: z.string().uuid().optional().nullable(),
  search: z.string().optional(),
  tag: z.string().optional(),
  starred: z.coerce.boolean().optional(),
  pinned: z.coerce.boolean().optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
