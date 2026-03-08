import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Table2,
  Plus,
  ArrowLeft,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Paintbrush,
  Type,
  Columns,
  Rows,
  Trash2,
  Copy,
  Clipboard,
  Scissors,
  MoreHorizontal,
  X,
  Grid3X3,
  Search,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface CellData {
  value: string;
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: 'general' | 'number' | 'currency' | 'percent' | 'date';
  fillColor?: string;
  textColor?: string;
}

interface Sheet {
  id: string;
  name: string;
  cells: Record<string, CellData>;
  colWidths: Record<number, number>;
}

interface Spreadsheet {
  id: string;
  title: string;
  sheets: Sheet[];
  activeSheetId: string;
  createdAt: string;
  updatedAt: string;
}

interface CellRef {
  col: number;
  row: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

function cellKey(col: number, row: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

function parseCellRef(ref: string): CellRef | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let col = 0;
  for (let i = 0; i < match[1].length; i++) {
    col = col * 26 + (match[1].charCodeAt(i) - 64);
  }
  return { col: col - 1, row: parseInt(match[2]) - 1 };
}

const DEFAULT_COL_WIDTH = 100;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const ROW_HEADER_WIDTH = 48;
const VISIBLE_ROWS = 50;
const VISIBLE_COLS = 26;

const NUMBER_FORMATS = [
  { value: 'general', label: 'General' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
];

// ──────────────────────────────────────────────
// Formula evaluation (basic)
// ──────────────────────────────────────────────

function evaluateFormula(formula: string, cells: Record<string, CellData>): string {
  if (!formula.startsWith('=')) return formula;
  const expr = formula.slice(1).trim();

  try {
    // Handle SUM(A1:A5) pattern
    const sumMatch = expr.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
    if (sumMatch) {
      const start = parseCellRef(sumMatch[1].toUpperCase());
      const end = parseCellRef(sumMatch[2].toUpperCase());
      if (start && end) {
        let sum = 0;
        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
            const key = cellKey(c, r);
            const val = parseFloat(cells[key]?.value || '0');
            if (!isNaN(val)) sum += val;
          }
        }
        return String(sum);
      }
    }

    // Handle AVERAGE(A1:A5)
    const avgMatch = expr.match(/^AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
    if (avgMatch) {
      const start = parseCellRef(avgMatch[1].toUpperCase());
      const end = parseCellRef(avgMatch[2].toUpperCase());
      if (start && end) {
        let sum = 0;
        let count = 0;
        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
            const key = cellKey(c, r);
            const val = parseFloat(cells[key]?.value || '');
            if (!isNaN(val)) {
              sum += val;
              count++;
            }
          }
        }
        return count > 0 ? String(sum / count) : '0';
      }
    }

    // Handle COUNT(A1:A5)
    const countMatch = expr.match(/^COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
    if (countMatch) {
      const start = parseCellRef(countMatch[1].toUpperCase());
      const end = parseCellRef(countMatch[2].toUpperCase());
      if (start && end) {
        let count = 0;
        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
            const key = cellKey(c, r);
            const val = parseFloat(cells[key]?.value || '');
            if (!isNaN(val)) count++;
          }
        }
        return String(count);
      }
    }

    // Simple cell reference arithmetic: =A1+B1, =A1*2, etc.
    const resolved = expr.replace(/[A-Z]+\d+/g, (ref) => {
      const cell = cells[ref];
      const val = cell?.value || '0';
      const num = parseFloat(val);
      return isNaN(num) ? '0' : String(num);
    });

    // Safe eval for arithmetic only
    if (/^[\d\s+\-*/().]+$/.test(resolved)) {
      const result = new Function(`return (${resolved})`)();
      return String(result);
    }

    return formula;
  } catch {
    return '#ERROR';
  }
}

function formatCellValue(value: string, format?: string): string {
  if (!format || format === 'general') return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  switch (format) {
    case 'number':
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'currency':
      return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    case 'percent':
      return (num * 100).toFixed(1) + '%';
    case 'date':
      try {
        return new Date(num).toLocaleDateString();
      } catch {
        return value;
      }
    default:
      return value;
  }
}

