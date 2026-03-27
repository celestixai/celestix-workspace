import { z } from 'zod';

// ==========================================
// REPORT SCHEMAS
// ==========================================

export const createReportSchema = z.object({
  title: z.string().min(1).max(200),
  dataSourceId: z.string().uuid().optional(),
  pages: z.array(z.any()).optional(),
  filters: z.record(z.any()).optional(),
  theme: z.string().max(50).optional(),
  refreshSchedule: z.string().max(50).optional(),
  isPublic: z.boolean().optional(),
});

export const updateReportSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dataSourceId: z.string().uuid().nullable().optional(),
  pages: z.array(z.any()).optional(),
  filters: z.record(z.any()).nullable().optional(),
  theme: z.string().max(50).optional(),
  refreshSchedule: z.string().max(50).nullable().optional(),
  isPublic: z.boolean().optional(),
});

// ==========================================
// DATA SOURCE SCHEMAS
// ==========================================

export const createDataSourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['csv', 'spreadsheet', 'list', 'form', 'api']),
  config: z.record(z.any()),
});

export const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['csv', 'spreadsheet', 'list', 'form', 'api']).optional(),
  config: z.record(z.any()).optional(),
});

// ==========================================
// QUERY DATA SCHEMA
// ==========================================

export const queryDataSchema = z.object({
  filters: z.record(z.any()).optional(),
  groupBy: z.array(z.string()).optional(),
  aggregations: z.array(z.object({
    field: z.string(),
    function: z.enum(['sum', 'avg', 'count', 'min', 'max']),
    alias: z.string().optional(),
  })).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().min(1).max(10000).optional().default(1000),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;
export type QueryDataInput = z.infer<typeof queryDataSchema>;
