import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  ChevronLeft,
  MousePointer2,
  Share2,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  ImageIcon,
  X,
  Layers,
  LayoutGrid,
  GitBranch,
  Network,
  Database,
  Monitor,
  Workflow,
  Circle,
  Square,
  Diamond,
  ArrowRight,
  User,
  FileCode,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DiagramType = 'flowchart' | 'orgchart' | 'mindmap' | 'uml' | 'network' | 'er' | 'wireframe' | 'blank';

interface DiagramShape {
  id: string;
  type: string;
  shapeKind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
}

interface DiagramConnector {
  id: string;
  fromId: string;
  toId: string;
  lineType: 'straight' | 'elbow';
  color: string;
  label: string;
}

interface DiagramData {
  id: string;
  name: string;
  type: DiagramType;
  shapes: DiagramShape[];
  connectors: DiagramConnector[];
  createdAt: string;
  updatedAt: string;
}

const DIAGRAM_TYPES: { type: DiagramType; label: string; icon: typeof Workflow }[] = [
  { type: 'flowchart', label: 'Flowchart', icon: Workflow },
  { type: 'orgchart', label: 'Org Chart', icon: GitBranch },
  { type: 'mindmap', label: 'Mind Map', icon: Network },
  { type: 'uml', label: 'UML', icon: FileCode },
  { type: 'network', label: 'Network', icon: Network },
  { type: 'er', label: 'ER Diagram', icon: Database },
  { type: 'wireframe', label: 'Wireframe', icon: Monitor },
  { type: 'blank', label: 'Blank', icon: LayoutGrid },
];

interface ShapeTemplate {
  shapeKind: string;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  render: 'rect' | 'ellipse' | 'diamond' | 'parallelogram' | 'rounded-rect' | 'person-card' | 'cylinder';
}

const SHAPE_LIBRARIES: Record<string, ShapeTemplate[]> = {
  flowchart: [
    { shapeKind: 'start-end', label: 'Start / End', defaultWidth: 140, defaultHeight: 60, render: 'ellipse' },
    { shapeKind: 'process', label: 'Process', defaultWidth: 140, defaultHeight: 70, render: 'rect' },
    { shapeKind: 'decision', label: 'Decision', defaultWidth: 120, defaultHeight: 100, render: 'diamond' },
    { shapeKind: 'io', label: 'Input / Output', defaultWidth: 140, defaultHeight: 70, render: 'parallelogram' },
  ],
  orgchart: [
    { shapeKind: 'person', label: 'Person Card', defaultWidth: 160, defaultHeight: 70, render: 'person-card' },
    { shapeKind: 'department', label: 'Department', defaultWidth: 140, defaultHeight: 50, render: 'rounded-rect' },
  ],
  mindmap: [
    { shapeKind: 'central', label: 'Central Topic', defaultWidth: 160, defaultHeight: 60, render: 'rounded-rect' },
    { shapeKind: 'topic', label: 'Topic', defaultWidth: 120, defaultHeight: 50, render: 'rounded-rect' },
    { shapeKind: 'subtopic', label: 'Subtopic', defaultWidth: 100, defaultHeight: 40, render: 'ellipse' },
  ],
  uml: [
    { shapeKind: 'class', label: 'Class', defaultWidth: 160, defaultHeight: 100, render: 'rect' },
    { shapeKind: 'interface', label: 'Interface', defaultWidth: 140, defaultHeight: 80, render: 'rect' },
  ],
  network: [
    { shapeKind: 'server', label: 'Server', defaultWidth: 80, defaultHeight: 90, render: 'cylinder' },
    { shapeKind: 'computer', label: 'Computer', defaultWidth: 100, defaultHeight: 70, render: 'rect' },
    { shapeKind: 'cloud', label: 'Cloud', defaultWidth: 140, defaultHeight: 80, render: 'ellipse' },
  ],
  er: [
    { shapeKind: 'entity', label: 'Entity', defaultWidth: 140, defaultHeight: 60, render: 'rect' },
    { shapeKind: 'attribute', label: 'Attribute', defaultWidth: 100, defaultHeight: 50, render: 'ellipse' },
    { shapeKind: 'relationship', label: 'Relationship', defaultWidth: 110, defaultHeight: 80, render: 'diamond' },
  ],
  wireframe: [
    { shapeKind: 'button', label: 'Button', defaultWidth: 120, defaultHeight: 40, render: 'rounded-rect' },
    { shapeKind: 'input', label: 'Input Field', defaultWidth: 200, defaultHeight: 36, render: 'rect' },
    { shapeKind: 'box', label: 'Container', defaultWidth: 200, defaultHeight: 150, render: 'rect' },
  ],
  blank: [
    { shapeKind: 'rectangle', label: 'Rectangle', defaultWidth: 140, defaultHeight: 80, render: 'rect' },
    { shapeKind: 'ellipse', label: 'Ellipse', defaultWidth: 120, defaultHeight: 80, render: 'ellipse' },
    { shapeKind: 'diamond', label: 'Diamond', defaultWidth: 100, defaultHeight: 100, render: 'diamond' },
    { shapeKind: 'rounded', label: 'Rounded Rect', defaultWidth: 140, defaultHeight: 70, render: 'rounded-rect' },
  ],
};