// ──────────────────────────────────────────────
// Spreadsheet Card
// ──────────────────────────────────────────────

function SpreadsheetCard({
  sheet,
  onOpen,
  onDelete,
}: {
  sheet: Spreadsheet;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="bg-bg-secondary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-accent-blue/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Table2 size={20} className="text-green-400" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <h3 className="text-sm font-medium text-text-primary truncate mb-1">
        {sheet.title || 'Untitled Spreadsheet'}
      </h3>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span>{sheet.sheets.length} sheet{sheet.sheets.length !== 1 ? 's' : ''}</span>
        <span>{new Date(sheet.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Context Menu
// ──────────────────────────────────────────────

function ContextMenu({
  x,
  y,
  onClose,
  onAction,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const items = [
    { action: 'cut', label: 'Cut', icon: <Scissors size={14} /> },
    { action: 'copy', label: 'Copy', icon: <Copy size={14} /> },
    { action: 'paste', label: 'Paste', icon: <Clipboard size={14} /> },
    { action: 'separator', label: '', icon: null },
    { action: 'insertRowAbove', label: 'Insert row above', icon: <Rows size={14} /> },
    { action: 'insertRowBelow', label: 'Insert row below', icon: <Rows size={14} /> },
    { action: 'insertColLeft', label: 'Insert column left', icon: <Columns size={14} /> },
    { action: 'insertColRight', label: 'Insert column right', icon: <Columns size={14} /> },
    { action: 'separator2', label: '', icon: null },
    { action: 'deleteRow', label: 'Delete row', icon: <Trash2 size={14} /> },
    { action: 'deleteCol', label: 'Delete column', icon: <Trash2 size={14} /> },
  ];

  return (
    <div
      className="fixed bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item) =>
        item.action.startsWith('separator') ? (
          <div key={item.action} className="my-1 border-t border-border-primary" />
        ) : (
          <button
            key={item.action}
            onClick={(e) => {
              e.stopPropagation();
              onAction(item.action);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-primary transition-colors"
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main: SpreadsheetsPage
// ──────────────────────────────────────────────

export function SpreadsheetsPage() {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<CellRef>({ col: 0, row: 0 });
  const [selectionEnd, setSelectionEnd] = useState<CellRef | null>(null);
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [editValue, setEditValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [clipboard, setClipboard] = useState<{ value: string; data: CellData } | null>(null);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load from API
  useEffect(() => {
    api.get('/spreadsheets').then((data: Spreadsheet[]) => {
      if (Array.isArray(data)) setSpreadsheets(data);
    }).catch(() => {});
  }, []);

  const activeSpreadsheet = spreadsheets.find((s) => s.id === activeSpreadsheetId) ?? null;
  const activeSheet = activeSpreadsheet?.sheets.find(
    (s) => s.id === activeSpreadsheet.activeSheetId
  ) ?? null;

  // Helpers
  const getColWidth = useCallback(
    (col: number): number => {
      return activeSheet?.colWidths[col] ?? DEFAULT_COL_WIDTH;
    },
    [activeSheet]
  );

  const getCellData = useCallback(
    (col: number, row: number): CellData => {
      if (!activeSheet) return { value: '' };
      return activeSheet.cells[cellKey(col, row)] ?? { value: '' };
    },
    [activeSheet]
  );

  const getCellDisplayValue = useCallback(
    (col: number, row: number): string => {
      const cell = getCellData(col, row);
      const rawValue = cell.formula
        ? evaluateFormula(cell.formula, activeSheet?.cells ?? {})
        : cell.value;
      return formatCellValue(rawValue, cell.format);
    },
    [getCellData, activeSheet]
  );

  // Update spreadsheet helper
  const updateSpreadsheet = useCallback(
    (updater: (ss: Spreadsheet) => Spreadsheet) => {
      setSpreadsheets((prev) =>
        prev.map((s) =>
          s.id === activeSpreadsheetId
            ? updater({ ...s, updatedAt: new Date().toISOString() })
            : s
        )
      );
    },
    [activeSpreadsheetId]
  );

  const updateActiveSheet = useCallback(
    (updater: (sheet: Sheet) => Sheet) => {
      updateSpreadsheet((ss) => ({
        ...ss,
        sheets: ss.sheets.map((sh) =>
          sh.id === ss.activeSheetId ? updater(sh) : sh
        ),
      }));
    },
    [updateSpreadsheet]
  );

  const setCellData = useCallback(
    (col: number, row: number, data: Partial<CellData>) => {
      updateActiveSheet((sheet) => {
        const key = cellKey(col, row);
        const existing = sheet.cells[key] ?? { value: '' };
        return {
          ...sheet,
          cells: {
            ...sheet.cells,
            [key]: { ...existing, ...data },
          },
        };
      });
    },
    [updateActiveSheet]
  );

  // Sync formula bar with active cell
  useEffect(() => {
    const cell = getCellData(activeCell.col, activeCell.row);
    setFormulaBarValue(cell.formula ?? cell.value);
  }, [activeCell, getCellData]);

  // Commit cell edit
  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const value = editValue;
    if (value.startsWith('=')) {
      setCellData(editingCell.col, editingCell.row, { formula: value, value: '' });
    } else {
      setCellData(editingCell.col, editingCell.row, { value, formula: undefined });
    }
    setEditingCell(null);
  }, [editingCell, editValue, setCellData]);

  // Start editing
  const startEdit = useCallback(
    (col: number, row: number, initialValue?: string) => {
      const cell = getCellData(col, row);
      setEditingCell({ col, row });
      setEditValue(initialValue ?? cell.formula ?? cell.value);
      setTimeout(() => editInputRef.current?.focus(), 0);
    },
    [getCellData]
  );

  // Keyboard navigation
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return;

      const move = (dc: number, dr: number) => {
        e.preventDefault();
        const newCol = Math.max(0, Math.min(VISIBLE_COLS - 1, activeCell.col + dc));
        const newRow = Math.max(0, Math.min(VISIBLE_ROWS - 1, activeCell.row + dr));
        if (e.shiftKey) {
          setSelectionEnd({ col: newCol, row: newRow });
        } else {
          setSelectionEnd(null);
        }
        setActiveCell({ col: newCol, row: newRow });
      };

      switch (e.key) {
        case 'ArrowUp':
          move(0, -1);
          break;
        case 'ArrowDown':
          move(0, 1);
          break;
        case 'ArrowLeft':
          move(-1, 0);
          break;
        case 'ArrowRight':
          move(1, 0);
          break;
        case 'Tab':
          e.preventDefault();
          move(e.shiftKey ? -1 : 1, 0);
          break;
        case 'Enter':
          e.preventDefault();
          startEdit(activeCell.col, activeCell.row);
          break;
        case 'Delete':
        case 'Backspace':
          setCellData(activeCell.col, activeCell.row, { value: '', formula: undefined });
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            startEdit(activeCell.col, activeCell.row, e.key);
          }
          break;
      }
    },
    [activeCell, editingCell, startEdit, setCellData]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitEdit();
        setActiveCell((prev) => ({
          col: prev.col,
          row: Math.min(VISIBLE_ROWS - 1, prev.row + 1),
        }));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        setActiveCell((prev) => ({
          col: Math.min(VISIBLE_COLS - 1, prev.col + 1),
          row: prev.row,
        }));
      } else if (e.key === 'Escape') {
        setEditingCell(null);
      }
    },
    [commitEdit]
  );

  // Selection helpers
  const isInSelection = useCallback(
    (col: number, row: number): boolean => {
      if (!selectionEnd) return false;
      const minCol = Math.min(activeCell.col, selectionEnd.col);
      const maxCol = Math.max(activeCell.col, selectionEnd.col);
      const minRow = Math.min(activeCell.row, selectionEnd.row);
      const maxRow = Math.max(activeCell.row, selectionEnd.row);
      return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
    },
    [activeCell, selectionEnd]
  );

  // Context menu actions
  const handleContextAction = useCallback(
    (action: string) => {
      const cell = getCellData(activeCell.col, activeCell.row);
      switch (action) {
        case 'cut':
          setClipboard({ value: cell.value, data: { ...cell } });
          setCellData(activeCell.col, activeCell.row, { value: '', formula: undefined });
          break;
        case 'copy':
          setClipboard({ value: cell.value, data: { ...cell } });
          break;
        case 'paste':
          if (clipboard) {
            setCellData(activeCell.col, activeCell.row, { ...clipboard.data });
          }
          break;
        case 'insertRowAbove':
        case 'insertRowBelow':
        case 'insertColLeft':
        case 'insertColRight':
        case 'deleteRow':
        case 'deleteCol':
          // These operations would require cell shifting logic.
          // For this implementation, we handle them as no-ops with a placeholder.
          break;
      }
    },
    [activeCell, getCellData, setCellData, clipboard]
  );

  // Column resize
  const handleColResizeStart = useCallback(
    (col: number, startX: number) => {
      setResizingCol(col);
      const startWidth = getColWidth(col);

      const onMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(40, startWidth + delta);
        updateActiveSheet((sheet) => ({
          ...sheet,
          colWidths: { ...sheet.colWidths, [col]: newWidth },
        }));
      };

      const onUp = () => {
        setResizingCol(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [getColWidth, updateActiveSheet]
  );

  // Sheet tab actions
  const addSheet = () => {
    const newSheet: Sheet = {
      id: generateId(),
      name: `Sheet${(activeSpreadsheet?.sheets.length ?? 0) + 1}`,
      cells: {},
      colWidths: {},
    };
    updateSpreadsheet((ss) => ({
      ...ss,
      sheets: [...ss.sheets, newSheet],
      activeSheetId: newSheet.id,
    }));
  };

  const switchSheet = (sheetId: string) => {
    updateSpreadsheet((ss) => ({ ...ss, activeSheetId: sheetId }));
    setActiveCell({ col: 0, row: 0 });
    setSelectionEnd(null);
    setEditingCell(null);
  };

  const deleteSheet = (sheetId: string) => {
    if (!activeSpreadsheet || activeSpreadsheet.sheets.length <= 1) return;
    const remaining = activeSpreadsheet.sheets.filter((s) => s.id !== sheetId);
    updateSpreadsheet((ss) => ({
      ...ss,
      sheets: remaining,
      activeSheetId:
        ss.activeSheetId === sheetId ? remaining[0].id : ss.activeSheetId,
    }));
  };

  const renameSheet = (sheetId: string, name: string) => {
    updateSpreadsheet((ss) => ({
      ...ss,
      sheets: ss.sheets.map((s) => (s.id === sheetId ? { ...s, name } : s)),
    }));
    setRenamingSheet(null);
  };

  // Spreadsheet CRUD
  const createSpreadsheet = () => {
    const sheet: Sheet = {
      id: generateId(),
      name: 'Sheet1',
      cells: {},
      colWidths: {},
    };
    const ss: Spreadsheet = {
      id: generateId(),
      title: 'Untitled Spreadsheet',
      sheets: [sheet],
      activeSheetId: sheet.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSpreadsheets((prev) => [ss, ...prev]);
    setActiveSpreadsheetId(ss.id);
    api.post('/spreadsheets', ss).catch(() => {});
  };

  const deleteSpreadsheet = (id: string) => {
    setSpreadsheets((prev) => prev.filter((s) => s.id !== id));
    if (activeSpreadsheetId === id) setActiveSpreadsheetId(null);
    api.delete(`/spreadsheets/${id}`).catch(() => {});
  };

  // Toolbar actions
  const toggleBold = () => {
    const cell = getCellData(activeCell.col, activeCell.row);
    setCellData(activeCell.col, activeCell.row, { bold: !cell.bold });
  };

  const toggleItalic = () => {
    const cell = getCellData(activeCell.col, activeCell.row);
    setCellData(activeCell.col, activeCell.row, { italic: !cell.italic });
  };

  const setAlignment = (align: 'left' | 'center' | 'right') => {
    setCellData(activeCell.col, activeCell.row, { align });
  };

  const setFormat = (format: CellData['format']) => {
    setCellData(activeCell.col, activeCell.row, { format });
    setShowFormatDropdown(false);
  };

  // Compute column offsets for virtual scrolling
  const colOffsets = useMemo(() => {
    const offsets: number[] = [0];
    for (let i = 0; i < VISIBLE_COLS; i++) {
      offsets.push(offsets[i] + getColWidth(i));
    }
    return offsets;
  }, [getColWidth]);

  const totalWidth = colOffsets[VISIBLE_COLS] ?? VISIBLE_COLS * DEFAULT_COL_WIDTH;
  const totalHeight = VISIBLE_ROWS * ROW_HEIGHT;

  // ──────────────────────────────────────────────
  // List View
  // ──────────────────────────────────────────────

  if (!activeSpreadsheet) {
    return (
      <div className="flex flex-col h-full bg-bg-primary text-text-primary">
        <header className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Spreadsheets</h1>
          <button
            onClick={createSpreadsheet}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-600/90 transition-colors"
          >
            <Plus size={16} />
            New Spreadsheet
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {spreadsheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-secondary">
              <Table2 size={48} className="mb-3 opacity-30" />
              <p className="text-sm">No spreadsheets yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {spreadsheets.map((ss) => (
                <SpreadsheetCard
                  key={ss.id}
                  sheet={ss}
                  onOpen={() => setActiveSpreadsheetId(ss.id)}
                  onDelete={() => deleteSpreadsheet(ss.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Editor View
  // ──────────────────────────────────────────────

  const currentCell = getCellData(activeCell.col, activeCell.row);

  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <button
          onClick={() => {
            setActiveSpreadsheetId(null);
            setActiveCell({ col: 0, row: 0 });
            setSelectionEnd(null);
            setEditingCell(null);
          }}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <input
          value={activeSpreadsheet.title}
          onChange={(e) =>
            updateSpreadsheet((ss) => ({ ...ss, title: e.target.value }))
          }
          className="text-lg font-semibold bg-transparent text-text-primary outline-none border-none min-w-0 flex-1"
          placeholder="Untitled Spreadsheet"
        />
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-bg-secondary border-b border-border-primary flex-wrap">
        <button
          onClick={toggleBold}
          className={cn(
            'p-1.5 rounded transition-colors',
            currentCell.bold
              ? 'bg-accent-blue/20 text-accent-blue'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          )}
          title="Bold"
        >
          <Bold size={15} />
        </button>
        <button
          onClick={toggleItalic}
          className={cn(
            'p-1.5 rounded transition-colors',
            currentCell.italic
              ? 'bg-accent-blue/20 text-accent-blue'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          )}
          title="Italic"
        >
          <Italic size={15} />
        </button>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Number format */}
        <div className="relative">
          <button
            onClick={() => setShowFormatDropdown(!showFormatDropdown)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary rounded hover:bg-bg-primary transition-colors"
          >
            {NUMBER_FORMATS.find((f) => f.value === (currentCell.format ?? 'general'))?.label}
            <ChevronDown size={12} />
          </button>
          {showFormatDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
              {NUMBER_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value as CellData['format'])}
                  className={cn(
                    'w-full text-left px-3 py-1 text-xs hover:bg-bg-primary transition-colors',
                    (currentCell.format ?? 'general') === f.value
                      ? 'text-accent-blue'
                      : 'text-text-primary'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Fill color */}
        <label
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors cursor-pointer"
          title="Fill color"
        >
          <Paintbrush size={15} />
          <input
            type="color"
            className="sr-only"
            value={currentCell.fillColor ?? '#1a1a2e'}
            onChange={(e) =>
              setCellData(activeCell.col, activeCell.row, { fillColor: e.target.value })
            }
          />
        </label>

        {/* Text color */}
        <label
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors cursor-pointer"
          title="Text color"
        >
          <Type size={15} />
          <input
            type="color"
            className="sr-only"
            value={currentCell.textColor ?? '#e0e0e0'}
            onChange={(e) =>
              setCellData(activeCell.col, activeCell.row, { textColor: e.target.value })
            }
          />
        </label>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Borders placeholder */}
        <button
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
          title="Borders"
        >
          <Grid3X3 size={15} />
        </button>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Alignment */}
        <button
          onClick={() => setAlignment('left')}
          className={cn(
            'p-1.5 rounded transition-colors',
            (currentCell.align ?? 'left') === 'left'
              ? 'text-accent-blue'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          )}
          title="Align left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          onClick={() => setAlignment('center')}
          className={cn(
            'p-1.5 rounded transition-colors',
            currentCell.align === 'center'
              ? 'text-accent-blue'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          )}
          title="Align center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          onClick={() => setAlignment('right')}
          className={cn(
            'p-1.5 rounded transition-colors',
            currentCell.align === 'right'
              ? 'text-accent-blue'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          )}
          title="Align right"
        >
          <AlignRight size={15} />
        </button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center px-4 py-1 bg-bg-secondary border-b border-border-primary gap-2">
        <span className="text-xs font-mono text-text-secondary bg-bg-primary border border-border-primary rounded px-2 py-0.5 min-w-[48px] text-center">
          {cellKey(activeCell.col, activeCell.row)}
        </span>
        <div className="text-text-secondary text-xs">fx</div>
        <input
          value={formulaBarValue}
          onChange={(e) => setFormulaBarValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = formulaBarValue;
              if (val.startsWith('=')) {
                setCellData(activeCell.col, activeCell.row, {
                  formula: val,
                  value: '',
                });
              } else {
                setCellData(activeCell.col, activeCell.row, {
                  value: val,
                  formula: undefined,
                });
              }
            }
          }}
          className="flex-1 bg-bg-primary border border-border-primary rounded px-2 py-0.5 text-sm text-text-primary font-mono outline-none focus:border-accent-blue"
        />
      </div>

      {/* Grid area */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto relative select-none"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          setScrollTop(target.scrollTop);
          setScrollLeft(target.scrollLeft);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Corner cell */}
        <div
          className="sticky top-0 left-0 z-30 bg-bg-secondary border-b border-r border-border-primary"
          style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }}
        />

        {/* Column headers */}
        <div
          className="sticky top-0 z-20"
          style={{
            marginLeft: ROW_HEADER_WIDTH,
            width: totalWidth,
            height: HEADER_HEIGHT,
          }}
        >
          {Array.from({ length: VISIBLE_COLS }, (_, col) => (
            <div
              key={col}
              className={cn(
                'absolute top-0 bg-bg-secondary border-b border-r border-border-primary flex items-center justify-center text-xs text-text-secondary font-medium',
                activeCell.col === col && 'bg-accent-blue/10 text-accent-blue'
              )}
              style={{
                left: colOffsets[col],
                width: getColWidth(col),
                height: HEADER_HEIGHT,
              }}
            >
              {colToLetter(col)}
              {/* Resize handle */}
              <div
                className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-accent-blue z-10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleColResizeStart(col, e.clientX);
                }}
              />
            </div>
          ))}
        </div>

        {/* Row headers */}
        <div
          className="sticky left-0 z-20"
          style={{ width: ROW_HEADER_WIDTH, marginTop: 0 }}
        >
          {Array.from({ length: VISIBLE_ROWS }, (_, row) => (
            <div
              key={row}
              className={cn(
                'absolute bg-bg-secondary border-b border-r border-border-primary flex items-center justify-center text-xs text-text-secondary',
                activeCell.row === row && 'bg-accent-blue/10 text-accent-blue'
              )}
              style={{
                top: HEADER_HEIGHT + row * ROW_HEIGHT,
                width: ROW_HEADER_WIDTH,
                height: ROW_HEIGHT,
              }}
            >
              {row + 1}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div
          style={{
            marginLeft: ROW_HEADER_WIDTH,
            marginTop: HEADER_HEIGHT,
            width: totalWidth,
            height: totalHeight,
            position: 'relative',
          }}
        >
          {Array.from({ length: VISIBLE_ROWS }, (_, row) =>
            Array.from({ length: VISIBLE_COLS }, (_, col) => {
              const isActive =
                activeCell.col === col && activeCell.row === row;
              const isEditing =
                editingCell?.col === col && editingCell?.row === row;
              const isSelected = isInSelection(col, row);
              const cell = getCellData(col, row);
              const displayVal = getCellDisplayValue(col, row);

              // Skip empty cells that are not active/editing/selected for performance
              if (
                !isActive &&
                !isEditing &&
                !isSelected &&
                !cell.value &&
                !cell.formula
              ) {
                return null;
              }

              return (
                <div
                  key={`${col}-${row}`}
                  className={cn(
                    'absolute border-r border-b border-border-primary/50 px-1 flex items-center overflow-hidden text-xs',
                    isActive && 'ring-2 ring-accent-blue ring-inset z-10',
                    isSelected && !isActive && 'bg-accent-blue/10',
                    cell.bold && 'font-bold',
                    cell.italic && 'italic'
                  )}
                  style={{
                    left: colOffsets[col],
                    top: row * ROW_HEIGHT,
                    width: getColWidth(col),
                    height: ROW_HEIGHT,
                    textAlign: cell.align ?? 'left',
                    backgroundColor: cell.fillColor ?? undefined,
                    color: cell.textColor ?? undefined,
                  }}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setSelectionEnd({ col, row });
                    } else {
                      setActiveCell({ col, row });
                      setSelectionEnd(null);
                    }
                  }}
                  onDoubleClick={() => startEdit(col, row)}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={commitEdit}
                      className="w-full h-full bg-transparent outline-none text-xs text-text-primary font-mono"
                      autoFocus
                    />
                  ) : (
                    <span className="truncate w-full">{displayVal}</span>
                  )}
                </div>
              );
            })
          )}

          {/* Render empty active cell border if no data */}
          {(() => {
            const cell = getCellData(activeCell.col, activeCell.row);
            if (!cell.value && !cell.formula) {
              return (
                <div
                  className="absolute ring-2 ring-accent-blue ring-inset z-10 pointer-events-none"
                  style={{
                    left: colOffsets[activeCell.col],
                    top: activeCell.row * ROW_HEIGHT,
                    width: getColWidth(activeCell.col),
                    height: ROW_HEIGHT,
                  }}
                />
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-bg-secondary border-t border-border-primary">
        {activeSpreadsheet.sheets.map((sheet) => (
          <div key={sheet.id} className="relative">
            {renamingSheet === sheet.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameSheet(sheet.id, renameValue);
                  if (e.key === 'Escape') setRenamingSheet(null);
                }}
                onBlur={() => renameSheet(sheet.id, renameValue)}
                className="px-3 py-1 text-xs bg-bg-primary border border-accent-blue rounded outline-none text-text-primary w-24"
              />
            ) : (
              <button
                onClick={() => switchSheet(sheet.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRenamingSheet(sheet.id);
                  setRenameValue(sheet.name);
                }}
                className={cn(
                  'px-3 py-1 text-xs rounded transition-colors',
                  sheet.id === activeSpreadsheet.activeSheetId
                    ? 'bg-bg-primary text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50'
                )}
              >
                {sheet.name}
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addSheet}
          className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 rounded transition-colors"
          title="Add sheet"
        >
          <Plus size={14} />
        </button>

        {/* Delete sheet (if more than one) */}
        {activeSpreadsheet.sheets.length > 1 && (
          <button
            onClick={() => deleteSheet(activeSpreadsheet.activeSheetId)}
            className="p-1 text-text-secondary hover:text-red-400 rounded transition-colors ml-1"
            title="Delete current sheet"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
