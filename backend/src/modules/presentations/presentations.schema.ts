import { z } from 'zod';

export const createPresentationSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Presentation'),
  theme: z.string().max(50).default('default'),
  slideSize: z.string().max(20).default('16:9'),
});

export const updatePresentationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  theme: z.string().max(50).optional(),
  slides: z.array(z.any()).optional(),
  isPublic: z.boolean().optional(),
});

export const addSlideSchema = z.object({
  slide: z.object({
    layout: z.string().default('blank'),
    elements: z.array(z.any()).default([]),
    notes: z.string().optional(),
    background: z.any().optional(),
    transition: z.string().optional(),
  }),
  position: z.number().int().min(0).optional(),
});

export const updateSlideSchema = z.object({
  slide: z.object({
    layout: z.string().optional(),
    elements: z.array(z.any()).optional(),
    notes: z.string().optional(),
    background: z.any().optional(),
    transition: z.string().optional(),
  }),
});

export const reorderSlidesSchema = z.object({
  order: z.array(z.number().int().min(0)),
});

export type CreatePresentationInput = z.infer<typeof createPresentationSchema>;
export type UpdatePresentationInput = z.infer<typeof updatePresentationSchema>;
export type AddSlideInput = z.infer<typeof addSlideSchema>;
export type UpdateSlideInput = z.infer<typeof updateSlideSchema>;
export type ReorderSlidesInput = z.infer<typeof reorderSlidesSchema>;
