import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Columns,
  Search,
  Highlighter,
  StickyNote,
  PenTool,
  Type,
  PenLine,
  MessageSquare,
  Trash2,
  RotateCw,
  Scissors,
  Merge,
  Droplets,
  X,
  Plus,
  Minus,
  ChevronDown,
  Download,
  Eye,
  Palette,
  GripVertical,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PdfFile {
  id: string;
  name: string;
  pageCount: number;
  size: number;
  uploadedAt: string;
}

type AnnotationType = 'highlight' | 'note' | 'freehand' | 'textbox' | 'signature';

interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  content: string;
  points?: number[][];
  createdAt: string;
}

const HIGHLIGHT_COLORS = ['#facc15', '#4ade80', '#60a5fa', '#f87171', '#c084fc'];

const ANNOTATION_TOOLS: { type: AnnotationType; icon: typeof Highlighter; label: string }[] = [
  { type: 'highlight', icon: Highlighter, label: 'Highlight' },
  { type: 'note', icon: StickyNote, label: 'Text Note' },
  { type: 'freehand', icon: PenTool, label: 'Freehand Draw' },
  { type: 'textbox', icon: Type, label: 'Text Box' },
  { type: 'signature', icon: PenLine, label: 'Signature' },
];

let annIdSeq = 0;
function annUid() {
  return `ann_${Date.now()}_${++annIdSeq}`;
}

/* ------------------------------------------------------------------ */
/*  PdfPage                                                            */
/* ------------------------------------------------------------------ */

