import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  GitFork,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Type,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Download,
  Undo2,
  Redo2,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type DiagramType = 'flowchart' | 'orgchart' | 'mindmap' | 'uml' | 'network';

interface DiagramNode {
  id: string;
  type: 'rectangle' | 'circle' | 'diamond' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface Diagram {
  id: string;
  title: string;
  type: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  updatedAt: string;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const DIAGRAM_TYPES: { type: DiagramType; label: string }[] = [
  { type: 'flowchart', label: 'Flowchart' },
  { type: 'orgchart', label: 'Org Chart' },
  { type: 'mindmap', label: 'Mind Map' },
  { type: 'uml', label: 'UML' },
  { type: 'network', label: 'Network' },
];

const NODE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

// ──────────────────────────────────────────────
// Canvas Editor
// ──────────────────────────────────────────────

function DiagramCanvas({
  diagram,
  onUpdate,
}: {
  diagram: Diagram;
  onUpdate: (updates: Partial<Diagram>) => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle' | 'circle' | 'diamond' | 'text' | 'connect'>('select');
  const [zoom, setZoom] = useState(100);
  const [dragState, setDragState] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      setSelectedNodeId(null);
      return;
    }

    if (activeTool === 'connect') return;

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (100 / zoom);
    const y = (e.clientY - rect.top) * (100 / zoom);

    const nodeType = activeTool === 'text' ? 'text' : activeTool;
    const node: DiagramNode = {
      id: generateId(),
      type: nodeType,
      x: x - 50,
      y: y - 25,
      width: nodeType === 'circle' ? 80 : 120,
      height: nodeType === 'circle' ? 80 : nodeType === 'diamond' ? 80 : 50,
      label: nodeType === 'text' ? 'Text' : 'Node',
      color: NODE_COLORS[diagram.nodes.length % NODE_COLORS.length],
    };

    onUpdate({ nodes: [...diagram.nodes, node] });
    setSelectedNodeId(node.id);
    setActiveTool('select');
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    if (activeTool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeId);
      } else if (connectFrom !== nodeId) {
        const edge: DiagramEdge = { id: generateId(), from: connectFrom, to: nodeId };
        onUpdate({ edges: [...diagram.edges, edge] });
        setConnectFrom(null);
        setActiveTool('select');
      }
      return;
    }

