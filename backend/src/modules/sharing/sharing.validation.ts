import { z } from 'zod';

const itemTypes = ['SPACE', 'FOLDER', 'LIST', 'TASK', 'DOC'] as const;
const permissions = ['VIEW', 'COMMENT', 'EDIT', 'FULL'] as const;

export const shareItemSchema = z.object({
  itemType: z.enum(itemTypes),
  itemId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1),
  permission: z.enum(permissions).optional().default('VIEW'),
});

export const updateShareSchema = z.object({
  permission: z.enum(permissions),
});

export const createPublicLinkSchema = z.object({
  itemType: z.enum(itemTypes),
  itemId: z.string().uuid(),
  permission: z.enum(permissions).optional().default('VIEW'),
  password: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const accessPublicLinkSchema = z.object({
  password: z.string().optional(),
});

export type ShareItemInput = z.infer<typeof shareItemSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;
export type CreatePublicLinkInput = z.infer<typeof createPublicLinkSchema>;
export type AccessPublicLinkInput = z.infer<typeof accessPublicLinkSchema>;
