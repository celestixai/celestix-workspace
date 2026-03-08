import { z } from 'zod';

export const createAnnotationSchema = z.object({
  fileId: z.string().uuid(),
  pageNumber: z.number().int().min(1),
  type: z.enum([
    'highlight',
    'underline',
    'strikethrough',
    'note',
    'drawing',
    'textbox',
    'shape',
    'signature',
  ]),
  data: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    content: z.string().optional(),
    color: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rects: z.array(z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })).optional(),
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
  }).passthrough(),
});

export const updateAnnotationSchema = z.object({
  type: z.enum([
    'highlight',
    'underline',
    'strikethrough',
    'note',
    'drawing',
    'textbox',
    'shape',
    'signature',
  ]).optional(),
  data: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    content: z.string().optional(),
    color: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rects: z.array(z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })).optional(),
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
  }).passthrough().optional(),
});

export const mergeFilesSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(2, 'At least two files required for merge'),
  outputName: z.string().min(1).max(255).default('merged.pdf'),
});

export const splitFileSchema = z.object({
  fileId: z.string().uuid(),
  ranges: z.array(z.object({
    start: z.number().int().min(1),
    end: z.number().int().min(1),
  })).min(1, 'At least one page range required'),
});

export const rotatePagesSchema = z.object({
  fileId: z.string().uuid(),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    degrees: z.enum(['90', '180', '270']),
  })).min(1),
});

export const addWatermarkSchema = z.object({
  fileId: z.string().uuid(),
  type: z.enum(['text', 'image']),
  text: z.string().max(200).optional(),
  imageFileId: z.string().uuid().optional(),
  position: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('center'),
  opacity: z.number().min(0).max(1).default(0.3),
  fontSize: z.number().int().min(8).max(200).optional(),
  rotation: z.number().min(-360).max(360).default(-45),
  pages: z.enum(['all', 'odd', 'even', 'first', 'last']).default('all'),
});

export const compressSchema = z.object({
  fileId: z.string().uuid(),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const protectSchema = z.object({
  fileId: z.string().uuid(),
  userPassword: z.string().min(1).max(128).optional(),
  ownerPassword: z.string().min(1).max(128),
  permissions: z.object({
    printing: z.boolean().default(true),
    copying: z.boolean().default(false),
    modifying: z.boolean().default(false),
  }).optional(),
});

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type MergeFilesInput = z.infer<typeof mergeFilesSchema>;
export type SplitFileInput = z.infer<typeof splitFileSchema>;
export type RotatePagesInput = z.infer<typeof rotatePagesSchema>;
export type AddWatermarkInput = z.infer<typeof addWatermarkSchema>;
export type CompressInput = z.infer<typeof compressSchema>;
export type ProtectInput = z.infer<typeof protectSchema>;
