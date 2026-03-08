import { z } from 'zod';

// ==========================================
// PROJECT SCHEMAS
// ==========================================

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']).optional(),
  timeline: z.object({
    tracks: z.array(z.any()).optional(),
    duration: z.number().min(0).optional(),
  }).optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']).optional(),
  timeline: z.object({
    tracks: z.array(z.any()),
    duration: z.number().min(0),
  }).optional(),
});

// ==========================================
// EXPORT JOB SCHEMAS
// ==========================================

export const createExportJobSchema = z.object({
  resolution: z.enum(['480p', '720p', '1080p', '1440p', '4k']).optional(),
  format: z.enum(['mp4', 'webm', 'mov', 'gif']).optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;
