import { z } from 'zod';

// ==========================================
// SPREADSHEET SCHEMAS
// ==========================================

export const createSpreadsheetSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Spreadsheet'),
  data: z.any().optional(),
  isPublic: z.boolean().optional(),
});

export const updateSpreadsheetSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  data: z.any().optional(),
  isPublic: z.boolean().optional(),
});

// ==========================================
// CELL UPDATE SCHEMA
// ==========================================

export const updateCellsSchema = z.object({
  sheetIndex: z.number().int().min(0),
  cells: z.record(z.string(), z.any()),
  // cells is a map like { "A1": { value: "hello", formula: "=SUM(B1:B5)", ... }, "B2": { value: 42 } }
});

// ==========================================
// SHEET MANAGEMENT SCHEMAS
// ==========================================

export const addSheetSchema = z.object({
  name: z.string().min(1).max(100).default('Sheet'),
  index: z.number().int().min(0).optional(),
});

export const deleteSheetSchema = z.object({
  sheetIndex: z.number().int().min(0),
});

export const duplicateSheetSchema = z.object({
  sheetIndex: z.number().int().min(0),
  newName: z.string().min(1).max(100).optional(),
});

// ==========================================
// IMPORT DATA SCHEMA
// ==========================================

export const importDataSchema = z.object({
  sheetIndex: z.number().int().min(0).default(0),
  rows: z.array(z.array(z.any())),
  startRow: z.number().int().min(0).default(0),
  startCol: z.number().int().min(0).default(0),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateSpreadsheetInput = z.infer<typeof createSpreadsheetSchema>;
export type UpdateSpreadsheetInput = z.infer<typeof updateSpreadsheetSchema>;
export type UpdateCellsInput = z.infer<typeof updateCellsSchema>;
export type AddSheetInput = z.infer<typeof addSheetSchema>;
export type DeleteSheetInput = z.infer<typeof deleteSheetSchema>;
export type DuplicateSheetInput = z.infer<typeof duplicateSheetSchema>;
export type ImportDataInput = z.infer<typeof importDataSchema>;
