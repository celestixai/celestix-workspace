import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateSpreadsheetInput,
  UpdateSpreadsheetInput,
  UpdateCellsInput,
  AddSheetInput,
  DeleteSheetInput,
  DuplicateSheetInput,
  ImportDataInput,
} from './spreadsheets.schema';

interface SheetData {
  name: string;
  cells: Record<string, unknown>;
  merges: unknown[];
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

interface SpreadsheetData {
  sheets: SheetData[];
}

const DEFAULT_SHEET_DATA: SpreadsheetData = {
  sheets: [
    {
      name: 'Sheet1',
      cells: {},
      merges: [],
      columnWidths: {},
      rowHeights: {},
    },
  ],
};

export class SpreadsheetService {
  // ==================================
  // CRUD
  // ==================================

  async create(userId: string, input: CreateSpreadsheetInput) {
    const spreadsheet = await prisma.spreadsheet.create({
      data: {
        userId,
        title: input.title,
        data: (input.data ?? DEFAULT_SHEET_DATA) as Prisma.InputJsonValue,
        isPublic: input.isPublic ?? false,
      },
    });

    return spreadsheet;
  }

  async getAll(userId: string) {
    const spreadsheets = await prisma.spreadsheet.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return spreadsheets;
  }

  async getById(userId: string, spreadsheetId: string) {
    const spreadsheet = await prisma.spreadsheet.findFirst({
      where: {
        id: spreadsheetId,
        OR: [
          { userId },
          { isPublic: true },
        ],
      },
    });

    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    return spreadsheet;
  }

  async update(userId: string, spreadsheetId: string, input: UpdateSpreadsheetInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: {
        title: input.title,
        data: input.data as Prisma.InputJsonValue,
        isPublic: input.isPublic,
      },
    });

