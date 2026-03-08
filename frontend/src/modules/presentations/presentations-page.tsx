import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  ChevronLeft,
  Play,
  Copy,
  Type,
  Square,
  Circle,
  ArrowRight,
  ImageIcon,
  Palette,
  GripVertical,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  X,
  Presentation,
  SlidersHorizontal,
  ChevronRight,
  Maximize,
  Minimize,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SlideElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  shapeType?: 'rect' | 'circle' | 'arrow';
  fillColor: string;
  borderColor: string;
  fontSize: number;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
}

interface Slide {
  id: string;
  elements: SlideElement[];
  background: string;
  notes: string;
}

interface PresentationData {
  id: string;
  title: string;
  theme: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

const THEMES = [
  { id: 'dark', name: 'Dark', bg: '#0f0f1a', text: '#ffffff', accent: '#3b82f6' },
  { id: 'light', name: 'Light', bg: '#ffffff', text: '#1a1a2e', accent: '#3b82f6' },
  { id: 'midnight', name: 'Midnight', bg: '#1a1a2e', text: '#e2e8f0', accent: '#8b5cf6' },
  { id: 'forest', name: 'Forest', bg: '#0a1a0a', text: '#d4edda', accent: '#22c55e' },
  { id: 'sunset', name: 'Sunset', bg: '#1a0a0a', text: '#fce4ec', accent: '#ef4444' },
  { id: 'ocean', name: 'Ocean', bg: '#0a1a2e', text: '#e0f2fe', accent: '#06b6d4' },
];

const SHAPE_TYPES = [
  { type: 'rect' as const, label: 'Rectangle', icon: Square },
  { type: 'circle' as const, label: 'Circle', icon: Circle },
  { type: 'arrow' as const, label: 'Arrow', icon: ArrowRight },
];

let idSeq = 0;
function uid() {
  return `el_${Date.now()}_${++idSeq}`;
}

function makeSlide(): Slide {
  return { id: uid(), elements: [], background: '', notes: '' };
}

/* ------------------------------------------------------------------ */
/*  PresentationsPage                                                  */
/* ------------------------------------------------------------------ */

export function PresentationsPage() {
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [active, setActive] = useState<PresentationData | null>(null);

  /* Editor state */
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentSlideIdx, setPresentSlideIdx] = useState(0);
  const [shapeDropdown, setShapeDropdown] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideIdx: number } | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTheme, setNewTheme] = useState('dark');

  /* Drag state */
  const [draggingElement, setDraggingElement] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizingElement, setResizingElement] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [reorderDrag, setReorderDrag] = useState<{ fromIdx: number; overIdx: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSlide = slides[currentSlideIdx] || null;
  const selectedElement = currentSlide?.elements.find((e) => e.id === selectedElementId) || null;
  const activeTheme = THEMES.find((t) => t.id === active?.theme) || THEMES[0];

  /* -- Fetch presentations -- */

  const fetchPresentations = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/presentations');
      setPresentations(data.data ?? data ?? []);
    } catch {
      /* offline fallback */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  /* -- Debounced save -- */

  const savePres = useCallback(async (p: PresentationData, s: Slide[]) => {
    try {
      await api.patch(`/presentations/${p.id}`, { slides: s, title: p.title, theme: p.theme });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => savePres(active, slides), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [slides, active, savePres]);

  /* -- Presentation key handler -- */

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPresenting(false); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setPresentSlideIdx((i) => Math.min(i + 1, slides.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        setPresentSlideIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, slides.length]);

  /* -- Close context menu on click -- */

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  /* -- CRUD -- */

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data } = await api.post('/presentations', {
        title: newTitle.trim(),
        theme: newTheme,
        slides: [makeSlide()],
      });
      const created = data.data ?? data;
      setPresentations((prev) => [...prev, created]);
      setShowCreateModal(false);
      setNewTitle('');
      openPresentation(created);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/presentations/${id}`);
      setPresentations((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
  };

  const openPresentation = async (p: PresentationData) => {
    try {
      const { data } = await api.get(`/presentations/${p.id}`);
      const full = data.data ?? data;
      setActive(full);
      setSlides(full.slides?.length ? full.slides : [makeSlide()]);
    } catch {
      setActive(p);
      setSlides(p.slides?.length ? p.slides : [makeSlide()]);
    }
    setCurrentSlideIdx(0);
    setSelectedElementId(null);
    setMode('editor');
  };

  const goBack = () => {
    if (active) savePres(active, slides);
    setMode('list');
    setActive(null);
    setSlides([]);
    fetchPresentations();
  };

  /* -- Slide operations -- */

  const addSlide = () => {
    const ns = makeSlide();
    setSlides((prev) => {
      const next = [...prev];
      next.splice(currentSlideIdx + 1, 0, ns);
      return next;
    });
    setCurrentSlideIdx((i) => i + 1);
  };

  const duplicateSlide = (idx: number) => {
    const src = slides[idx];
    const dup: Slide = { ...JSON.parse(JSON.stringify(src)), id: uid() };
    setSlides((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
    setCurrentSlideIdx(idx + 1);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    if (currentSlideIdx >= slides.length - 1) setCurrentSlideIdx(Math.max(0, slides.length - 2));
    else if (idx <= currentSlideIdx) setCurrentSlideIdx((i) => Math.max(0, i - 1));
  };

  const moveSlide = (from: number, to: number) => {
    if (from === to || to < 0 || to >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setCurrentSlideIdx(to);
  };

  /* -- Element operations -- */

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const updateElement = (elId: string, patch: Partial<SlideElement>) => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === currentSlideIdx
          ? { ...s, elements: s.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) }
          : s
      )
    );
  };

  const removeElement = (elId: string) => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === currentSlideIdx ? { ...s, elements: s.elements.filter((e) => e.id !== elId) } : s
      )
    );
    if (selectedElementId === elId) setSelectedElementId(null);
  };

  const addTextBox = () => {
    const el: SlideElement = {
      id: uid(), type: 'text', x: 100, y: 100, width: 300, height: 60,
      content: 'Click to edit text', shapeType: undefined, fillColor: 'transparent',
      borderColor: 'transparent', fontSize: 24, fontWeight: 'normal', textAlign: 'left',
    };
    updateSlide(currentSlideIdx, { elements: [...(currentSlide?.elements || []), el] });
    setSelectedElementId(el.id);
  };

  const addShape = (shapeType: 'rect' | 'circle' | 'arrow') => {
    const el: SlideElement = {
      id: uid(), type: 'shape', x: 150, y: 150, width: 160, height: shapeType === 'arrow' ? 40 : 120,
      content: '', shapeType, fillColor: activeTheme.accent, borderColor: 'transparent',
      fontSize: 16, fontWeight: 'normal', textAlign: 'center',
    };
    updateSlide(currentSlideIdx, { elements: [...(currentSlide?.elements || []), el] });
    setSelectedElementId(el.id);
    setShapeDropdown(false);
  };

  const addImage = () => {
    const el: SlideElement = {
      id: uid(), type: 'image', x: 120, y: 100, width: 300, height: 200,
      content: '', shapeType: undefined, fillColor: '#1a1a2e', borderColor: '#ffffff20',
      fontSize: 14, fontWeight: 'normal', textAlign: 'center',
    };
    updateSlide(currentSlideIdx, { elements: [...(currentSlide?.elements || []), el] });
    setSelectedElementId(el.id);
  };

  /* -- Drag handlers on canvas -- */

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedElementId(null);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: SlideElement) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setDraggingElement({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: SlideElement) => {
    e.stopPropagation();
    setResizingElement({ id: el.id, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height });
  };

  useEffect(() => {
    if (!draggingElement && !resizingElement) return;
    const onMove = (e: MouseEvent) => {
      if (draggingElement) {
        const dx = e.clientX - draggingElement.startX;
        const dy = e.clientY - draggingElement.startY;
        const scale = canvasRef.current ? canvasRef.current.clientWidth / 960 : 1;
        updateElement(draggingElement.id, {
          x: Math.max(0, draggingElement.origX + dx / scale),
          y: Math.max(0, draggingElement.origY + dy / scale),
        });
      }
      if (resizingElement) {
        const dx = e.clientX - resizingElement.startX;
        const dy = e.clientY - resizingElement.startY;
        const scale = canvasRef.current ? canvasRef.current.clientWidth / 960 : 1;
        updateElement(resizingElement.id, {
          width: Math.max(40, resizingElement.origW + dx / scale),
          height: Math.max(20, resizingElement.origH + dy / scale),
        });
      }
    };
    const onUp = () => {
      setDraggingElement(null);
      setResizingElement(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  /* -- Render helpers -- */

  const renderSlideElement = (el: SlideElement, interactive: boolean) => {
    const isSelected = interactive && selectedElementId === el.id;

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      cursor: interactive ? 'move' : 'default',
      outline: isSelected ? '2px solid #3b82f6' : 'none',
      outlineOffset: 2,
    };

    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          style={wrapperStyle}
          onMouseDown={interactive ? (e) => handleElementMouseDown(e, el) : undefined}
        >
          {interactive && isSelected ? (
            <textarea
              value={el.content}
              onChange={(e) => updateElement(el.id, { content: e.target.value })}
              style={{
                width: '100%', height: '100%', background: 'transparent', border: 'none',
                outline: 'none', resize: 'none', color: activeTheme.text, fontSize: el.fontSize,
                fontWeight: el.fontWeight, textAlign: el.textAlign, fontFamily: 'inherit',
                lineHeight: 1.3, padding: 4,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', color: activeTheme.text, fontSize: el.fontSize,
              fontWeight: el.fontWeight, textAlign: el.textAlign, lineHeight: 1.3,
              whiteSpace: 'pre-wrap', overflow: 'hidden', padding: 4,
            }}>
              {el.content}
            </div>
          )}
          {isSelected && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, el)}
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize"
            />
          )}
        </div>
      );
    }

    if (el.type === 'shape') {
      const shapeContent = () => {
        if (el.shapeType === 'circle') {
          return (
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              backgroundColor: el.fillColor, border: el.borderColor !== 'transparent' ? `2px solid ${el.borderColor}` : undefined,
            }} />
          );
        }
        if (el.shapeType === 'arrow') {
          return (
            <svg width="100%" height="100%" viewBox={`0 0 ${el.width} ${el.height}`}>
              <line x1={0} y1={el.height / 2} x2={el.width - 20} y2={el.height / 2} stroke={el.fillColor} strokeWidth={3} />
              <polygon points={`${el.width - 20},${el.height / 2 - 10} ${el.width},${el.height / 2} ${el.width - 20},${el.height / 2 + 10}`} fill={el.fillColor} />
            </svg>
          );
        }
        return (
          <div style={{
            width: '100%', height: '100%', borderRadius: 4,
            backgroundColor: el.fillColor, border: el.borderColor !== 'transparent' ? `2px solid ${el.borderColor}` : undefined,
          }} />
        );
      };

      return (
        <div
          key={el.id}
          style={wrapperStyle}
          onMouseDown={interactive ? (e) => handleElementMouseDown(e, el) : undefined}
        >
          {shapeContent()}
          {isSelected && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, el)}
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize"
            />
          )}
        </div>
      );
    }

    if (el.type === 'image') {
      return (
        <div
          key={el.id}
          style={wrapperStyle}
          onMouseDown={interactive ? (e) => handleElementMouseDown(e, el) : undefined}
        >
          <div className="w-full h-full rounded flex items-center justify-center border border-white/10"
            style={{ backgroundColor: el.fillColor }}>
            <ImageIcon size={32} className="text-white/20" />
          </div>
          {isSelected && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, el)}
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize"
            />
          )}
        </div>
      );
    }

    return null;
  };

  const renderSlidePreview = (slide: Slide, size: 'sm' | 'md') => {
    const w = size === 'sm' ? 160 : 200;
    const h = w * 9 / 16;
    const scale = w / 960;

    return (
      <div
        style={{
          width: w, height: h, position: 'relative', overflow: 'hidden',
          backgroundColor: slide.background || activeTheme.bg, borderRadius: 4,
        }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 960, height: 540 }}>
          {slide.elements.map((el) => renderSlideElement(el, false))}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Fullscreen Presentation                                          */
  /* ---------------------------------------------------------------- */

  if (presenting) {
    const pSlide = slides[presentSlideIdx];
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: pSlide?.background || activeTheme.bg }}
        onClick={() => setPresentSlideIdx((i) => Math.min(i + 1, slides.length - 1))}
      >
        <div style={{ width: '100vw', height: '56.25vw', maxHeight: '100vh', maxWidth: '177.78vh', position: 'relative' }}>
          <div style={{
            width: 960, height: 540, position: 'absolute', top: 0, left: 0,
            transform: 'scale(var(--s))', transformOrigin: 'top left',
          }}
            ref={(el) => {
              if (el) {
                const parent = el.parentElement!;
                const s = Math.min(parent.clientWidth / 960, parent.clientHeight / 540);
                el.style.setProperty('--s', String(s));
              }
            }}
          >
            {pSlide?.elements.map((e) => renderSlideElement(e, false))}
          </div>
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white/60 text-xs">
          {presentSlideIdx + 1} / {slides.length}
        </div>

        {/* Exit button */}
        <button
          onClick={(e) => { e.stopPropagation(); setPresenting(false); }}
          className="absolute top-4 right-4 p-2 rounded-lg bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-colors"
        >
          <Minimize size={18} />
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render - List View                                               */
  /* ---------------------------------------------------------------- */

  if (mode === 'list') {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="h-14 flex items-center gap-3 px-6 border-b border-border-primary flex-shrink-0">
          <Presentation size={18} className="text-accent-blue" />
          <h1 className="text-base font-semibold text-text-primary">Presentations</h1>
          <div className="flex-1" />
          <button
            onClick={() => { setNewTitle(''); setNewTheme('dark'); setShowCreateModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-accent-blue text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Presentation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-bg-secondary border border-border-primary rounded-lg h-48 animate-pulse" />
              ))}
            </div>
          ) : presentations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Presentation size={48} className="text-text-tertiary mb-3" />
              <p className="text-base text-text-secondary mb-1">No presentations</p>
              <p className="text-sm text-text-tertiary mb-4">Create your first presentation</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                Create Presentation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {presentations.map((p) => {
                const theme = THEMES.find((t) => t.id === p.theme) || THEMES[0];
                return (
                  <div
                    key={p.id}
                    className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden cursor-pointer hover:border-accent-blue/40 transition-colors group"
                  >
                    <div
                      onClick={() => openPresentation(p)}
                      className="h-32 flex items-center justify-center"
                      style={{ backgroundColor: theme.bg }}
                    >
                      <Presentation size={28} style={{ color: theme.accent, opacity: 0.3 }} />
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1" onClick={() => openPresentation(p)}>
                        <h3 className="text-sm font-medium text-text-primary truncate">{p.title}</h3>
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {p.slides?.length || 0} slides &middot;{' '}
                          {new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="p-1 rounded hover:bg-bg-hover text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-accent-red transition-all"
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

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreateModal(false)}>
            <div className="bg-bg-secondary border border-border-primary rounded-xl w-[460px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-text-primary">New Presentation</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1.5">Title</label>
                  <input
                    autoFocus type="text" placeholder="My Presentation" value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="w-full h-9 px-3 rounded-lg bg-bg-primary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-tertiary mb-2">Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setNewTheme(t.id)}
                        className={cn(
                          'rounded-lg p-2 border-2 transition-colors',
                          newTheme === t.id ? 'border-accent-blue' : 'border-border-primary hover:border-border-secondary'
                        )}
                      >
                        <div className="h-10 rounded mb-1.5" style={{ backgroundColor: t.bg }}>
                          <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-1 rounded-full" style={{ backgroundColor: t.accent }} />
                          </div>
                        </div>
                        <span className="text-[11px] text-text-secondary">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 rounded-lg text-sm text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={!newTitle.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-accent-blue text-white hover:opacity-90 transition-opacity disabled:opacity-40">
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
  /*  Render - Editor View                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden select-none">
      {/* Top toolbar */}
      <div className="h-11 flex items-center gap-2 px-3 border-b border-border-primary flex-shrink-0 bg-bg-secondary">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">{active?.title}</span>
        <div className="w-px h-5 bg-border-primary mx-2" />

        {/* Slide tools */}
        <button onClick={addTextBox} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors" title="Add text box">
          <Type size={14} />
          <span className="hidden lg:inline">Text</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShapeDropdown((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            title="Add shape"
          >
            <Square size={14} />
            <span className="hidden lg:inline">Shape</span>
            <ChevronDown size={10} />
          </button>
          {shapeDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-xl py-1 z-20 w-36">
              {SHAPE_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => addShape(type)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={addImage} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors" title="Add image">
          <ImageIcon size={14} />
          <span className="hidden lg:inline">Image</span>
        </button>

        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Background color */}
        <label className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-bg-hover cursor-pointer" title="Slide background">
          <Palette size={14} />
          <input
            type="color"
            value={currentSlide?.background || activeTheme.bg}
            onChange={(e) => updateSlide(currentSlideIdx, { background: e.target.value })}
            className="w-0 h-0 opacity-0 absolute"
          />
          <span className="hidden lg:inline">Background</span>
        </label>

        {/* Theme */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            title="Change theme"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden lg:inline">Theme</span>
          </button>
          {showThemePicker && (
            <div className="absolute top-full right-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-xl py-2 px-2 z-20 w-48">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (active) setActive({ ...active, theme: t.id });
                    setShowThemePicker(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                    active?.theme === t.id ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  <div className="w-4 h-4 rounded-full border border-border-primary" style={{ backgroundColor: t.bg }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Present */}
        <button
          onClick={() => { setPresentSlideIdx(currentSlideIdx); setPresenting(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-accent-blue text-white hover:opacity-90 transition-opacity"
        >
          <Play size={14} />
          Present
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Filmstrip */}
        <div className="w-[180px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Slides</span>
            <button onClick={addSlide} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors" title="Add slide">
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                onClick={() => { setCurrentSlideIdx(idx); setSelectedElementId(null); }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, slideIdx: idx }); }}
                draggable
                onDragStart={() => setReorderDrag({ fromIdx: idx, overIdx: idx })}
                onDragOver={(e) => { e.preventDefault(); if (reorderDrag) setReorderDrag({ ...reorderDrag, overIdx: idx }); }}
                onDrop={() => { if (reorderDrag) { moveSlide(reorderDrag.fromIdx, idx); setReorderDrag(null); } }}
                onDragEnd={() => setReorderDrag(null)}
                className={cn(
                  'rounded-lg overflow-hidden cursor-pointer border-2 transition-colors',
                  idx === currentSlideIdx ? 'border-accent-blue' : 'border-transparent hover:border-border-secondary',
                  reorderDrag?.overIdx === idx && reorderDrag.fromIdx !== idx ? 'border-accent-blue/50' : ''
                )}
              >
                <div className="flex items-center gap-1 px-1.5 py-0.5">
                  <GripVertical size={10} className="text-text-tertiary cursor-grab" />
                  <span className="text-[10px] text-text-tertiary">{idx + 1}</span>
                </div>
                {renderSlidePreview(slide, 'sm')}
              </div>
            ))}
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-6 bg-bg-primary overflow-auto">
            <div
              ref={canvasRef}
              className="relative shadow-2xl"
              style={{
                width: '100%',
                maxWidth: 960,
                aspectRatio: '16 / 9',
                backgroundColor: currentSlide?.background || activeTheme.bg,
                borderRadius: 4,
                overflow: 'hidden',
              }}
              onMouseDown={handleCanvasMouseDown}
            >
              {currentSlide?.elements.map((el) => renderSlideElement(el, true))}
            </div>
          </div>

          {/* Speaker notes */}
          <div className={cn('border-t border-border-primary bg-bg-secondary flex-shrink-0 transition-all', showNotes ? 'h-32' : 'h-8')}>
            <button
              onClick={() => setShowNotes((v) => !v)}
              className="w-full h-8 flex items-center gap-2 px-4 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {showNotes ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              Speaker Notes
            </button>
            {showNotes && (
              <textarea
                value={currentSlide?.notes || ''}
                onChange={(e) => updateSlide(currentSlideIdx, { notes: e.target.value })}
                placeholder="Add speaker notes..."
                className="w-full h-[calc(100%-2rem)] px-4 pb-2 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Right - Properties Panel */}
        <div className="w-[220px] flex-shrink-0 bg-bg-secondary border-l border-border-primary overflow-y-auto">
          <div className="p-3 border-b border-border-primary">
            <h4 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Properties</h4>
          </div>

          {selectedElement ? (
            <div className="p-3 space-y-4">
              <div>
                <span className="text-xs text-text-tertiary capitalize">{selectedElement.type}{selectedElement.shapeType ? ` (${selectedElement.shapeType})` : ''}</span>
              </div>

              {/* Position */}
              <div>
                <label className="block text-[11px] text-text-tertiary mb-1.5">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-text-tertiary">X</span>
                    <input
                      type="number" value={Math.round(selectedElement.x)}
                      onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-tertiary">Y</span>
                    <input
                      type="number" value={Math.round(selectedElement.y)}
                      onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="block text-[11px] text-text-tertiary mb-1.5">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-text-tertiary">W</span>
                    <input
                      type="number" value={Math.round(selectedElement.width)}
                      onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-tertiary">H</span>
                    <input
                      type="number" value={Math.round(selectedElement.height)}
                      onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Fill color */}
              <div>
                <label className="block text-[11px] text-text-tertiary mb-1.5">Fill Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color" value={selectedElement.fillColor === 'transparent' ? '#000000' : selectedElement.fillColor}
                    onChange={(e) => updateElement(selectedElement.id, { fillColor: e.target.value })}
                    className="w-7 h-7 rounded border border-border-primary cursor-pointer"
                  />
                  <input
                    type="text" value={selectedElement.fillColor}
                    onChange={(e) => updateElement(selectedElement.id, { fillColor: e.target.value })}
                    className="flex-1 h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              {/* Text properties */}
              {selectedElement.type === 'text' && (
                <>
                  <div>
                    <label className="block text-[11px] text-text-tertiary mb-1.5">Font Size</label>
                    <input
                      type="number" min={8} max={120} value={selectedElement.fontSize}
                      onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-tertiary mb-1.5">Font Weight</label>
                    <select
                      value={selectedElement.fontWeight}
                      onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value })}
                      className="w-full h-7 px-2 rounded bg-bg-primary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-tertiary mb-1.5">Text Align</label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => updateElement(selectedElement.id, { textAlign: a })}
                          className={cn(
                            'flex-1 py-1 rounded text-[10px] transition-colors capitalize',
                            selectedElement.textAlign === a
                              ? 'bg-accent-blue/20 text-accent-blue'
                              : 'text-text-tertiary hover:bg-bg-hover'
                          )}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Delete */}
              <div className="pt-2 border-t border-border-primary">
                <button
                  onClick={() => removeElement(selectedElement.id)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-accent-red hover:bg-accent-red/10 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete Element
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-xs text-text-tertiary">Select an element to edit its properties</p>
              <div className="mt-4 space-y-2">
                <p className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider">Slide Info</p>
                <p className="text-xs text-text-secondary">
                  Slide {currentSlideIdx + 1} of {slides.length}
                </p>
                <p className="text-xs text-text-secondary">
                  {currentSlide?.elements.length || 0} elements
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context menu for slides */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-bg-secondary border border-border-primary rounded-lg shadow-xl py-1 w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { duplicateSlide(contextMenu.slideIdx); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <Copy size={12} />
            Duplicate Slide
          </button>
          {contextMenu.slideIdx > 0 && (
            <button
              onClick={() => { moveSlide(contextMenu.slideIdx, contextMenu.slideIdx - 1); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <ChevronUp size={12} />
              Move Up
            </button>
          )}
          {contextMenu.slideIdx < slides.length - 1 && (
            <button
              onClick={() => { moveSlide(contextMenu.slideIdx, contextMenu.slideIdx + 1); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <ChevronDown size={12} />
              Move Down
            </button>
          )}
          {slides.length > 1 && (
            <>
              <div className="h-px bg-border-primary my-1" />
              <button
                onClick={() => { deleteSlide(contextMenu.slideIdx); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 transition-colors"
              >
                <Trash2 size={12} />
                Delete Slide
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
