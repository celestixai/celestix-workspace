import { Router, Request, Response } from 'express';
import { spreadsheetService } from './spreadsheets.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createSpreadsheetSchema,
  updateSpreadsheetSchema,
  updateCellsSchema,
  addSheetSchema,
  deleteSheetSchema,
  duplicateSheetSchema,
  importDataSchema,
} from './spreadsheets.schema';

const router = Router();

// ==========================================
// SPREADSHEET CRUD
// ==========================================

// GET /api/v1/spreadsheets
router.get('/', authenticate, async (req: Request, res: Response) => {
  const spreadsheets = await spreadsheetService.getAll(req.user!.id);
  res.json({ success: true, data: spreadsheets });
});

// POST /api/v1/spreadsheets
router.post('/', authenticate, validate(createSpreadsheetSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: spreadsheet });
});

// GET /api/v1/spreadsheets/:spreadsheetId
router.get('/:spreadsheetId', authenticate, async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.getById(req.user!.id, req.params.spreadsheetId);
  res.json({ success: true, data: spreadsheet });
});

// PATCH /api/v1/spreadsheets/:spreadsheetId
router.patch('/:spreadsheetId', authenticate, validate(updateSpreadsheetSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.update(req.user!.id, req.params.spreadsheetId, req.body);
  res.json({ success: true, data: spreadsheet });
});

// DELETE /api/v1/spreadsheets/:spreadsheetId
router.delete('/:spreadsheetId', authenticate, async (req: Request, res: Response) => {
  await spreadsheetService.delete(req.user!.id, req.params.spreadsheetId);
  res.json({ success: true, data: { message: 'Spreadsheet deleted' } });
});

// ==========================================
// SHEET DATA
// ==========================================

// GET /api/v1/spreadsheets/:spreadsheetId/sheets/:sheetIndex
router.get('/:spreadsheetId/sheets/:sheetIndex', authenticate, async (req: Request, res: Response) => {
  const sheetIndex = parseInt(req.params.sheetIndex, 10);
  const sheet = await spreadsheetService.getSheetData(req.user!.id, req.params.spreadsheetId, sheetIndex);
  res.json({ success: true, data: sheet });
});

// ==========================================
// CELL UPDATES
// ==========================================

// PATCH /api/v1/spreadsheets/:spreadsheetId/cells
router.patch('/:spreadsheetId/cells', authenticate, validate(updateCellsSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.updateCells(req.user!.id, req.params.spreadsheetId, req.body);
  res.json({ success: true, data: spreadsheet });
});

// ==========================================
// SHEET MANAGEMENT
// ==========================================

// POST /api/v1/spreadsheets/:spreadsheetId/sheets
router.post('/:spreadsheetId/sheets', authenticate, validate(addSheetSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.addSheet(req.user!.id, req.params.spreadsheetId, req.body);
  res.status(201).json({ success: true, data: spreadsheet });
});

// DELETE /api/v1/spreadsheets/:spreadsheetId/sheets
router.delete('/:spreadsheetId/sheets', authenticate, validate(deleteSheetSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.deleteSheet(req.user!.id, req.params.spreadsheetId, req.body);
  res.json({ success: true, data: spreadsheet });
});

// POST /api/v1/spreadsheets/:spreadsheetId/sheets/duplicate
router.post('/:spreadsheetId/sheets/duplicate', authenticate, validate(duplicateSheetSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.duplicateSheet(req.user!.id, req.params.spreadsheetId, req.body);
  res.status(201).json({ success: true, data: spreadsheet });
});

// ==========================================
// IMPORT DATA
// ==========================================

// POST /api/v1/spreadsheets/:spreadsheetId/import
router.post('/:spreadsheetId/import', authenticate, validate(importDataSchema), async (req: Request, res: Response) => {
  const spreadsheet = await spreadsheetService.importData(req.user!.id, req.params.spreadsheetId, req.body);
  res.json({ success: true, data: spreadsheet });
});

export default router;
