import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentFolderId: z.string().uuid().optional().nullable(),
});

export const renameFileSchema = z.object({
  name: z.string().min(1).max(255),
});

export const moveFileSchema = z.object({
  parentFolderId: z.string().uuid().nullable(),
});

export const shareFileSchema = z.object({
  sharedWithUserId: z.string().uuid().optional(),
  permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
  password: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  generateLink: z.boolean().optional().default(false),
});

export const filesQuerySchema = z.object({
  parentFolderId: z.string().uuid().optional().nullable(),
  search: z.string().optional(),
  type: z.enum(['FILE', 'FOLDER']).optional(),
  starred: z.coerce.boolean().optional(),
  trashed: z.coerce.boolean().optional(),
  recent: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.enum(['name', 'updatedAt', 'sizeBytes', 'type']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkOperationSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['delete', 'restore', 'permanentDelete', 'star', 'unstar', 'move']),
  targetFolderId: z.string().uuid().optional().nullable(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type FilesQuery = z.infer<typeof filesQuerySchema>;
