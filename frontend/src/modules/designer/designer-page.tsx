import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Plus,
  ArrowLeft,
  Type,
  Square,
  Circle,
  Triangle,
  Star,
  Image,
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ZoomIn,
  ZoomOut,
  Download,
  Copy,
  Trash2,
  Bold,
  Italic,
  GripVertical,
  ChevronDown,
  Palette,
  Move,
  X,
} from 'lucide-react';

type ElementType = 'text' | 'rect' | 'circle' | 'triangle' | 'star' | 'image';

interface DesignElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  borderColor: string;
  borderWidth: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textColor?: string;
  imageUrl?: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

interface Design {
  id: string;
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  elements: DesignElement[];
  createdAt: string;
}

interface Template {
  name: string;
  width: number;
  height: number;
}

const TEMPLATES: Template[] = [
  { name: 'Instagram Post', width: 1080, height: 1080 },
  { name: 'Facebook Post', width: 1200, height: 630 },
  { name: 'YouTube Thumbnail', width: 1280, height: 720 },
  { name: 'Story', width: 1080, height: 1920 },
  { name: 'Twitter Header', width: 1500, height: 500 },
  { name: 'Presentation', width: 1920, height: 1080 },
];

const FONTS = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS', 'Times New Roman'];
const COLORS = ['#FFFFFF', '#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export function DesignerPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [activeDesign, setActiveDesign] = useState<Design | null>(null);
  const [selectedElement, setSelectedElement] = useState<DesignElement | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const [zoom, setZoom] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/designer/designs').then((res: any) => {
      if (res?.data) setDesigns(res.data);
    }).catch(() => {
      setDesigns([
        {
          id: '1',
          title: 'Marketing Banner',
          width: 1200,
          height: 630,
          backgroundColor: '#1E293B',
          createdAt: '2026-03-05',
          elements: [
            { id: 'e1', type: 'rect', x: 0, y: 0, width: 1200, height: 630, rotation: 0, opacity: 1, fill: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderColor: 'transparent', borderWidth: 0, visible: true, locked: false, zIndex: 0 },
            { id: 'e2', type: 'text', x: 100, y: 200, width: 600, height: 80, rotation: 0, opacity: 1, fill: 'transparent', borderColor: 'transparent', borderWidth: 0, text: 'Big Launch Event', fontSize: 64, fontFamily: 'Inter', fontWeight: 'bold', fontStyle: 'normal', textColor: '#FFFFFF', visible: true, locked: false, zIndex: 1 },
            { id: 'e3', type: 'text', x: 100, y: 300, width: 400, height: 40, rotation: 0, opacity: 0.8, fill: 'transparent', borderColor: 'transparent', borderWidth: 0, text: 'Join us for something amazing', fontSize: 24, fontFamily: 'Inter', fontWeight: 'normal', fontStyle: 'normal', textColor: '#E2E8F0', visible: true, locked: false, zIndex: 2 },
            { id: 'e4', type: 'circle', x: 900, y: 150, width: 200, height: 200, rotation: 0, opacity: 0.3, fill: '#FFFFFF', borderColor: 'transparent', borderWidth: 0, visible: true, locked: false, zIndex: 3 },
          ],
        },
      ]);
    });
  }, []);

  const handleCreateDesign = (template: Template | null) => {
    const w = template?.width || customWidth;
    const h = template?.height || customHeight;
    const newDesign: Design = {
      id: generateId(),
      title: template ? `${template.name} Design` : 'Untitled Design',
      width: w,
      height: h,
      backgroundColor: '#1E293B',
      elements: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDesigns((prev) => [...prev, newDesign]);
    setActiveDesign(newDesign);
    setShowTemplatePicker(false);
  };

  const updateDesign = useCallback((updater: (d: Design) => Design) => {
    setActiveDesign((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      setDesigns((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
      return updated;
    });
  }, []);

  const addElement = (type: ElementType) => {
    if (!activeDesign) return;
    const base: DesignElement = {
      id: generateId(),
      type,
      x: activeDesign.width / 4,
      y: activeDesign.height / 4,
      width: type === 'text' ? 300 : 150,
      height: type === 'text' ? 60 : 150,
      rotation: 0,
      opacity: 1,
      fill: type === 'text' ? 'transparent' : '#3B82F6',
      borderColor: 'transparent',
      borderWidth: 0,
      visible: true,
      locked: false,
      zIndex: activeDesign.elements.length,
    };

    if (type === 'text') {
      base.text = 'Edit this text';
      base.fontSize = 32;
      base.fontFamily = 'Inter';
      base.fontWeight = 'normal';
      base.fontStyle = 'normal';
      base.textColor = '#FFFFFF';
    }

    updateDesign((d) => ({ ...d, elements: [...d.elements, base] }));
    setSelectedElement(base);
  };

  const updateElement = (elementId: string, updates: Partial<DesignElement>) => {
    updateDesign((d) => ({
      ...d,
      elements: d.elements.map((e) => (e.id === elementId ? { ...e, ...updates } : e)),
    }));
    if (selectedElement?.id === elementId) {
      setSelectedElement((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  const deleteElement = (elementId: string) => {
    updateDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== elementId) }));
    if (selectedElement?.id === elementId) setSelectedElement(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent, element: DesignElement) => {
    if (element.locked) return;
    e.stopPropagation();
    setSelectedElement(element);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    setDragOffset({
      x: (e.clientX - canvasRect.left) / zoom - element.x,
      y: (e.clientY - canvasRect.top) / zoom - element.y,
    });
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = (e.clientX - canvasRect.left) / zoom - dragOffset.x;
    const newY = (e.clientY - canvasRect.top) / zoom - dragOffset.y;
    updateElement(selectedElement.id, { x: Math.round(newX), y: Math.round(newY) });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, element: DesignElement) => {
    e.stopPropagation();
    setSelectedElement(element);
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = element.width;
    const origH = element.height;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      updateElement(element.id, {
        width: Math.max(20, Math.round(origW + dx)),
        height: Math.max(20, Math.round(origH + dy)),
      });
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const renderElement = (el: DesignElement) => {
    if (!el.visible) return null;
    const style: React.CSSProperties = {
      position: 'absolute',
      left: el.x * zoom,
      top: el.y * zoom,
      width: el.width * zoom,
      height: el.height * zoom,
      opacity: el.opacity,
      transform: `rotate(${el.rotation}deg)`,
      zIndex: el.zIndex,
      cursor: el.locked ? 'default' : 'move',
    };

    const isSelected = selectedElement?.id === el.id;

    return (
      <div
        key={el.id}
        style={style}
        onMouseDown={(e) => handleCanvasMouseDown(e, el)}
        onDoubleClick={() => { if (el.type === 'text') setEditingTextId(el.id); }}
        className={cn('group', isSelected && 'ring-2 ring-accent-blue ring-offset-0')}
      >
        {el.type === 'text' && (
          editingTextId === el.id ? (
            <textarea
              autoFocus
              value={el.text || ''}
              onChange={(e) => updateElement(el.id, { text: e.target.value })}
              onBlur={() => setEditingTextId(null)}
              style={{
                fontSize: (el.fontSize || 32) * zoom,
                fontFamily: el.fontFamily,
                fontWeight: el.fontWeight as any,
                fontStyle: el.fontStyle,
                color: el.textColor,
              }}
              className="w-full h-full bg-transparent border-none outline-none resize-none"
            />
          ) : (
            <div
              style={{
                fontSize: (el.fontSize || 32) * zoom,
                fontFamily: el.fontFamily,
                fontWeight: el.fontWeight as any,
                fontStyle: el.fontStyle,
                color: el.textColor,
              }}
              className="w-full h-full flex items-start overflow-hidden whitespace-pre-wrap"
            >
              {el.text}
            </div>
          )
        )}
        {el.type === 'rect' && (
          <div className="w-full h-full rounded" style={{ background: el.fill, border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : 'none' }} />
        )}
        {el.type === 'circle' && (
          <div className="w-full h-full rounded-full" style={{ background: el.fill, border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : 'none' }} />
        )}
        {el.type === 'triangle' && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon points="50,5 95,95 5,95" fill={el.fill} stroke={el.borderColor} strokeWidth={el.borderWidth} />
          </svg>
        )}
        {el.type === 'star' && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon
              points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"
              fill={el.fill}
              stroke={el.borderColor}
              strokeWidth={el.borderWidth}
            />
          </svg>
        )}
        {el.type === 'image' && (
          <div className="w-full h-full bg-bg-secondary/50 border border-dashed border-border-primary flex items-center justify-center rounded">
            {el.imageUrl ? (
              <img src={el.imageUrl} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              <Image size={24 * zoom} className="text-text-secondary/30" />
            )}
          </div>
        )}
        {/* Resize handle */}
        {isSelected && !el.locked && (
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, el)}
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-accent-blue rounded-sm cursor-se-resize z-50"
          />
        )}
      </div>
    );
  };

  const handleExportPNG = () => {
    api.post('/designer/export', { designId: activeDesign?.id, format: 'png' }).catch(() => {});
  };

  const handleExportJPG = () => {
    api.post('/designer/export', { designId: activeDesign?.id, format: 'jpg' }).catch(() => {});
  };

  const handleCopyClipboard = () => {
    api.post('/designer/clipboard', { designId: activeDesign?.id }).catch(() => {});
  };

  // --- Design List View ---
  if (!activeDesign) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Designer</h1>
              <p className="text-text-secondary mt-1">Create stunning visual designs</p>
            </div>
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
            >
              <Plus size={16} />
              New Design
            </button>
          </div>

          {/* Template Picker Modal */}
          {showTemplatePicker && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 max-w-xl w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary">Choose a Size</h2>
                  <button onClick={() => setShowTemplatePicker(false)} className="text-text-secondary hover:text-text-primary">
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handleCreateDesign(t)}
                      className="bg-bg-primary border border-border-primary rounded-lg p-3 text-left hover:border-accent-blue transition-colors"
                    >
                      <p className="text-text-primary text-sm font-medium">{t.name}</p>
                      <p className="text-text-secondary text-xs mt-0.5">{t.width} x {t.height}</p>
                    </button>
                  ))}
                </div>
                <div className="border-t border-border-primary pt-4">
                  <p className="text-text-secondary text-xs mb-2">Custom Size</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="w-24 bg-bg-primary border border-border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                      placeholder="Width"
                    />
                    <X size={12} className="text-text-secondary" />
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="w-24 bg-bg-primary border border-border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                      placeholder="Height"
                    />
                    <button
                      onClick={() => handleCreateDesign(null)}
                      className="px-4 py-1.5 bg-accent-blue text-white rounded-lg text-sm hover:bg-accent-blue/90"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => (
              <button
                key={design.id}
                onClick={() => setActiveDesign(design)}
                className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden text-left hover:border-accent-blue/50 transition-colors group"
              >
                <div className="aspect-video flex items-center justify-center" style={{ backgroundColor: design.backgroundColor }}>
                  <Palette size={32} className="text-white/20" />
                </div>
                <div className="p-4">
                  <h3 className="text-text-primary font-semibold group-hover:text-accent-blue transition-colors">
                    {design.title}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {design.width} x {design.height} -- {design.elements.length} elements
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Editor View ---
  const sortedElements = [...activeDesign.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveDesign(null); setSelectedElement(null); }} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={18} />
          </button>
          <input
            value={activeDesign.title}
            onChange={(e) => updateDesign((d) => ({ ...d, title: e.target.value }))}
            className="bg-transparent text-text-primary font-semibold text-lg border-none outline-none focus:ring-1 focus:ring-accent-blue/30 rounded px-1"
          />
          <span className="text-xs text-text-secondary">{activeDesign.width} x {activeDesign.height}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Alignment tools */}
          <div className="flex items-center gap-0.5 border-r border-border-primary pr-2 mr-1">
            {[
              { icon: <AlignLeft size={14} />, label: 'Left' },
              { icon: <AlignCenter size={14} />, label: 'Center H' },
              { icon: <AlignRight size={14} />, label: 'Right' },
              { icon: <AlignStartVertical size={14} />, label: 'Top' },
              { icon: <AlignCenterVertical size={14} />, label: 'Middle' },
              { icon: <AlignEndVertical size={14} />, label: 'Bottom' },
            ].map((btn) => (
              <button
                key={btn.label}
                title={btn.label}
                onClick={() => {
                  if (!selectedElement || !activeDesign) return;
                  const updates: Partial<DesignElement> = {};
                  if (btn.label === 'Left') updates.x = 0;
                  if (btn.label === 'Center H') updates.x = (activeDesign.width - selectedElement.width) / 2;
                  if (btn.label === 'Right') updates.x = activeDesign.width - selectedElement.width;
                  if (btn.label === 'Top') updates.y = 0;
                  if (btn.label === 'Middle') updates.y = (activeDesign.height - selectedElement.height) / 2;
                  if (btn.label === 'Bottom') updates.y = activeDesign.height - selectedElement.height;
                  updateElement(selectedElement.id, updates);
                }}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded transition-colors"
              >
                {btn.icon}
              </button>
            ))}
          </div>
          {/* Zoom */}
          <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="text-text-secondary hover:text-text-primary p-1">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-text-secondary min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="text-text-secondary hover:text-text-primary p-1">
            <ZoomIn size={14} />
          </button>
          <div className="h-4 w-px bg-border-primary mx-1" />
          <button onClick={handleExportPNG} className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary border border-border-primary rounded hover:bg-bg-primary">
            <Download size={12} /> PNG
          </button>
          <button onClick={handleExportJPG} className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary border border-border-primary rounded hover:bg-bg-primary">
            <Download size={12} /> JPG
          </button>
          <button onClick={handleCopyClipboard} className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary border border-border-primary rounded hover:bg-bg-primary">
            <Copy size={12} /> Copy
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Elements + Layers */}
        <div className="w-56 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0">
          <div className="p-3 border-b border-border-primary">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Add Elements</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { type: 'text' as ElementType, icon: <Type size={16} />, label: 'Text' },
                { type: 'rect' as ElementType, icon: <Square size={16} />, label: 'Rect' },
                { type: 'circle' as ElementType, icon: <Circle size={16} />, label: 'Circle' },
                { type: 'triangle' as ElementType, icon: <Triangle size={16} />, label: 'Triangle' },
                { type: 'star' as ElementType, icon: <Star size={16} />, label: 'Star' },
                { type: 'image' as ElementType, icon: <Image size={16} />, label: 'Image' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => addElement(item.type)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border-primary hover:border-accent-blue hover:bg-accent-blue/5 transition-colors"
                >
                  <span className="text-text-primary">{item.icon}</span>
                  <span className="text-[10px] text-text-secondary">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layer Panel */}
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
              <Layers size={12} /> Layers
            </h3>
            <div className="space-y-0.5">
              {[...activeDesign.elements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                <div
                  key={el.id}
                  draggable
                  onDragStart={() => setLayerDragId(el.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (layerDragId && layerDragId !== el.id) {
                      const dragEl = activeDesign.elements.find((e) => e.id === layerDragId);
                      if (dragEl) {
                        const dragZ = dragEl.zIndex;
                        updateElement(layerDragId, { zIndex: el.zIndex });
                        updateElement(el.id, { zIndex: dragZ });
                      }
                    }
                    setLayerDragId(null);
                  }}
                  onClick={() => setSelectedElement(el)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors',
                    selectedElement?.id === el.id ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-primary hover:bg-bg-primary'
                  )}
                >
                  <GripVertical size={10} className="text-text-secondary/50 cursor-grab shrink-0" />
                  <span className="flex-1 truncate">{el.type === 'text' ? (el.text || 'Text').substring(0, 16) : el.type}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}
                    className="text-text-secondary hover:text-text-primary shrink-0"
                  >
                    {el.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); }}
                    className="text-text-secondary hover:text-text-primary shrink-0"
                  >
                    {el.locked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div
          className="flex-1 overflow-auto flex items-center justify-center bg-bg-primary/50 p-8"
          onClick={() => { setSelectedElement(null); setEditingTextId(null); }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          <div
            ref={canvasRef}
            className="relative shadow-2xl"
            style={{
              width: activeDesign.width * zoom,
              height: activeDesign.height * zoom,
              backgroundColor: activeDesign.backgroundColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sortedElements.map(renderElement)}
          </div>
        </div>

        {/* Right Panel: Properties */}
        <div className="w-64 bg-bg-secondary border-l border-border-primary p-4 overflow-y-auto shrink-0">
          {selectedElement ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary capitalize">{selectedElement.type} Properties</h3>
                <button onClick={() => deleteElement(selectedElement.id)} className="text-text-secondary hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Position</label>
                <div className="flex gap-2">
                  <div>
                    <span className="text-[10px] text-text-secondary">X</span>
                    <input
                      type="number"
                      value={selectedElement.x}
                      onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary">Y</span>
                    <input
                      type="number"
                      value={selectedElement.y}
                      onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Size</label>
                <div className="flex gap-2">
                  <div>
                    <span className="text-[10px] text-text-secondary">W</span>
                    <input
                      type="number"
                      value={selectedElement.width}
                      onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary">H</span>
                    <input
                      type="number"
                      value={selectedElement.height}
                      onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Opacity */}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Opacity: {Math.round(selectedElement.opacity * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedElement.opacity}
                  onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Fill Color */}
              {selectedElement.type !== 'text' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Fill Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateElement(selectedElement.id, { fill: c })}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 transition-colors',
                          selectedElement.fill === c ? 'border-accent-blue' : 'border-transparent hover:border-white/30'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Border */}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Border Width</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={selectedElement.borderWidth}
                  onChange={(e) => updateElement(selectedElement.id, { borderWidth: Number(e.target.value) })}
                  className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                />
              </div>

              {/* Text Properties */}
              {selectedElement.type === 'text' && (
                <>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Text</label>
                    <textarea
                      value={selectedElement.text || ''}
                      onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                      rows={2}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Font</label>
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    >
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedElement.fontSize || 32}
                      onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                      className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={cn('p-1.5 rounded', selectedElement.fontWeight === 'bold' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-secondary hover:bg-bg-primary')}
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      onClick={() => updateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={cn('p-1.5 rounded', selectedElement.fontStyle === 'italic' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-secondary hover:bg-bg-primary')}
                    >
                      <Italic size={14} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Text Color</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateElement(selectedElement.id, { textColor: c })}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 transition-colors',
                            selectedElement.textColor === c ? 'border-accent-blue' : 'border-transparent hover:border-white/30'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Canvas Settings</h3>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Background Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateDesign((d) => ({ ...d, backgroundColor: c }))}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-colors',
                        activeDesign.backgroundColor === c ? 'border-accent-blue' : 'border-transparent hover:border-white/30'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