export function PdfPage() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'viewer'>('list');
  const [activeFile, setActiveFile] = useState<PdfFile | null>(null);

  /* Viewer state */
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [twoPageView, setTwoPageView] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);

  /* Annotations */
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationType | null>(null);
  const [highlightColor, setHighlightColor] = useState('#facc15');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);

  /* Tools panel */
  const [showTools, setShowTools] = useState(false);
  const [activePdfTool, setActivePdfTool] = useState<'merge' | 'split' | 'rotate' | 'watermark' | null>(null);
  const [splitRange, setSplitRange] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkPos, setWatermarkPos] = useState<'center' | 'top' | 'bottom'>('center');
  const [mergeFiles, setMergeFiles] = useState<PdfFile[]>([]);

  /* Signature modal */
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sigDrawing, setSigDrawing] = useState(false);

  const pageCanvasRef = useRef<HTMLDivElement>(null);

  const totalPages = activeFile?.pageCount || 10;

  /* -- Fetch files -- */

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/files', { params: { type: 'pdf' } });
      setFiles(data.data ?? data ?? []);
    } catch {
      /* offline fallback */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  /* -- Keyboard shortcuts -- */

  useEffect(() => {
    if (mode !== 'viewer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  /* -- File actions -- */

  const handleUpload = async () => {
    try {
      const { data } = await api.post('/files/upload', { type: 'pdf' });
      const uploaded = data.data ?? data;
      if (uploaded) setFiles((prev) => [uploaded, ...prev]);
    } catch { /* ignore */ }
  };

  const openFile = async (file: PdfFile) => {
    try {
      const { data } = await api.get(`/files/${file.id}`);
      const full = data.data ?? data;
      setActiveFile(full);
    } catch {
      setActiveFile(file);
    }
    setCurrentPage(1);
    setZoom(1);
    setAnnotations([]);
    setActiveTool(null);
    setSelectedAnnotation(null);
    setMode('viewer');

    /* Load annotations */
    try {
      const { data } = await api.get(`/files/${file.id}/annotations`);
      setAnnotations(data.data ?? data ?? []);
    } catch { /* ignore */ }
  };

  const goBack = () => {
    setMode('list');
    setActiveFile(null);
    setAnnotations([]);
    fetchFiles();
  };

  /* -- Page navigation -- */

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  /* -- Zoom -- */

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleFitWidth = () => setZoom(1);

  /* -- Annotation handling -- */

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!activeTool || activeTool === 'freehand' || activeTool === 'signature') return;

    const rect = pageCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (activeTool === 'highlight') {
      const ann: Annotation = {
        id: annUid(), type: 'highlight', page: currentPage,
        x, y: y - 10, width: 200, height: 24, color: highlightColor,
        content: '', createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, ann]);
    } else if (activeTool === 'note') {
      const ann: Annotation = {
        id: annUid(), type: 'note', page: currentPage,
        x, y, width: 24, height: 24, color: '#facc15',
        content: 'Note...', createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, ann]);
    } else if (activeTool === 'textbox') {
      const ann: Annotation = {
        id: annUid(), type: 'textbox', page: currentPage,
        x, y, width: 180, height: 40, color: '#3b82f6',
        content: 'Type here...', createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, ann]);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'freehand') return;
    const rect = pageCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDrawing(true);
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setDrawPoints([[x, y]]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || activeTool !== 'freehand') return;
    const rect = pageCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setDrawPoints((prev) => [...prev, [x, y]]);
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing || activeTool !== 'freehand') return;
    setIsDrawing(false);
    if (drawPoints.length > 1) {
      const minX = Math.min(...drawPoints.map((p) => p[0]));
      const minY = Math.min(...drawPoints.map((p) => p[1]));
      const maxX = Math.max(...drawPoints.map((p) => p[0]));
      const maxY = Math.max(...drawPoints.map((p) => p[1]));
      const ann: Annotation = {
        id: annUid(), type: 'freehand', page: currentPage,
        x: minX, y: minY, width: maxX - minX, height: maxY - minY,
        color: highlightColor, content: '', points: drawPoints,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, ann]);
    }
    setDrawPoints([]);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnotation === id) setSelectedAnnotation(null);
  };

  /* -- Signature modal -- */

  const handleSignatureSave = () => {
    /* In a real app we'd capture the canvas content. Here we place a placeholder. */
    const ann: Annotation = {
      id: annUid(), type: 'signature', page: currentPage,
      x: 100, y: 300, width: 200, height: 60, color: '#1a1a2e',
      content: 'Signature', createdAt: new Date().toISOString(),
    };
    setAnnotations((prev) => [...prev, ann]);
    setShowSignatureModal(false);
  };

  const handleSigCanvasMouseDown = () => setSigDrawing(true);
  const handleSigCanvasMouseUp = () => setSigDrawing(false);
  const handleSigCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sigDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  };

  /* -- Render annotation overlay -- */

  const renderAnnotation = (ann: Annotation) => {
    if (ann.page !== currentPage) return null;
    const isSel = selectedAnnotation === ann.id;

    if (ann.type === 'highlight') {
      return (
        <div
          key={ann.id}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann.id); }}
          className={cn('absolute rounded-sm cursor-pointer', isSel && 'ring-2 ring-accent-blue')}
          style={{
            left: ann.x * zoom, top: ann.y * zoom,
            width: ann.width * zoom, height: ann.height * zoom,
            backgroundColor: ann.color + '50',
          }}
        />
      );
    }

    if (ann.type === 'note') {
      return (
        <div
          key={ann.id}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann.id); }}
          className={cn('absolute cursor-pointer', isSel && 'ring-2 ring-accent-blue rounded')}
          style={{ left: ann.x * zoom, top: ann.y * zoom }}
        >
          <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center shadow-sm">
            <MessageSquare size={12} className="text-yellow-900" />
          </div>
          {isSel && (
            <div className="absolute top-7 left-0 w-48 p-2 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-10">
              <textarea
                value={ann.content}
                onChange={(e) => setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? { ...a, content: e.target.value } : a)))}
                className="w-full h-20 bg-bg-primary border border-border-primary rounded text-xs text-text-primary p-2 resize-none focus:outline-none focus:border-accent-blue"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      );
    }

    if (ann.type === 'freehand' && ann.points) {
      const pathD = ann.points.reduce((d, [px, py], i) => d + (i === 0 ? `M${px * zoom},${py * zoom}` : ` L${px * zoom},${py * zoom}`), '');
      return (
        <svg
          key={ann.id}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <path d={pathD} fill="none" stroke={ann.color} strokeWidth={2 * zoom} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (ann.type === 'textbox') {
      return (
        <div
          key={ann.id}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann.id); }}
          className={cn('absolute border rounded cursor-pointer', isSel && 'ring-2 ring-accent-blue')}
          style={{
            left: ann.x * zoom, top: ann.y * zoom,
            width: ann.width * zoom, height: ann.height * zoom,
            borderColor: ann.color + '80',
          }}
        >
          {isSel ? (
            <textarea
              value={ann.content}
              onChange={(e) => setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? { ...a, content: e.target.value } : a)))}
              className="w-full h-full bg-transparent text-text-primary text-xs p-1 resize-none focus:outline-none"
              style={{ fontSize: 12 * zoom }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="w-full h-full p-1 text-text-primary text-xs overflow-hidden" style={{ fontSize: 12 * zoom }}>
              {ann.content}
            </div>
          )}
        </div>
      );
    }

    if (ann.type === 'signature') {
      return (
        <div
          key={ann.id}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann.id); }}
          className={cn('absolute rounded border border-dashed cursor-pointer flex items-center justify-center', isSel && 'ring-2 ring-accent-blue')}
          style={{
            left: ann.x * zoom, top: ann.y * zoom,
            width: ann.width * zoom, height: ann.height * zoom,
            borderColor: '#6366f1',
          }}
        >
          <span className="text-text-secondary italic" style={{ fontSize: 16 * zoom }}>Signature</span>
        </div>
      );
    }

    return null;
  };

  /* -- Render PDF page placeholder -- */

  const renderPagePlaceholder = (pageNum: number, w: number, h: number) => (
    <div
      className="flex items-center justify-center border border-border-secondary rounded"
      style={{ width: w, height: h, backgroundColor: '#1e1e2e' }}
    >
      <div className="text-center">
        <FileText size={24} className="text-text-tertiary mx-auto mb-1" />
        <span className="text-xs text-text-tertiary">Page {pageNum}</span>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render - File List                                               */
  /* ---------------------------------------------------------------- */

  if (mode === 'list') {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="h-14 flex items-center gap-3 px-6 border-b border-border-primary flex-shrink-0">
          <FileText size={18} className="text-accent-red" />
          <h1 className="text-base font-semibold text-text-primary">PDF Viewer &amp; Tools</h1>
          <div className="flex-1" />
          <button
            onClick={handleUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-accent-blue text-white hover:opacity-90 transition-opacity"
          >
            <Upload size={14} />
            Upload PDF
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-bg-secondary border border-border-primary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FileText size={48} className="text-text-tertiary mb-3" />
              <p className="text-base text-text-secondary mb-1">No PDF files</p>
              <p className="text-sm text-text-tertiary mb-4">Upload a PDF to get started</p>
              <button
                onClick={handleUpload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm hover:opacity-90 transition-opacity"
              >
                <Upload size={14} />
                Upload PDF
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => openFile(file)}
                  className="flex items-center gap-4 px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg cursor-pointer hover:border-accent-blue/40 transition-colors group"
                >
                  <div className="w-10 h-12 bg-accent-red/10 rounded flex items-center justify-center flex-shrink-0">
                    <FileText size={20} className="text-accent-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">{file.name}</h3>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {file.pageCount} pages &middot; {(file.size / 1024).toFixed(0)} KB &middot;{' '}
                      {new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <button className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary opacity-0 group-hover:opacity-100 transition-all">
                    <Eye size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render - Viewer                                                  */
  /* ---------------------------------------------------------------- */

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden select-none">
      {/* Top toolbar */}
      <div className="h-11 flex items-center gap-2 px-3 border-b border-border-primary flex-shrink-0 bg-bg-secondary">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">{activeFile?.name}</span>

        <div className="w-px h-5 bg-border-primary mx-2" />

        {/* Page navigation */}
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-center gap-1">
          <input
            type="number" min={1} max={totalPages} value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="w-10 h-6 text-center rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <span className="text-xs text-text-tertiary">/ {totalPages}</span>
        </div>
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors">
          <ChevronRight size={14} />
        </button>

        <div className="w-px h-5 bg-border-primary mx-2" />

        {/* Zoom */}
        <button onClick={handleZoomOut} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
          <ZoomOut size={14} />
        </button>
        <span className="text-[11px] text-text-tertiary min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleFitWidth} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors" title="Fit width">
          <Maximize size={14} />
        </button>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* View toggle */}
        <button
          onClick={() => setTwoPageView((v) => !v)}
          className={cn('p-1 rounded transition-colors', twoPageView ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary')}
          title="Two-page view"
        >
          <Columns size={14} />
        </button>

        {/* Search */}
        <button
          onClick={() => setShowSearch((v) => !v)}
          className={cn('p-1 rounded transition-colors', showSearch ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary')}
          title="Search (Ctrl+F)"
        >
          <Search size={14} />
        </button>

        <div className="flex-1" />

        {/* Annotation tools */}
        <div className="flex items-center gap-0.5">
          {ANNOTATION_TOOLS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => {
                if (type === 'signature') {
                  setShowSignatureModal(true);
                } else {
                  setActiveTool(activeTool === type ? null : type);
                }
              }}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                activeTool === type ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary'
              )}
              title={label}
            >
              <Icon size={14} />
            </button>
          ))}

          {/* Highlight color picker */}
          {activeTool === 'highlight' && (
            <div className="relative ml-1">
              <button
                onClick={() => setShowColorPicker((v) => !v)}
                className="w-5 h-5 rounded border border-border-primary"
                style={{ backgroundColor: highlightColor }}
              />
              {showColorPicker && (
                <div className="absolute top-full right-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg p-2 flex gap-1 z-20">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setHighlightColor(c); setShowColorPicker(false); }}
                      className={cn('w-6 h-6 rounded-full border-2', highlightColor === c ? 'border-white' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* PDF Tools */}
        <button
          onClick={() => setShowTools((v) => !v)}
          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
            showTools ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary'
          )}
        >
          <Scissors size={13} />
          <span className="hidden lg:inline">Tools</span>
        </button>

        {/* Annotations panel toggle */}
        <button
          onClick={() => setShowAnnotations((v) => !v)}
          className={cn('p-1.5 rounded-lg transition-colors',
            showAnnotations ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary'
          )}
          title="Annotations"
        >
          <MessageSquare size={14} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="h-10 flex items-center gap-2 px-4 border-b border-border-primary bg-bg-secondary flex-shrink-0">
          <Search size={14} className="text-text-tertiary" />
          <input
            autoFocus type="text" placeholder="Search in document..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-7 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Thumbnails */}
        {showThumbnails && (
          <div className="w-[140px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Pages</span>
              <button onClick={() => setShowThumbnails(false)} className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary">
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    'w-full rounded-lg overflow-hidden border-2 transition-colors',
                    currentPage === i + 1 ? 'border-accent-blue' : 'border-transparent hover:border-border-secondary'
                  )}
                >
                  <div className="bg-[#1e1e2e] aspect-[3/4] flex items-center justify-center">
                    <span className="text-xs text-text-tertiary">{i + 1}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Center - Document */}
        <div className="flex-1 overflow-auto flex flex-col items-center py-6 px-4"
          style={{ backgroundColor: '#161622' }}
        >
          {!showThumbnails && (
            <button
              onClick={() => setShowThumbnails(true)}
              className="absolute left-2 top-14 z-10 p-1 rounded bg-bg-secondary border border-border-primary text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}

          {twoPageView ? (
            <div className="flex gap-4">
              <div className="relative">
                {renderPagePlaceholder(currentPage, 440 * zoom, 620 * zoom)}
              </div>
              {currentPage + 1 <= totalPages && (
                <div className="relative">
                  {renderPagePlaceholder(currentPage + 1, 440 * zoom, 620 * zoom)}
                </div>
              )}
            </div>
          ) : (
            <div
              ref={pageCanvasRef}
              className="relative"
              style={{ width: 595 * zoom, height: 842 * zoom, cursor: activeTool ? 'crosshair' : 'default' }}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={() => { if (isDrawing) handleCanvasMouseUp(); }}
            >
              {/* PDF page placeholder */}
              <div
                className="w-full h-full rounded flex flex-col items-center justify-center border border-border-secondary"
                style={{ backgroundColor: '#1e1e2e' }}
              >
                <FileText size={48 * zoom} className="text-text-tertiary mb-2" />
                <span className="text-text-tertiary" style={{ fontSize: 14 * zoom }}>Page {currentPage}</span>
                <span className="text-text-tertiary mt-1" style={{ fontSize: 11 * zoom }}>{activeFile?.name}</span>

                {/* Simulated text lines */}
                <div className="mt-6 w-3/4 space-y-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded"
                      style={{
                        height: 8 * zoom,
                        width: `${60 + Math.random() * 40}%`,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Annotation overlays */}
              {annotations.map(renderAnnotation)}

              {/* Active freehand drawing */}
              {isDrawing && drawPoints.length > 1 && (
                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                  <path
                    d={drawPoints.reduce((d, [px, py], i) => d + (i === 0 ? `M${px * zoom},${py * zoom}` : ` L${px * zoom},${py * zoom}`), '')}
                    fill="none" stroke={highlightColor} strokeWidth={2 * zoom} strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Right - Annotations panel */}
        {showAnnotations && (
          <div className="w-[220px] flex-shrink-0 bg-bg-secondary border-l border-border-primary flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Annotations</span>
              <span className="text-[10px] text-text-tertiary">{annotations.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {annotations.length === 0 ? (
                <p className="text-xs text-text-tertiary p-3">No annotations yet</p>
              ) : (
                <div className="divide-y divide-border-primary">
                  {annotations.map((ann) => (
                    <div
                      key={ann.id}
                      onClick={() => { setSelectedAnnotation(ann.id); setCurrentPage(ann.page); }}
                      className={cn(
                        'px-3 py-2 cursor-pointer transition-colors',
                        selectedAnnotation === ann.id ? 'bg-bg-active' : 'hover:bg-bg-hover'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-secondary capitalize font-medium">{ann.type}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-tertiary">p.{ann.page}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                            className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-accent-red transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      {ann.content && (
                        <p className="text-[11px] text-text-tertiary truncate">{ann.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools panel (right side, replaces annotations when open) */}
        {showTools && !showAnnotations && (
          <div className="w-[240px] flex-shrink-0 bg-bg-secondary border-l border-border-primary flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">PDF Tools</span>
              <button onClick={() => setShowTools(false)} className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary">
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Merge */}
              <div className="space-y-2">
                <button
                  onClick={() => setActivePdfTool(activePdfTool === 'merge' ? null : 'merge')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    activePdfTool === 'merge' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  <Merge size={14} />
                  Merge PDFs
                </button>
                {activePdfTool === 'merge' && (
                  <div className="pl-3 space-y-2">
                    <p className="text-[11px] text-text-tertiary">Drag files to reorder</p>
                    {mergeFiles.length === 0 ? (
                      <p className="text-[11px] text-text-tertiary italic">No files added</p>
                    ) : (
                      <div className="space-y-1">
                        {mergeFiles.map((f, i) => (
                          <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-bg-primary rounded text-xs text-text-secondary">
                            <GripVertical size={10} className="text-text-tertiary cursor-grab" />
                            <span className="truncate flex-1">{f.name}</span>
                            <button onClick={() => setMergeFiles((prev) => prev.filter((_, idx) => idx !== i))} className="p-0.5 text-text-tertiary hover:text-accent-red">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { if (activeFile) setMergeFiles((prev) => [...prev, activeFile]); }}
                      className="text-[11px] text-accent-blue hover:underline"
                    >
                      + Add current file
                    </button>
                    <button className="w-full py-1.5 rounded-lg bg-accent-blue text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-40" disabled={mergeFiles.length < 2}>
                      Merge
                    </button>
                  </div>
                )}
              </div>

              {/* Split */}
              <div className="space-y-2">
                <button
                  onClick={() => setActivePdfTool(activePdfTool === 'split' ? null : 'split')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    activePdfTool === 'split' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  <Scissors size={14} />
                  Split PDF
                </button>
                {activePdfTool === 'split' && (
                  <div className="pl-3 space-y-2">
                    <label className="text-[11px] text-text-tertiary">Page range (e.g. 1-3, 5, 7-10)</label>
                    <input
                      type="text" value={splitRange} onChange={(e) => setSplitRange(e.target.value)}
                      placeholder="1-3, 5, 7-10"
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                    />
                    <button className="w-full py-1.5 rounded-lg bg-accent-blue text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-40" disabled={!splitRange.trim()}>
                      Split
                    </button>
                  </div>
                )}
              </div>

              {/* Rotate */}
              <button
                onClick={() => { /* rotate current page */ }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <RotateCw size={14} />
                Rotate Page
              </button>

              {/* Watermark */}
              <div className="space-y-2">
                <button
                  onClick={() => setActivePdfTool(activePdfTool === 'watermark' ? null : 'watermark')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    activePdfTool === 'watermark' ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  <Droplets size={14} />
                  Watermark
                </button>
                {activePdfTool === 'watermark' && (
                  <div className="pl-3 space-y-2">
                    <label className="text-[11px] text-text-tertiary">Text</label>
                    <input
                      type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="CONFIDENTIAL"
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                    />
                    <label className="text-[11px] text-text-tertiary">Position</label>
                    <div className="flex gap-1">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setWatermarkPos(pos)}
                          className={cn(
                            'flex-1 py-1 rounded text-[10px] capitalize transition-colors',
                            watermarkPos === pos ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-tertiary hover:bg-bg-hover'
                          )}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    <button className="w-full py-1.5 rounded-lg bg-accent-blue text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-40" disabled={!watermarkText.trim()}>
                      Apply Watermark
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowSignatureModal(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-xl w-[420px] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary">Draw Signature</h3>
              <button onClick={() => setShowSignatureModal(false)} className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="border border-border-primary rounded-lg overflow-hidden mb-3 bg-bg-primary">
              <canvas
                ref={sigCanvasRef}
                width={380}
                height={120}
                className="cursor-crosshair"
                onMouseDown={(e) => {
                  handleSigCanvasMouseDown();
                  const canvas = sigCanvasRef.current;
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    if (ctx) { ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top); }
                  }
                }}
                onMouseUp={handleSigCanvasMouseUp}
                onMouseLeave={handleSigCanvasMouseUp}
                onMouseMove={handleSigCanvasMouseMove}
              />
            </div>
            <div className="flex justify-between">
              <button onClick={clearSigCanvas} className="px-3 py-1.5 rounded-lg text-sm text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors">
                Clear
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowSignatureModal(false)} className="px-3 py-1.5 rounded-lg text-sm text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors">
                  Cancel
                </button>
                <button onClick={handleSignatureSave} className="px-3 py-1.5 rounded-lg text-sm bg-accent-blue text-white hover:opacity-90 transition-opacity">
                  Place Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
