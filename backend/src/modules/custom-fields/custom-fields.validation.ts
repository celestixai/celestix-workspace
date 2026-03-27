import { z } from 'zod';

// ==========================================
// Field Definitions
// ==========================================

export const createFieldSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  fieldType: z.enum([
    'TEXT', 'LONG_TEXT', 'NUMBER', 'MONEY', 'DROPDOWN', 'MULTI_SELECT',
    'LABEL', 'DATE', 'CHECKBOX', 'EMAIL', 'PHONE', 'URL', 'RATING',
    'PROGRESS', 'FILE', 'RELATIONSHIP', 'FORMULA', 'ROLLUP', 'LOCATION',
    'VOTING', 'PEOPLE',
  ]),
  config: z.any().optional(),
  isRequired: z.boolean().optional(),
});

export const updateFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  config: z.any().optional(),
  isRequired: z.boolean().optional(),
});

// ==========================================
// Field Locations
// ==========================================

export const addLocationSchema = z.object({
  locationType: z.enum(['WORKSPACE', 'SPACE', 'FOLDER', 'LIST']),
  locationId: z.string().uuid(),
  isVisible: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// ==========================================
// Field Values
// ==========================================

export const setValueSchema = z.object({
  valueText: z.string().optional(),
  valueNumber: z.number().optional(),
  valueDate: z.string().datetime().optional(),
  valueBoolean: z.boolean().optional(),
  valueJson: z.any().optional(),
});

export const bulkSetValuesSchema = z.object({
  values: z.array(z.object({
    fieldId: z.string().uuid(),
    valueText: z.string().optional(),
    valueNumber: z.number().optional(),
    valueDate: z.string().datetime().optional(),
    valueBoolean: z.boolean().optional(),
    valueJson: z.any().optional(),
  })).min(1),
});

// ==========================================
// Filtering
// ==========================================

export const filterTasksSchema = z.object({
  fieldId: z.string().uuid(),
  operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'empty', 'not_empty']),
  value: z.any().optional(),
  listId: z.string().uuid().optional(),
});

// ==========================================
// Type exports
// ==========================================

export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type AddLocationInput = z.infer<typeof addLocationSchema>;
export type SetValueInput = z.infer<typeof setValueSchema>;
export type BulkSetValuesInput = z.infer<typeof bulkSetValuesSchema>;
export type FilterTasksInput = z.infer<typeof filterTasksSchema>;
