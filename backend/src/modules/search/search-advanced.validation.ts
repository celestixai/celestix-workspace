import { z } from 'zod';

export const advancedSearchSchema = z.object({
  q: z.string().min(1).max(500),
  workspaceId: z.string().uuid().optional(),
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : undefined)),
  spaceId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  sortBy: z.enum(['relevance', 'date', 'title']).optional().default('relevance'),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 20;
      return Math.min(Math.max(n, 1), 100);
    }),
});

export const deepSearchSchema = z.object({
  q: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),
});

export const saveSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.record(z.unknown()),
});
