import { z } from 'zod';

// ==========================================
// SITE SCHEMAS
// ==========================================

export const createSiteSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['TEAM', 'COMMUNICATION']).optional(),
  description: z.string().max(2000).optional(),
  logoPath: z.string().max(500).optional(),
  theme: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    font: z.string().max(100).optional(),
  }).optional(),
  navigation: z.array(z.any()).optional(),
});

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  logoPath: z.string().max(500).nullable().optional(),
  theme: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    font: z.string().max(100).optional(),
  }).optional(),
  navigation: z.array(z.any()).optional(),
});

// ==========================================
// PAGE SCHEMAS
// ==========================================

export const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  sections: z.array(z.any()).optional(),
  isHomepage: z.boolean().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  sections: z.array(z.any()).optional(),
  isPublished: z.boolean().optional(),
  isHomepage: z.boolean().optional(),
});

// ==========================================
// NEWS POST SCHEMAS
// ==========================================

export const createNewsPostSchema = z.object({
  title: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(100000),
  coverImage: z.string().max(500).optional(),
  isPinned: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
});

export const updateNewsPostSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  bodyHtml: z.string().min(1).max(100000).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  isPinned: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

// ==========================================
// NEWS COMMENT SCHEMAS
// ==========================================

export const createNewsCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateNewsPostInput = z.infer<typeof createNewsPostSchema>;
export type UpdateNewsPostInput = z.infer<typeof updateNewsPostSchema>;
export type CreateNewsCommentInput = z.infer<typeof createNewsCommentSchema>;