    setSelectedNodeId(nodeId);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const node = diagram.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setDragState({
      nodeId,
      offsetX: (e.clientX - rect.left) * (100 / zoom) - node.x,
      offsetY: (e.clientY - rect.top) * (100 / zoom) - node.y,
    });
    setSelectedNodeId(nodeId);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (100 / zoom) - dragState.offsetX;
      const y = (e.clientY - rect.top) * (100 / zoom) - dragState.offsetY;
      onUpdate({
        nodes: diagram.nodes.map((n) =>
          n.id === dragState.nodeId ? { ...n, x, y } : n
        ),
      });
    },
    [dragState, zoom, diagram.nodes, onUpdate]
  );

  const handleMouseUp = () => {
    setDragState(null);
  };

  const deleteNode = (nodeId: string) => {
    onUpdate({
      nodes: diagram.nodes.filter((n) => n.id !== nodeId),
      edges: diagram.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    });
    setSelectedNodeId(null);
  };

  const updateNodeLabel = (nodeId: string, label: string) => {
    onUpdate({
      nodes: diagram.nodes.map((n) => (n.id === nodeId ? { ...n, label } : n)),
    });
  };

  const selectedNode = diagram.nodes.find((n) => n.id === selectedNodeId);

  const getNodeCenter = (node: DiagramNode) => ({
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  });

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left toolbar */}
      <div className="w-12 bg-bg-secondary border-r border-border-primary flex flex-col items-center py-3 gap-1">
        {[
          { tool: 'select' as const, icon: <MousePointer2 size={16} />, label: 'Select' },
          { tool: 'rectangle' as const, icon: <Square size={16} />, label: 'Rectangle' },
          { tool: 'circle' as const, icon: <Circle size={16} />, label: 'Circle' },
          { tool: 'diamond' as const, icon: <Diamond size={16} />, label: 'Diamond' },
          { tool: 'text' as const, icon: <Type size={16} />, label: 'Text' },
          { tool: 'connect' as const, icon: <ArrowRight size={16} />, label: 'Connect' },
        ].map(({ tool, icon, label }) => (
          <button
            key={tool}
            onClick={() => { setActiveTool(tool); setConnectFrom(null); }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              activeTool === tool ? 'bg-accent-violet/20 text-accent-violet' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
            )}
            title={label}
          >
            {icon}
          </button>
        ))}

        <div className="flex-1" />

        <button onClick={() => setZoom((z) => Math.max(25, z - 25))} className="p-2 text-text-secondary hover:text-text-primary">
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-text-secondary">{zoom}%</span>
        <button onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-2 text-text-secondary hover:text-text-primary">
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-bg-primary">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ minWidth: '2000px', minHeight: '1500px', transform: `scale(${zoom / 100})`, transformOrigin: '0 0' }}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair"
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-border-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {diagram.edges.map((edge) => {
            const fromNode = diagram.nodes.find((n) => n.id === edge.from);
            const toNode = diagram.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const from = getNodeCenter(fromNode);
            const to = getNodeCenter(toNode);
            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#6B7280"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
            </marker>
          </defs>

          {/* Nodes */}
          {diagram.nodes.map((node) => (
            <g
              key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              className="cursor-move"
            >
              {node.type === 'rectangle' && (
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={6}
                  fill={node.color}
                  opacity={0.15}
                  stroke={selectedNodeId === node.id ? '#3B82F6' : node.color}
                  strokeWidth={selectedNodeId === node.id ? 2.5 : 1.5}
                />
              )}
              {node.type === 'circle' && (
                <ellipse
                  cx={node.x + node.width / 2}
                  cy={node.y + node.height / 2}
                  rx={node.width / 2}
                  ry={node.height / 2}
                  fill={node.color}
                  opacity={0.15}
                  stroke={selectedNodeId === node.id ? '#3B82F6' : node.color}
                  strokeWidth={selectedNodeId === node.id ? 2.5 : 1.5}
                />
              )}
              {node.type === 'diamond' && (
                <polygon
                  points={`${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`}
                  fill={node.color}
                  opacity={0.15}
                  stroke={selectedNodeId === node.id ? '#3B82F6' : node.color}
                  strokeWidth={selectedNodeId === node.id ? 2.5 : 1.5}
                />
              )}
              <text
                x={node.x + node.width / 2}
                y={node.y + node.height / 2 + 4}
                textAnchor="middle"
                className="fill-text-primary text-xs pointer-events-none select-none"
              >
                {node.label}
              </text>
            </g>
          ))}

          {/* Connection line preview */}
          {connectFrom && (
            <circle
              cx={getNodeCenter(diagram.nodes.find((n) => n.id === connectFrom)!).x}
              cy={getNodeCenter(diagram.nodes.find((n) => n.id === connectFrom)!).y}
              r={8}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2}
              strokeDasharray="4"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>

      {/* Properties panel */}
      {selectedNode && (
        <aside className="w-56 bg-bg-secondary border-l border-border-primary p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Properties</h3>
            <button onClick={() => setSelectedNodeId(null)} className="text-text-secondary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Label</label>
              <input
                value={selectedNode.label}
                onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent-violet"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {NODE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      onUpdate({
                        nodes: diagram.nodes.map((n) => (n.id === selectedNode.id ? { ...n, color: c } : n)),
                      })
                    }
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform',
                      selectedNode.color === c ? 'border-white scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main: DiagramsPage
// ──────────────────────────────────────────────

export function DiagramsPage() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  useEffect(() => {
    api.get('/diagrams').then((data: any) => {
      if (Array.isArray(data?.data)) setDiagrams(data.data);
      else if (Array.isArray(data)) setDiagrams(data);
    }).catch(() => {});
  }, []);

  const activeDiagram = diagrams.find((d) => d.id === activeId) ?? null;

  const createDiagram = (type: DiagramType) => {
    const diagram: Diagram = {
      id: generateId(),
      title: `New ${DIAGRAM_TYPES.find((t) => t.type === type)?.label || 'Diagram'}`,
      type,
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    };
    setDiagrams((prev) => [diagram, ...prev]);
    setActiveId(diagram.id);
    setShowNewDialog(false);
    api.post('/diagrams', { title: diagram.title, type }).catch(() => {});
  };

  const deleteDiagram = (id: string) => {
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(null);
    api.delete(`/diagrams/${id}`).catch(() => {});
  };

  const handleUpdate = (updates: Partial<Diagram>) => {
    if (!activeId) return;
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      )
    );
  };

  const filteredDiagrams = diagrams.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // List view
  if (!activeDiagram) {
    return (
      <div className="flex flex-col h-full bg-bg-primary text-text-primary">
        <header className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Diagrams</h1>
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-violet text-white rounded-lg text-sm font-medium hover:bg-accent-violet/90 transition-colors"
          >
            <Plus size={16} />
            New Diagram
          </button>
        </header>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-lg px-3 py-2">
            <Search size={16} className="text-text-secondary" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search diagrams..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filteredDiagrams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-secondary">
              <GitFork size={48} className="mb-3 opacity-30" />
              <p className="text-sm">
                {diagrams.length === 0 ? 'No diagrams yet. Create one to get started.' : 'No diagrams match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDiagrams.map((diagram) => (
                <div
                  key={diagram.id}
                  onClick={() => setActiveId(diagram.id)}
                  className="bg-bg-secondary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-accent-violet/50 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-violet/10 flex items-center justify-center">
                      <GitFork size={20} className="text-accent-violet" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDiagram(diagram.id); }}
                      className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="text-sm font-medium text-text-primary truncate mb-1">{diagram.title}</h3>
                  <p className="text-xs text-text-secondary">
                    {DIAGRAM_TYPES.find((t) => t.type === diagram.type)?.label} &middot;
                    {diagram.nodes.length} nodes &middot; {timeAgo(diagram.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New diagram dialog */}
        {showNewDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60" onClick={() => setShowNewDialog(false)} />
            <div className="relative bg-bg-secondary border border-border-primary rounded-xl shadow-lg p-6 w-96">
              <h2 className="text-lg font-semibold text-text-primary mb-4">New Diagram</h2>
              <div className="grid grid-cols-2 gap-3">
                {DIAGRAM_TYPES.map((dt) => (
                  <button
                    key={dt.type}
                    onClick={() => createDiagram(dt.type)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border-primary hover:border-accent-violet transition-colors"
                  >
                    <GitFork size={24} className="text-accent-violet" />
                    <span className="text-sm text-text-primary">{dt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowNewDialog(false)}
                className="mt-4 w-full text-center text-sm text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editor view
  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary">
      <header className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveId(null)} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <input
            value={activeDiagram.title}
            onChange={(e) => handleUpdate({ title: e.target.value })}
            className="text-lg font-semibold bg-transparent text-text-primary outline-none border-none"
            placeholder="Untitled Diagram"
          />
          <span className="text-xs text-text-secondary px-2 py-0.5 bg-bg-primary rounded">
            {DIAGRAM_TYPES.find((t) => t.type === activeDiagram.type)?.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {activeDiagram.nodes.length} nodes &middot; {activeDiagram.edges.length} edges
          </span>
          <button className="p-1.5 text-text-secondary hover:text-text-primary" title="Export">
            <Download size={16} />
          </button>
        </div>
      </header>

      <DiagramCanvas diagram={activeDiagram} onUpdate={handleUpdate} />
    </div>
  );
}
