import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Plus,
  Trash2,
  ChevronLeft,
  MousePointer2,
  Pencil,
  Square,
  Circle,
  StickyNote,
  Type,
  Eraser,
  Minus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  MoreHorizontal,
  X,
  Palette,
  LayoutGrid,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToolType = 'select' | 'pen' | 'rect' | 'circle' | 'sticky' | 'text' | 'eraser';

interface CanvasObject {
  id: string;
  type: 'rect' | 'circle' | 'line' | 'sticky' | 'text' | 'pen';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  points: number[][]; // for pen strokes: [[x,y], ...]
  strokeWidth: number;
  fontSize: number;
}

interface Whiteboard {
  id: string;
  name: string;
  thumbnail?: string;
  objects: CanvasObject[];
  createdAt: string;
  updatedAt: string;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];

const TOOL_LIST: { tool: ToolType; icon: typeof MousePointer2; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select' },
  { tool: 'pen', icon: Pencil, label: 'Pen' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'circle', icon: Circle, label: 'Circle' },
  { tool: 'sticky', icon: StickyNote, label: 'Sticky Note' },
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'eraser', icon: Eraser, label: 'Eraser' },
];

let idCounter = 0;
function genId() {
  return `obj_${Date.now()}_${++idCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Whiteboard Page                                                    */
/* ------------------------------------------------------------------ */

export function WhiteboardPage() {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'canvas'>('list');
  const [activeBoard, setActiveBoard] = useState<Whiteboard | null>(null);

  // Canvas state
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState('#3b82f6');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentObject, setCurrentObject] = useState<CanvasObject | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Dialogs
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedObject = objects.find((o) => o.id === selectedObjectId) || null;

  /* -- Fetch boards -- */

  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/whiteboard');
      setBoards(data.data ?? data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  /* -- Space key for panning -- */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && mode === 'canvas') {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.code === 'Delete' && selectedObjectId && mode === 'canvas') {
        setObjects((prev) => prev.filter((o) => o.id !== selectedObjectId));
        setSelectedObjectId(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, selectedObjectId]);

  /* -- Debounced save -- */

  const saveCanvas = useCallback(async (boardId: string, objs: CanvasObject[]) => {
    try {
      await api.patch(`/whiteboard/${boardId}`, { objects: objs });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!activeBoard) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(activeBoard.id, objects);
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [objects, activeBoard, saveCanvas]);

  /* -- Board CRUD -- */

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    try {
      const { data } = await api.post('/whiteboard', { name: newBoardName.trim() });
      const created = data.data ?? data;
      setBoards((prev) => [...prev, created]);
      setNewBoardName('');
      setShowCreateBoard(false);
    } catch {
      /* ignore */
    }
  };

  const handleDeleteBoard = async (id: string) => {
    try {
      await api.delete(`/whiteboard/${id}`);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setShowDeleteBoard(null);
    } catch {
      /* ignore */
    }
  };

  const openBoard = async (board: Whiteboard) => {
    try {
      const { data } = await api.get(`/whiteboard/${board.id}`);
      const full = data.data ?? data;
      setActiveBoard(full);
      setObjects(full.objects || []);
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setSelectedObjectId(null);
      setActiveTool('select');
      setMode('canvas');
    } catch {
      /* fallback */
      setActiveBoard(board);
      setObjects(board.objects || []);
      setMode('canvas');
    }
  };

  const goBack = () => {
    if (activeBoard) {
      saveCanvas(activeBoard.id, objects);
    }
    setMode('list');
    setActiveBoard(null);
    setObjects([]);
    fetchBoards();
  };

  /* -- Canvas helpers -- */

  const screenToCanvas = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  /* -- Mouse handlers -- */

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = screenToCanvas(e.clientX, e.clientY);

    // Middle click or space+click = pan
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === 'select') {
      // Check if clicking on an object
      const clicked = [...objects].reverse().find((obj) => {
        if (obj.type === 'pen') {
          return obj.points.some(([px, py]) => Math.abs(px - pos.x) < 8 && Math.abs(py - pos.y) < 8);
        }
        return pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height;
      });
      setSelectedObjectId(clicked?.id || null);
      setEditingTextId(null);
      return;
    }

    if (activeTool === 'eraser') {
      const clicked = [...objects].reverse().find((obj) => {
        if (obj.type === 'pen') {
          return obj.points.some(([px, py]) => Math.abs(px - pos.x) < 12 && Math.abs(py - pos.y) < 12);
        }
        return pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height;
      });
      if (clicked) {
        setObjects((prev) => prev.filter((o) => o.id !== clicked.id));
      }
      return;
    }

    setIsDrawing(true);
    setDrawStart(pos);

    if (activeTool === 'pen') {
      const newObj: CanvasObject = {
        id: genId(), type: 'pen', x: 0, y: 0, width: 0, height: 0,
        color: activeColor, text: '', points: [[pos.x, pos.y]], strokeWidth: 2, fontSize: 16,
      };
      setCurrentObject(newObj);
    } else if (activeTool === 'rect') {
      const newObj: CanvasObject = {
        id: genId(), type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0,
        color: activeColor, text: '', points: [], strokeWidth: 2, fontSize: 16,
      };
      setCurrentObject(newObj);
    } else if (activeTool === 'circle') {
      const newObj: CanvasObject = {
        id: genId(), type: 'circle', x: pos.x, y: pos.y, width: 0, height: 0,
        color: activeColor, text: '', points: [], strokeWidth: 2, fontSize: 16,
      };
      setCurrentObject(newObj);
    } else if (activeTool === 'sticky') {
      const newObj: CanvasObject = {
        id: genId(), type: 'sticky', x: pos.x - 75, y: pos.y - 50, width: 150, height: 100,
        color: '#eab308', text: '', points: [], strokeWidth: 0, fontSize: 14,
      };
      setObjects((prev) => [...prev, newObj]);
      setEditingTextId(newObj.id);
      setSelectedObjectId(newObj.id);
      setActiveTool('select');
      setIsDrawing(false);
    } else if (activeTool === 'text') {
      const newObj: CanvasObject = {
        id: genId(), type: 'text', x: pos.x, y: pos.y, width: 200, height: 30,
        color: activeColor, text: 'Text', points: [], strokeWidth: 0, fontSize: 18,
      };
      setObjects((prev) => [...prev, newObj]);
      setEditingTextId(newObj.id);
      setSelectedObjectId(newObj.id);
      setActiveTool('select');
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (!isDrawing || !drawStart || !currentObject) return;
    const pos = screenToCanvas(e.clientX, e.clientY);

    if (currentObject.type === 'pen') {
      setCurrentObject((prev) => prev ? { ...prev, points: [...prev.points, [pos.x, pos.y]] } : prev);
    } else if (currentObject.type === 'rect' || currentObject.type === 'circle') {
      const x = Math.min(drawStart.x, pos.x);
      const y = Math.min(drawStart.y, pos.y);
      const width = Math.abs(pos.x - drawStart.x);
      const height = Math.abs(pos.y - drawStart.y);
      setCurrentObject((prev) => prev ? { ...prev, x, y, width, height } : prev);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDrawing || !currentObject) {
      setIsDrawing(false);
      return;
    }

    // Only add if has meaningful size
    if (currentObject.type === 'pen' && currentObject.points.length > 1) {
      setObjects((prev) => [...prev, currentObject]);
    } else if ((currentObject.type === 'rect' || currentObject.type === 'circle') && currentObject.width > 2 && currentObject.height > 2) {
      setObjects((prev) => [...prev, currentObject]);
    }

    setIsDrawing(false);
    setCurrentObject(null);
    setDrawStart(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.2), 5));
  };

  /* -- Object text editing -- */

  const handleTextChange = (id: string, text: string) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  };

  /* -- Render object -- */

  const renderObject = (obj: CanvasObject) => {
    const isSelected = selectedObjectId === obj.id;
    const selectionStroke = isSelected ? '#3b82f6' : 'transparent';

    switch (obj.type) {
      case 'rect':
        return (
          <g key={obj.id}>
            <rect
              x={obj.x} y={obj.y} width={obj.width} height={obj.height}
              fill="transparent" stroke={obj.color} strokeWidth={obj.strokeWidth}
              rx={2}
            />
            {isSelected && (
              <rect
                x={obj.x - 2} y={obj.y - 2} width={obj.width + 4} height={obj.height + 4}
                fill="none" stroke={selectionStroke} strokeWidth={1.5} strokeDasharray="4 2" rx={3}
              />
            )}
          </g>
        );

      case 'circle':
        return (
          <g key={obj.id}>
            <ellipse
              cx={obj.x + obj.width / 2} cy={obj.y + obj.height / 2}
              rx={obj.width / 2} ry={obj.height / 2}
              fill="transparent" stroke={obj.color} strokeWidth={obj.strokeWidth}
            />
            {isSelected && (
              <rect
                x={obj.x - 2} y={obj.y - 2} width={obj.width + 4} height={obj.height + 4}
                fill="none" stroke={selectionStroke} strokeWidth={1.5} strokeDasharray="4 2"
              />
            )}
          </g>
        );

      case 'pen':
        if (obj.points.length < 2) return null;
        const pathD = obj.points.reduce((d, [px, py], i) => d + (i === 0 ? `M${px},${py}` : ` L${px},${py}`), '');
        return (
          <g key={obj.id}>
            <path d={pathD} fill="none" stroke={obj.color} strokeWidth={obj.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            {isSelected && <path d={pathD} fill="none" stroke={selectionStroke} strokeWidth={obj.strokeWidth + 3} strokeLinecap="round" strokeLinejoin="round" opacity={0.3} />}
          </g>
        );

      case 'sticky':
        return (
          <g key={obj.id}>
            <rect
              x={obj.x} y={obj.y} width={obj.width} height={obj.height}
              fill={obj.color + '30'} stroke={obj.color} strokeWidth={1} rx={4}
            />
            {editingTextId === obj.id ? (
              <foreignObject x={obj.x + 4} y={obj.y + 4} width={obj.width - 8} height={obj.height - 8}>
                <textarea
                  autoFocus
                  value={obj.text}
                  onChange={(e) => handleTextChange(obj.id, e.target.value)}
                  onBlur={() => setEditingTextId(null)}
                  style={{
                    width: '100%', height: '100%', background: 'transparent', border: 'none',
                    outline: 'none', resize: 'none', color: '#ffffff', fontSize: `${obj.fontSize}px`,
                    fontFamily: 'sans-serif', lineHeight: 1.3,
                  }}
                />
              </foreignObject>
            ) : (
              <text
                x={obj.x + 8} y={obj.y + 20} fontSize={obj.fontSize} fill="#ffffff"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {(obj.text || '').split('\n').map((line, i) => (
                  <tspan key={i} x={obj.x + 8} dy={i === 0 ? 0 : obj.fontSize * 1.3}>{line}</tspan>
                ))}
              </text>
            )}
            {isSelected && (
              <rect
                x={obj.x - 2} y={obj.y - 2} width={obj.width + 4} height={obj.height + 4}
                fill="none" stroke={selectionStroke} strokeWidth={1.5} strokeDasharray="4 2" rx={5}
              />
            )}
          </g>
        );

      case 'text':
        return (
          <g key={obj.id}>
            {editingTextId === obj.id ? (
              <foreignObject x={obj.x} y={obj.y - 4} width={obj.width} height={obj.height + 8}>
                <input
                  autoFocus
                  type="text"
                  value={obj.text}
                  onChange={(e) => handleTextChange(obj.id, e.target.value)}
                  onBlur={() => setEditingTextId(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingTextId(null); }}
                  style={{
                    width: '100%', height: '100%', background: 'transparent', border: 'none',
                    outline: 'none', color: obj.color, fontSize: `${obj.fontSize}px`,
                    fontFamily: 'sans-serif',
                  }}
                />
              </foreignObject>
            ) : (
              <text
                x={obj.x} y={obj.y + obj.fontSize} fontSize={obj.fontSize} fill={obj.color}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {obj.text}
              </text>
            )}
            {isSelected && (
              <rect
                x={obj.x - 2} y={obj.y - 2} width={obj.width + 4} height={obj.height + 4}
                fill="none" stroke={selectionStroke} strokeWidth={1.5} strokeDasharray="4 2"
              />
            )}
          </g>
        );

      default:
        return null;
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render - Board List                                              */
  /* ---------------------------------------------------------------- */

  if (mode === 'list') {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0f]">
        <div className="h-14 flex items-center gap-3 px-6 border-b border-white/10 flex-shrink-0">
          <LayoutGrid size={18} className="text-blue-400" />
          <h1 className="text-base font-semibold text-white">Whiteboards</h1>
          <div className="flex-1" />
          <button
            onClick={() => { setNewBoardName(''); setShowCreateBoard(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <Plus size={14} />
            New Whiteboard
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#12121a] border border-white/10 rounded-lg h-44 animate-pulse" />
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <LayoutGrid size={48} className="text-white/10 mb-3" />
              <p className="text-base text-white/50 mb-1">No whiteboards</p>
              <p className="text-sm text-white/30 mb-4">Create your first whiteboard to start drawing</p>
              <button
                onClick={() => setShowCreateBoard(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
              >
                <Plus size={14} />
                Create Whiteboard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="bg-[#12121a] border border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-white/20 transition-colors group"
                >
                  {/* Thumbnail area */}
                  <div
                    onClick={() => openBoard(board)}
                    className="h-28 bg-[#1a1a2e] flex items-center justify-center"
                  >
                    {board.thumbnail ? (
                      <img src={board.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <LayoutGrid size={28} className="text-white/10" />
                    )}
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1" onClick={() => openBoard(board)}>
                      <h3 className="text-sm font-medium text-white truncate">{board.name}</h3>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {new Date(board.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteBoard(board.id); }}
                      className="p-1 rounded hover:bg-white/5 text-white/15 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Board Dialog */}
        {showCreateBoard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreateBoard(false)}>
            <div className="bg-[#12121a] border border-white/10 rounded-xl w-[400px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Create Whiteboard</h3>
                <button onClick={() => setShowCreateBoard(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Name</label>
                  <input autoFocus type="text" placeholder="My Whiteboard" value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                    className="w-full h-9 px-3 rounded-lg bg-[#1a1a2e] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-600" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreateBoard(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={handleCreateBoard} disabled={!newBoardName.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Board Dialog */}
        {showDeleteBoard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeleteBoard(null)}>
            <div className="bg-[#12121a] border border-white/10 rounded-xl w-[380px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-white mb-2">Delete Whiteboard</h3>
              <p className="text-sm text-white/50 mb-5">
                Are you sure? This whiteboard and all its contents will be permanently deleted.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteBoard(null)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={() => handleDeleteBoard(showDeleteBoard)} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render - Canvas                                                  */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-hidden select-none">
      {/* Top bar */}
      <div className="h-11 flex items-center gap-2 px-3 border-b border-white/10 flex-shrink-0 bg-[#12121a]">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-white truncate">{activeBoard?.name}</span>
        <div className="flex-1" />
        <span className="text-[11px] text-white/30">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(z + 0.2, 5))} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.2))} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors" title="Reset view">
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div className="w-12 flex-shrink-0 bg-[#12121a] border-r border-white/10 flex flex-col items-center py-3 gap-1">
          {TOOL_LIST.map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => { setActiveTool(tool); setSelectedObjectId(null); setEditingTextId(null); }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                activeTool === tool
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
              title={label}
            >
              <Icon size={16} />
            </button>
          ))}

          <div className="w-6 h-px bg-white/10 my-2" />

          {/* Color picker */}
          <div className="flex flex-col items-center gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  activeColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Canvas */}
        <svg
          ref={svgRef}
          className={`flex-1 ${isPanning || spaceHeld ? 'cursor-grab' : activeTool === 'pen' ? 'cursor-crosshair' : activeTool === 'eraser' ? 'cursor-pointer' : activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={(e) => {
            if (activeTool === 'select' && selectedObjectId) {
              const obj = objects.find((o) => o.id === selectedObjectId);
              if (obj && (obj.type === 'sticky' || obj.type === 'text')) {
                setEditingTextId(obj.id);
              }
            }
          }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (40 * zoom)} y={pan.y % (40 * zoom)}>
              <circle cx={1} cy={1} r={0.5} fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#0a0a0f" />
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Canvas group with pan/zoom */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {objects.map(renderObject)}
            {currentObject && renderObject(currentObject)}
          </g>
        </svg>

        {/* Properties panel (when object selected) */}
        {selectedObject && activeTool === 'select' && (
          <div className="w-48 flex-shrink-0 bg-[#12121a] border-l border-white/10 p-3 space-y-4">
            <div>
              <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">Properties</h4>
              <p className="text-xs text-white/60 mb-3 capitalize">{selectedObject.type}</p>
            </div>

            <div>
              <label className="block text-[11px] text-white/40 mb-1.5">Color</label>
              <div className="grid grid-cols-4 gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, color } : o)))}
                    className={`w-7 h-7 rounded border-2 ${selectedObject.color === color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {(selectedObject.type === 'rect' || selectedObject.type === 'circle' || selectedObject.type === 'pen') && (
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5">Stroke Width</label>
                <input
                  type="range" min={1} max={10} value={selectedObject.strokeWidth}
                  onChange={(e) => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, strokeWidth: Number(e.target.value) } : o)))}
                  className="w-full accent-blue-600"
                />
                <span className="text-[11px] text-white/30">{selectedObject.strokeWidth}px</span>
              </div>
            )}

            {(selectedObject.type === 'text' || selectedObject.type === 'sticky') && (
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5">Font Size</label>
                <input
                  type="number" min={8} max={72} value={selectedObject.fontSize}
                  onChange={(e) => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, fontSize: Number(e.target.value) } : o)))}
                  className="w-full h-7 px-2 rounded bg-[#1a1a2e] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            )}

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => { setObjects((prev) => prev.filter((o) => o.id !== selectedObject.id)); setSelectedObjectId(null); }}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
                Delete Object
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