const DEFAULT_COLORS = ['#3B82F6', '#8B5CF6', '#22c55e', '#EF4444', '#F97316', '#eab308', '#F97316', '#14B8A6'];

let seq = 0;
function uid() { return `ds_${Date.now()}_${++seq}`; }

/* ------------------------------------------------------------------ */
/*  DiagramsPage                                                       */
/* ------------------------------------------------------------------ */

export function DiagramsPage() {
  const [diagrams, setDiagrams] = useState<DiagramData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [active, setActive] = useState<DiagramData | null>(null);

  /* Editor state */
  const [shapes, setShapes] = useState<DiagramShape[]>([]);
  const [connectors, setConnectors] = useState<DiagramConnector[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'connector'>('select');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  /* Connector drawing */
  const [connectorStart, setConnectorStart] = useState<string | null>(null);
  const [connectorLineType, setConnectorLineType] = useState<'straight' | 'elbow'>('straight');

  /* Drag/resize */
  const [dragging, setDragging] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; sx: number; sy: number; ow: number; oh: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  /* Create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<DiagramType>('flowchart');

  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedShape = shapes.find((s) => s.id === selectedId) || null;
  const shapeLib = SHAPE_LIBRARIES[active?.type || 'blank'] || SHAPE_LIBRARIES.blank;

  /* -- Fetch -- */

  const fetchDiagrams = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/diagrams');
      setDiagrams(data.data ?? data ?? []);
    } catch { /* offline */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDiagrams(); }, [fetchDiagrams]);

  /* -- Auto-save -- */

  const saveDiagram = useCallback(async (d: DiagramData, s: DiagramShape[], c: DiagramConnector[]) => {
    try { await api.patch(`/diagrams/${d.id}`, { shapes: s, connectors: c }); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDiagram(active, shapes, connectors), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [shapes, connectors, active, saveDiagram]);

  /* -- CRUD -- */

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await api.post('/diagrams', { name: newName.trim(), type: newType, shapes: [], connectors: [] });
      const created = data.data ?? data;
      setDiagrams((prev) => [...prev, created]);
      setShowCreate(false);
      setNewName('');
      openDiagram(created);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/diagrams/${id}`);
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch { /* ignore */ }
  };

  const openDiagram = async (d: DiagramData) => {
    try {
      const { data } = await api.get(`/diagrams/${d.id}`);
      const full = data.data ?? data;
      setActive(full);
      setShapes(full.shapes || []);
      setConnectors(full.connectors || []);
    } catch {
      setActive(d);
      setShapes(d.shapes || []);
      setConnectors(d.connectors || []);
    }
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSelectedId(null);
    setTool('select');
    setMode('editor');
  };

  const goBack = () => {
    if (active) saveDiagram(active, shapes, connectors);
    setMode('list');
    setActive(null);
    fetchDiagrams();
  };

  /* -- Add shape from library -- */

  const addShapeFromLib = (template: ShapeTemplate) => {
    const centerX = (-pan.x + 400) / zoom;
    const centerY = (-pan.y + 300) / zoom;
    const shape: DiagramShape = {
      id: uid(), type: template.render, shapeKind: template.shapeKind,
      x: centerX - template.defaultWidth / 2, y: centerY - template.defaultHeight / 2,
      width: template.defaultWidth, height: template.defaultHeight,
      text: template.label, fillColor: '#3B82F6', borderColor: '#60A5FA',
      borderWidth: 2, fontSize: 13,
    };
    setShapes((prev) => [...prev, shape]);
    setSelectedId(shape.id);
    setTool('select');
  };

  /* -- Delete shape -- */

  const deleteShape = (id: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setConnectors((prev) => prev.filter((c) => c.fromId !== id && c.toId !== id));
    if (selectedId === id) setSelectedId(null);
  };

  /* -- Update shape -- */

  const updateShape = (id: string, patch: Partial<DiagramShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  /* -- SVG mouse handlers -- */

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    /* Middle-click panning */
    if (e.button === 1) {
      e.preventDefault();
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    if (tool === 'select' && e.target === svgRef.current) {
      setSelectedId(null);
      setEditingTextId(null);
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (dragging) {
      const scale = zoom;
      const dx = (e.clientX - dragging.sx) / scale;
      const dy = (e.clientY - dragging.sy) / scale;
      updateShape(dragging.id, { x: dragging.ox + dx, y: dragging.oy + dy });
      return;
    }
    if (resizing) {
      const scale = zoom;
      const dx = (e.clientX - resizing.sx) / scale;
      const dy = (e.clientY - resizing.sy) / scale;
      updateShape(resizing.id, {
        width: Math.max(40, resizing.ow + dx),
        height: Math.max(20, resizing.oh + dy),
      });
    }
  };

  const handleSvgMouseUp = () => {
    setPanning(false);
    setDragging(null);
    setResizing(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.2), 5));
  };

  /* -- Shape mouse handlers -- */

  const handleShapeMouseDown = (e: React.MouseEvent, shape: DiagramShape) => {
    e.stopPropagation();

    if (tool === 'connector') {
      if (!connectorStart) {
        setConnectorStart(shape.id);
      } else if (connectorStart !== shape.id) {
        const conn: DiagramConnector = {
          id: uid(), fromId: connectorStart, toId: shape.id,
          lineType: connectorLineType, color: 'rgba(255,255,255,0.40)', label: '',
        };
        setConnectors((prev) => [...prev, conn]);
        setConnectorStart(null);
      }
      return;
    }

    setSelectedId(shape.id);
    setDragging({ id: shape.id, sx: e.clientX, sy: e.clientY, ox: shape.x, oy: shape.y });
  };

  const handleShapeDoubleClick = (e: React.MouseEvent, shape: DiagramShape) => {
    e.stopPropagation();
    setEditingTextId(shape.id);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, shape: DiagramShape) => {
    e.stopPropagation();
    setResizing({ id: shape.id, sx: e.clientX, sy: e.clientY, ow: shape.width, oh: shape.height });
  };

  /* -- Keyboard -- */

  useEffect(() => {
    if (mode !== 'editor') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId && !editingTextId) {
        deleteShape(selectedId);
      }
      if (e.key === 'Escape') {
        setConnectorStart(null);
        setSelectedId(null);
        setEditingTextId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selectedId, editingTextId]);

  /* -- Auto-layout (simple grid) -- */

  const handleAutoLayout = () => {
    const cols = Math.ceil(Math.sqrt(shapes.length));
    const gapX = 200;
    const gapY = 150;
    setShapes((prev) =>
      prev.map((s, i) => ({
        ...s,
        x: 100 + (i % cols) * gapX,
        y: 100 + Math.floor(i / cols) * gapY,
      }))
    );
  };

  /* -- Render shape SVG -- */

  const renderShape = (shape: DiagramShape) => {
    const isSelected = selectedId === shape.id;
    const isEditing = editingTextId === shape.id;

    const shapeElement = () => {
      switch (shape.type) {
        case 'ellipse':
          return (
            <ellipse
              cx={shape.width / 2} cy={shape.height / 2}
              rx={shape.width / 2} ry={shape.height / 2}
              fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth}
            />
          );
        case 'diamond':
          return (
            <polygon
              points={`${shape.width / 2},0 ${shape.width},${shape.height / 2} ${shape.width / 2},${shape.height} 0,${shape.height / 2}`}
              fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth}
            />
          );
        case 'parallelogram': {
          const off = 20;
          return (
            <polygon
              points={`${off},0 ${shape.width},0 ${shape.width - off},${shape.height} 0,${shape.height}`}
              fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth}
            />
          );
        }
        case 'rounded-rect':
          return (
            <rect
              width={shape.width} height={shape.height} rx={12} ry={12}
              fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth}
            />
          );
        case 'person-card':
          return (
            <>
              <rect width={shape.width} height={shape.height} rx={6} ry={6}
                fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth} />
              <circle cx={22} cy={shape.height / 2} r={12} fill={shape.fillColor + '60'} stroke="none" />
            </>
          );
        case 'cylinder':
          return (
            <>
              <ellipse cx={shape.width / 2} cy={12} rx={shape.width / 2} ry={12}
                fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth} />
              <rect x={0} y={12} width={shape.width} height={shape.height - 24}
                fill={shape.fillColor + '30'} stroke="none" />
              <line x1={0} y1={12} x2={0} y2={shape.height - 12} stroke={shape.borderColor} strokeWidth={shape.borderWidth} />
              <line x1={shape.width} y1={12} x2={shape.width} y2={shape.height - 12} stroke={shape.borderColor} strokeWidth={shape.borderWidth} />
              <ellipse cx={shape.width / 2} cy={shape.height - 12} rx={shape.width / 2} ry={12}
                fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth} />
            </>
          );
        default: /* rect */
          return (
            <rect
              width={shape.width} height={shape.height} rx={4} ry={4}
              fill={shape.fillColor + '30'} stroke={shape.borderColor} strokeWidth={shape.borderWidth}
            />
          );
      }
    };

    return (
      <g
        key={shape.id}
        transform={`translate(${shape.x}, ${shape.y})`}
        onMouseDown={(e) => handleShapeMouseDown(e, shape)}
        onDoubleClick={(e) => handleShapeDoubleClick(e, shape)}
        className={cn(tool === 'connector' ? 'cursor-crosshair' : 'cursor-move')}
      >
        {shapeElement()}

        {/* Text label */}
        {isEditing ? (
          <foreignObject x={4} y={4} width={shape.width - 8} height={shape.height - 8}>
            <input
              autoFocus
              type="text"
              value={shape.text}
              onChange={(e) => updateShape(shape.id, { text: e.target.value })}
              onBlur={() => setEditingTextId(null)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTextId(null); }}
              style={{
                width: '100%', height: '100%', background: 'transparent', border: 'none',
                outline: 'none', color: 'rgba(255,255,255,0.90)', fontSize: shape.fontSize, textAlign: 'center',
                fontFamily: 'inherit',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </foreignObject>
        ) : (
          <text
            x={shape.width / 2} y={shape.height / 2}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.90)" fontSize={shape.fontSize}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {shape.text}
          </text>
        )}

        {/* Selection outline */}
        {isSelected && (
          <>
            <rect
              x={-3} y={-3} width={shape.width + 6} height={shape.height + 6}
              fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" rx={4}
            />
            {/* Resize handle */}
            <rect
              x={shape.width - 4} y={shape.height - 4} width={8} height={8}
              fill="#3b82f6" rx={2} className="cursor-se-resize"
              onMouseDown={(e) => handleResizeMouseDown(e, shape)}
            />
          </>
        )}

        {/* Connector start indicator */}
        {connectorStart === shape.id && (
          <rect
            x={-4} y={-4} width={shape.width + 8} height={shape.height + 8}
            fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" rx={4}
          />
        )}
      </g>
    );
  };

  /* -- Render connector -- */

  const renderConnector = (conn: DiagramConnector) => {
    const from = shapes.find((s) => s.id === conn.fromId);
    const to = shapes.find((s) => s.id === conn.toId);
    if (!from || !to) return null;

    const fx = from.x + from.width / 2;
    const fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;
    const ty = to.y + to.height / 2;

    let pathD: string;
    if (conn.lineType === 'elbow') {
      const mx = (fx + tx) / 2;
      pathD = `M${fx},${fy} L${mx},${fy} L${mx},${ty} L${tx},${ty}`;
    } else {
      pathD = `M${fx},${fy} L${tx},${ty}`;
    }

    return (
      <g key={conn.id}>
        <path d={pathD} fill="none" stroke={conn.color} strokeWidth={2} markerEnd="url(#arrowhead)" />
        {conn.label && (
          <text x={(fx + tx) / 2} y={(fy + ty) / 2 - 8} textAnchor="middle" fill="rgba(255,255,255,0.40)" fontSize={11}>
            {conn.label}
          </text>
        )}
      </g>
    );
  };

  /* -- Export SVG -- */

  const handleExportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active?.name || 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------------------------------------------------------- */
  /*  Render - List                                                    */
  /* ---------------------------------------------------------------- */

  if (mode === 'list') {
    return (
      <div className="flex flex-col h-full bg-cx-bg">
        <div className="h-14 flex items-center gap-3 px-6 border-b border-white/8 flex-shrink-0">
          <Share2 size={18} className="text-cx-purple" />
          <h1 className="text-base font-display text-[var(--cx-text-1)]">Diagrams</h1>
          <div className="flex-1" />
          <button
            onClick={() => { setNewName(''); setNewType('flowchart'); setShowCreate(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Diagram
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-cx-surface border border-white/8 rounded-lg h-44 animate-pulse" />
              ))}
            </div>
          ) : diagrams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Share2 size={48} className="text-[var(--cx-text-3)] mb-3" />
              <p className="text-base text-[var(--cx-text-2)] mb-1">No diagrams</p>
              <p className="text-sm text-[var(--cx-text-3)] mb-4">Create your first diagram</p>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cx-brand text-white text-sm hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                Create Diagram
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {diagrams.map((d) => {
                const typeInfo = DIAGRAM_TYPES.find((t) => t.type === d.type) || DIAGRAM_TYPES[7];
                const TypeIcon = typeInfo.icon;
                return (
                  <div
                    key={d.id}
                    className="bg-cx-surface border border-white/8 rounded-lg overflow-hidden cursor-pointer hover:border-cx-brand/40 transition-colors group"
                  >
                    <div onClick={() => openDiagram(d)} className="h-28 bg-[#0C0C0E] flex items-center justify-center relative">
                      <TypeIcon size={32} className="text-[var(--cx-text-3)]" />
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cx-surface border border-white/8 text-[var(--cx-text-3)]">
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1" onClick={() => openDiagram(d)}>
                        <h3 className="text-sm font-medium text-[var(--cx-text-1)] truncate">{d.name}</h3>
                        <p className="text-[11px] text-[var(--cx-text-3)] mt-0.5">
                          {d.shapes?.length || 0} shapes &middot;{' '}
                          {new Date(d.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                        className="p-1 rounded hover:bg-cx-raised text-[var(--cx-text-3)] opacity-0 group-hover:opacity-100 hover:text-cx-danger transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
            <div className="bg-cx-surface border border-white/8 rounded-xl w-[500px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-[var(--cx-text-1)]">New Diagram</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-cx-raised text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--cx-text-3)] mb-1.5">Name</label>
                  <input
                    autoFocus type="text" placeholder="My Diagram" value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/8 text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:outline-none focus:border-cx-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--cx-text-3)] mb-2">Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {DIAGRAM_TYPES.map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => setNewType(type)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors',
                          newType === type ? 'border-cx-brand bg-cx-brand/10' : 'border-white/8 hover:border-white/12'
                        )}
                      >
                        <Icon size={20} className={newType === type ? 'text-cx-brand' : 'text-[var(--cx-text-3)]'} />
                        <span className={cn('text-[10px]', newType === type ? 'text-cx-brand' : 'text-[var(--cx-text-3)]')}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-sm text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-cx-raised transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:opacity-90 transition-opacity disabled:opacity-40">
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render - Editor                                                  */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full bg-cx-bg overflow-hidden select-none">
      {/* Top toolbar */}
      <div className="h-11 flex items-center gap-2 px-3 border-b border-white/8 flex-shrink-0 bg-cx-surface">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-cx-raised text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-[var(--cx-text-1)] truncate max-w-[180px]">{active?.name}</span>
        <span className="text-[10px] text-[var(--cx-text-3)] px-1.5 py-0.5 rounded bg-cx-bg border border-white/8">
          {DIAGRAM_TYPES.find((t) => t.type === active?.type)?.label}
        </span>

        <div className="w-px h-5 bg-border-primary mx-2" />

        {/* Tools */}
        <button
          onClick={() => { setTool('select'); setConnectorStart(null); }}
          className={cn('p-1.5 rounded-lg transition-colors', tool === 'select' ? 'bg-cx-brand/20 text-cx-brand' : 'text-[var(--cx-text-3)] hover:bg-cx-raised hover:text-[var(--cx-text-1)]')}
          title="Select"
        >
          <MousePointer2 size={14} />
        </button>
        <button
          onClick={() => setTool('connector')}
          className={cn('p-1.5 rounded-lg transition-colors', tool === 'connector' ? 'bg-cx-brand/20 text-cx-brand' : 'text-[var(--cx-text-3)] hover:bg-cx-raised hover:text-[var(--cx-text-1)]')}
          title="Connector"
        >
          <ArrowRight size={14} />
        </button>

        {tool === 'connector' && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => setConnectorLineType('straight')}
              className={cn('px-2 py-0.5 rounded text-[10px] transition-colors',
                connectorLineType === 'straight' ? 'bg-cx-brand/20 text-cx-brand' : 'text-[var(--cx-text-3)] hover:bg-cx-raised'
              )}
            >
              Straight
            </button>
            <button
              onClick={() => setConnectorLineType('elbow')}
              className={cn('px-2 py-0.5 rounded text-[10px] transition-colors',
                connectorLineType === 'elbow' ? 'bg-cx-brand/20 text-cx-brand' : 'text-[var(--cx-text-3)] hover:bg-cx-raised'
              )}
            >
              Elbow
            </button>
          </div>
        )}

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid((v) => !v)}
          className={cn('p-1.5 rounded-lg transition-colors', showGrid ? 'bg-cx-brand/20 text-cx-brand' : 'text-[var(--cx-text-3)] hover:bg-cx-raised hover:text-[var(--cx-text-1)]')}
          title="Toggle grid"
        >
          <Grid3X3 size={14} />
        </button>

        {/* Zoom */}
        <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.2))} className="p-1 rounded hover:bg-cx-raised text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors">
          <ZoomOut size={14} />
        </button>
        <span className="text-[11px] text-[var(--cx-text-3)] min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(z + 0.2, 5))} className="p-1 rounded hover:bg-cx-raised text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 rounded hover:bg-cx-raised text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors" title="Reset view">
          <RotateCcw size={14} />
        </button>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Auto-layout */}
        <button
          onClick={handleAutoLayout}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--cx-text-2)] hover:bg-cx-raised hover:text-[var(--cx-text-1)] transition-colors"
          title="Auto layout"
        >
          <Layers size={13} />
          <span className="hidden lg:inline">Auto-layout</span>
        </button>

        <div className="flex-1" />

        {/* Export */}
        <button
          onClick={handleExportSvg}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--cx-text-2)] hover:bg-cx-raised hover:text-[var(--cx-text-1)] transition-colors"
          title="Export SVG"
        >
          <Download size={13} />
          SVG
        </button>
        <button
          onClick={() => { /* PNG export placeholder */ }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--cx-text-2)] hover:bg-cx-raised hover:text-[var(--cx-text-1)] transition-colors"
          title="Export PNG"
        >
          <ImageIcon size={13} />
          PNG
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Shape Library */}
        <div className="w-[180px] flex-shrink-0 bg-cx-surface border-r border-white/8 flex flex-col">
          <div className="px-3 py-2 border-b border-white/8">
            <span className="text-[11px] font-semibold text-[var(--cx-text-3)] uppercase tracking-wider">Shapes</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {shapeLib.map((template) => (
              <button
                key={template.shapeKind}
                onClick={() => addShapeFromLib(template)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--cx-text-2)] hover:bg-cx-raised hover:text-[var(--cx-text-1)] transition-colors"
              >
                <ShapeIcon render={template.render} />
                {template.label}
              </button>
            ))}

            {/* Connector hint */}
            {connectorStart && (
              <div className="mt-4 p-2 bg-accent-green/10 border border-accent-green/30 rounded-lg">
                <p className="text-[11px] text-accent-green">Click a target shape to connect</p>
                <button
                  onClick={() => setConnectorStart(null)}
                  className="text-[10px] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] mt-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center - SVG Canvas */}
        <svg
          ref={svgRef}
          className="flex-1"
          style={{ cursor: panning ? 'grabbing' : tool === 'connector' ? 'crosshair' : 'default' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            {/* Grid pattern */}
            {showGrid && (
              <pattern id="dotgrid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse"
                x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
                <circle cx={1} cy={1} r={0.8} fill="rgba(255,255,255,0.06)" />
              </pattern>
            )}
            {/* Arrow marker */}
            <marker id="arrowhead" markerWidth={10} markerHeight={7} refX={9} refY={3.5} orient="auto" fill="rgba(255,255,255,0.40)">
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>

          {/* Background */}
          <rect width="100%" height="100%" fill="#09090B" />
          {showGrid && <rect width="100%" height="100%" fill="url(#dotgrid)" />}

          {/* Canvas group */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Connectors first (below shapes) */}
            {connectors.map(renderConnector)}
            {/* Shapes */}
            {shapes.map(renderShape)}
          </g>
        </svg>

        {/* Right - Properties Panel */}
        <div className="w-[200px] flex-shrink-0 bg-cx-surface border-l border-white/8 overflow-y-auto">
          <div className="p-3 border-b border-white/8">
            <h4 className="text-[11px] font-semibold text-[var(--cx-text-3)] uppercase tracking-wider">Properties</h4>
          </div>

          {selectedShape ? (
            <div className="p-3 space-y-4">
              <div>
                <span className="text-xs text-[var(--cx-text-2)] font-medium">{selectedShape.shapeKind}</span>
                <p className="text-[10px] text-[var(--cx-text-3)] capitalize mt-0.5">{selectedShape.type}</p>
              </div>

              {/* Text */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Text</label>
                <input
                  type="text" value={selectedShape.text}
                  onChange={(e) => updateShape(selectedShape.id, { text: e.target.value })}
                  className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                />
              </div>

              {/* Fill color */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Fill Color</label>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateShape(selectedShape.id, { fillColor: c })}
                      className={cn('w-7 h-7 rounded border-2', selectedShape.fillColor === c ? 'border-white' : 'border-transparent')}
                      style={{ backgroundColor: c + '40' }}
                    />
                  ))}
                </div>
                <input
                  type="color" value={selectedShape.fillColor}
                  onChange={(e) => updateShape(selectedShape.id, { fillColor: e.target.value })}
                  className="w-full h-6 rounded border border-white/8 cursor-pointer"
                />
              </div>

              {/* Border */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Border Color</label>
                <input
                  type="color" value={selectedShape.borderColor}
                  onChange={(e) => updateShape(selectedShape.id, { borderColor: e.target.value })}
                  className="w-full h-6 rounded border border-white/8 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Border Width</label>
                <input
                  type="range" min={0} max={6} value={selectedShape.borderWidth}
                  onChange={(e) => updateShape(selectedShape.id, { borderWidth: Number(e.target.value) })}
                  className="w-full accent-cx-brand"
                />
                <span className="text-[10px] text-[var(--cx-text-3)]">{selectedShape.borderWidth}px</span>
              </div>

              {/* Size */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[var(--cx-text-3)]">W</span>
                    <input
                      type="number" value={Math.round(selectedShape.width)}
                      onChange={(e) => updateShape(selectedShape.id, { width: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--cx-text-3)]">H</span>
                    <input
                      type="number" value={Math.round(selectedShape.height)}
                      onChange={(e) => updateShape(selectedShape.id, { height: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                    />
                  </div>
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[var(--cx-text-3)]">X</span>
                    <input
                      type="number" value={Math.round(selectedShape.x)}
                      onChange={(e) => updateShape(selectedShape.id, { x: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--cx-text-3)]">Y</span>
                    <input
                      type="number" value={Math.round(selectedShape.y)}
                      onChange={(e) => updateShape(selectedShape.id, { y: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                    />
                  </div>
                </div>
              </div>

              {/* Font size */}
              <div>
                <label className="block text-[11px] text-[var(--cx-text-3)] mb-1.5">Font Size</label>
                <input
                  type="number" min={8} max={48} value={selectedShape.fontSize}
                  onChange={(e) => updateShape(selectedShape.id, { fontSize: Number(e.target.value) })}
                  className="w-full h-7 px-2 rounded bg-cx-bg border border-white/8 text-xs text-[var(--cx-text-1)] focus:outline-none focus:border-cx-brand"
                />
              </div>

              {/* Delete */}
              <div className="pt-2 border-t border-white/8">
                <button
                  onClick={() => deleteShape(selectedShape.id)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-cx-danger hover:bg-cx-danger/10 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete Shape
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-xs text-[var(--cx-text-3)]">Select a shape to edit properties</p>
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] text-[var(--cx-text-3)] font-semibold uppercase tracking-wider">Diagram Info</p>
                <p className="text-xs text-[var(--cx-text-2)]">{shapes.length} shapes</p>
                <p className="text-xs text-[var(--cx-text-2)]">{connectors.length} connectors</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ShapeIcon({ render }: { render: string }) {
  switch (render) {
    case 'ellipse':
      return <Circle size={14} className="flex-shrink-0" />;
    case 'diamond':
      return <Diamond size={14} className="flex-shrink-0" />;
    case 'rounded-rect':
      return <Square size={14} className="flex-shrink-0 rounded" />;
    case 'person-card':
      return <User size={14} className="flex-shrink-0" />;
    case 'cylinder':
      return <Database size={14} className="flex-shrink-0" />;
    case 'parallelogram':
      return (
        <svg width={14} height={14} viewBox="0 0 14 14" className="flex-shrink-0">
          <polygon points="3,2 13,2 11,12 1,12" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      );
    default:
      return <Square size={14} className="flex-shrink-0" />;
  }
}