    return spreadsheet;
  }

  async delete(userId: string, spreadsheetId: string) {
    await this.requireOwnership(userId, spreadsheetId);
    await prisma.spreadsheet.delete({ where: { id: spreadsheetId } });
  }

  // ==================================
  // SHEET DATA OPERATIONS
  // ==================================

  async getSheetData(userId: string, spreadsheetId: string, sheetIndex: number) {
    const spreadsheet = await this.getById(userId, spreadsheetId);
    const data = spreadsheet.data as unknown as SpreadsheetData;

    if (!data.sheets || sheetIndex < 0 || sheetIndex >= data.sheets.length) {
      throw new AppError(400, 'Sheet index out of range', 'INVALID_SHEET_INDEX');
    }

    return data.sheets[sheetIndex];
  }

  async updateCells(userId: string, spreadsheetId: string, input: UpdateCellsInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    const data = spreadsheet.data as unknown as SpreadsheetData;

    if (!data.sheets || input.sheetIndex < 0 || input.sheetIndex >= data.sheets.length) {
      throw new AppError(400, 'Sheet index out of range', 'INVALID_SHEET_INDEX');
    }

    // Merge the cell updates into the existing cells
    const sheet = data.sheets[input.sheetIndex];
    for (const [cellRef, cellValue] of Object.entries(input.cells)) {
      if (cellValue === null || cellValue === undefined) {
        delete sheet.cells[cellRef];
      } else {
        sheet.cells[cellRef] = cellValue;
      }
    }

    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { data: data as unknown as Prisma.InputJsonValue },
    });

    return updated;
  }

  // ==================================
  // SHEET MANAGEMENT
  // ==================================

  async addSheet(userId: string, spreadsheetId: string, input: AddSheetInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    const data = spreadsheet.data as unknown as SpreadsheetData;
    if (!data.sheets) data.sheets = [];

    // Generate unique sheet name if default
    let name = input.name;
    if (name === 'Sheet') {
      const existingNames = new Set(data.sheets.map((s) => s.name));
      let counter = data.sheets.length + 1;
      name = `Sheet${counter}`;
      while (existingNames.has(name)) {
        counter++;
        name = `Sheet${counter}`;
      }
    }

    const newSheet: SheetData = {
      name,
      cells: {},
      merges: [],
      columnWidths: {},
      rowHeights: {},
    };

    const insertIndex = input.index !== undefined && input.index <= data.sheets.length
      ? input.index
      : data.sheets.length;

    data.sheets.splice(insertIndex, 0, newSheet);

    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { data: data as unknown as Prisma.InputJsonValue },
    });

    return updated;
  }

  async deleteSheet(userId: string, spreadsheetId: string, input: DeleteSheetInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    const data = spreadsheet.data as unknown as SpreadsheetData;

    if (!data.sheets || data.sheets.length <= 1) {
      throw new AppError(400, 'Cannot delete the last sheet', 'CANNOT_DELETE_LAST_SHEET');
    }

    if (input.sheetIndex < 0 || input.sheetIndex >= data.sheets.length) {
      throw new AppError(400, 'Sheet index out of range', 'INVALID_SHEET_INDEX');
    }

    data.sheets.splice(input.sheetIndex, 1);

    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { data: data as unknown as Prisma.InputJsonValue },
    });

    return updated;
  }

  async duplicateSheet(userId: string, spreadsheetId: string, input: DuplicateSheetInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    const data = spreadsheet.data as unknown as SpreadsheetData;

    if (!data.sheets || input.sheetIndex < 0 || input.sheetIndex >= data.sheets.length) {
      throw new AppError(400, 'Sheet index out of range', 'INVALID_SHEET_INDEX');
    }

    const sourceSheet = data.sheets[input.sheetIndex];

    // Deep-clone the sheet
    const clonedSheet: SheetData = JSON.parse(JSON.stringify(sourceSheet));

    // Determine the name
    const existingNames = new Set(data.sheets.map((s) => s.name));
    let newName = input.newName ?? `${sourceSheet.name} (Copy)`;
    let counter = 2;
    while (existingNames.has(newName)) {
      newName = input.newName
        ? `${input.newName} (${counter})`
        : `${sourceSheet.name} (Copy ${counter})`;
      counter++;
    }
    clonedSheet.name = newName;

    // Insert right after the source sheet
    data.sheets.splice(input.sheetIndex + 1, 0, clonedSheet);

    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { data: data as unknown as Prisma.InputJsonValue },
    });

    return updated;
  }

  // ==================================
  // IMPORT DATA
  // ==================================

  async importData(userId: string, spreadsheetId: string, input: ImportDataInput) {
    await this.requireOwnership(userId, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }

    const data = spreadsheet.data as unknown as SpreadsheetData;

    if (!data.sheets || input.sheetIndex < 0 || input.sheetIndex >= data.sheets.length) {
      throw new AppError(400, 'Sheet index out of range', 'INVALID_SHEET_INDEX');
    }

    const sheet = data.sheets[input.sheetIndex];

    // Convert row/col indices to cell references (A1 notation)
    for (let rowIdx = 0; rowIdx < input.rows.length; rowIdx++) {
      const row = input.rows[rowIdx];
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cellRef = this.toCellRef(input.startCol + colIdx, input.startRow + rowIdx);
        if (row[colIdx] !== null && row[colIdx] !== undefined && row[colIdx] !== '') {
          sheet.cells[cellRef] = { value: row[colIdx] };
        }
      }
    }

    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { data: data as unknown as Prisma.InputJsonValue },
    });

    return updated;
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireOwnership(userId: string, spreadsheetId: string) {
    const spreadsheet = await prisma.spreadsheet.findFirst({
      where: { id: spreadsheetId, userId },
      select: { id: true },
    });

    if (!spreadsheet) {
      throw new AppError(404, 'Spreadsheet not found', 'NOT_FOUND');
    }
  }

  private toCellRef(col: number, row: number): string {
    let colStr = '';
    let c = col;
    while (c >= 0) {
      colStr = String.fromCharCode(65 + (c % 26)) + colStr;
      c = Math.floor(c / 26) - 1;
    }
    return `${colStr}${row + 1}`;
  }
}

export const spreadsheetService = new SpreadsheetService();
