import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Scissors,
  Type,
  Upload,
  ArrowLeft,
  Plus,
  Film,
  Music,
  Image,
  Layers,
  ChevronDown,
  Download,
  ZoomIn,
  ZoomOut,
  Trash2,
  SkipBack,
  SkipForward,
  Volume2,
  Sparkles,
  Clock,
  X,
  FileVideo,
  FileAudio,
  FileImage,
  Wand2,
} from 'lucide-react';

interface MediaClip {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  duration: number;
  url: string;
  thumbnail?: string;
}

interface TimelineClip {
  id: string;
  mediaId: string;
  name: string;
  track: 'video' | 'audio' | 'text';
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  color: string;
  text?: string;
  speed: number;
  filter?: string;
}

interface Project {
  id: string;
  title: string;
  createdAt: string;
  duration: number;
  thumbnail: string;
  clips: TimelineClip[];
  media: MediaClip[];
}

const RESOLUTIONS = ['720p (1280x720)', '1080p (1920x1080)'];
const FORMATS = ['MP4', 'WebM'];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const FILTERS = ['None', 'Grayscale', 'Sepia', 'Vintage', 'Warm', 'Cool', 'Cinematic', 'High Contrast'];
const TRANSITIONS = ['Cut', 'Fade', 'Dissolve', 'Slide Left', 'Slide Right', 'Zoom'];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function VideoEditorPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedClip, setSelectedClip] = useState<TimelineClip | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResolution, setExportResolution] = useState(RESOLUTIONS[1]);
  const [exportFormat, setExportFormat] = useState(FORMATS[0]);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTransitionMenu, setShowTransitionMenu] = useState(false);
  const [dragEdge, setDragEdge] = useState<{ clipId: string; edge: 'left' | 'right' } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/video-editor/projects').then((res: any) => {
      const arr = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : null;
      if (arr) setProjects(arr);
    }).catch(() => {
      setProjects([
        {
          id: '1',
          title: 'Product Demo',
          createdAt: '2026-03-04',
          duration: 125,
          thumbnail: '',
          clips: [
            { id: 'c1', mediaId: 'm1', name: 'Intro.mp4', track: 'video', start: 0, duration: 30, trimStart: 0, trimEnd: 0, color: '#3B82F6', speed: 1 },
            { id: 'c2', mediaId: 'm2', name: 'Main.mp4', track: 'video', start: 30, duration: 60, trimStart: 0, trimEnd: 0, color: '#10B981', speed: 1 },
            { id: 'c3', mediaId: 'm3', name: 'Outro.mp4', track: 'video', start: 90, duration: 35, trimStart: 0, trimEnd: 0, color: '#F59E0B', speed: 1 },
            { id: 'c4', mediaId: 'm4', name: 'BGM.mp3', track: 'audio', start: 0, duration: 125, trimStart: 0, trimEnd: 0, color: '#8B5CF6', speed: 1 },
            { id: 'c5', mediaId: '', name: 'Title Card', track: 'text', start: 2, duration: 5, trimStart: 0, trimEnd: 0, color: '#EC4899', speed: 1, text: 'Welcome to Our Product' },
          ],
          media: [
            { id: 'm1', name: 'Intro.mp4', type: 'video', duration: 30, url: '' },
            { id: 'm2', name: 'Main.mp4', type: 'video', duration: 65, url: '' },
            { id: 'm3', name: 'Outro.mp4', type: 'video', duration: 40, url: '' },
            { id: 'm4', name: 'BGM.mp3', type: 'audio', duration: 180, url: '' },
            { id: 'm5', name: 'Logo.png', type: 'image', duration: 0, url: '' },
          ],
        },
        {
          id: '2',
          title: 'Training Video',
          createdAt: '2026-02-28',
          duration: 340,
          thumbnail: '',
          clips: [],
          media: [],
        },
      ]);
    });
  }, []);

  useEffect(() => {
    if (isPlaying && activeProject) {
      playInterval.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= (activeProject.duration || 125)) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, [isPlaying, activeProject]);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: generateId(),
      title: 'Untitled Project',
      createdAt: new Date().toISOString().split('T')[0],
      duration: 0,
      thumbnail: '',
      clips: [],
      media: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProject(newProject);
  };

  const handleUploadMedia = () => {
    if (!activeProject) return;
    const types: ('video' | 'audio' | 'image')[] = ['video', 'audio', 'image'];
    const t = types[Math.floor(Math.random() * types.length)];
    const newMedia: MediaClip = {
      id: generateId(),
      name: `${t === 'video' ? 'Clip' : t === 'audio' ? 'Track' : 'Image'}_${Date.now().toString(36)}.${t === 'video' ? 'mp4' : t === 'audio' ? 'mp3' : 'png'}`,
      type: t,
      duration: t === 'image' ? 0 : Math.floor(Math.random() * 60) + 10,
      url: '',
    };
    const updated = { ...activeProject, media: [...activeProject.media, newMedia] };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleAddToTimeline = (media: MediaClip) => {
    if (!activeProject) return;
    const track: 'video' | 'audio' | 'text' = media.type === 'audio' ? 'audio' : 'video';
    const trackClips = activeProject.clips.filter((c) => c.track === track);
    const lastEnd = trackClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    const newClip: TimelineClip = {
      id: generateId(),
      mediaId: media.id,
      name: media.name,
      track,
      start: lastEnd,
      duration: media.duration || 10,
      trimStart: 0,
      trimEnd: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 1,
    };
    const updatedClips = [...activeProject.clips, newClip];
    const totalDuration = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    const updated = { ...activeProject, clips: updatedClips, duration: totalDuration };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleSplitAtPlayhead = () => {
    if (!activeProject || !selectedClip) return;
    const splitPoint = currentTime;
    if (splitPoint <= selectedClip.start || splitPoint >= selectedClip.start + selectedClip.duration) return;
    const firstDuration = splitPoint - selectedClip.start;
    const secondDuration = selectedClip.duration - firstDuration;
    const first = { ...selectedClip, duration: firstDuration };
    const second = { ...selectedClip, id: generateId(), start: splitPoint, duration: secondDuration, name: selectedClip.name + ' (2)' };
    const updatedClips = activeProject.clips.map((c) => (c.id === selectedClip.id ? first : c));
    updatedClips.push(second);
    const updated = { ...activeProject, clips: updatedClips };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedClip(null);
  };

  const handleAddTextOverlay = () => {
    if (!activeProject) return;
    const newClip: TimelineClip = {
      id: generateId(),
      mediaId: '',
      name: 'Text Overlay',
      track: 'text',
      start: currentTime,
      duration: 5,
      trimStart: 0,
      trimEnd: 0,
      color: '#EC4899',
      speed: 1,
      text: 'Enter text here',
    };
    const updatedClips = [...activeProject.clips, newClip];
    const totalDuration = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    const updated = { ...activeProject, clips: updatedClips, duration: totalDuration };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedClip(newClip);
  };

  const handleDeleteClip = (clipId: string) => {
    if (!activeProject) return;
    const updatedClips = activeProject.clips.filter((c) => c.id !== clipId);
    const totalDuration = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    const updated = { ...activeProject, clips: updatedClips, duration: totalDuration };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedClip?.id === clipId) setSelectedClip(null);
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 300);
    api.post('/video-editor/export', {
      projectId: activeProject?.id,
      resolution: exportResolution,
      format: exportFormat,
    }).catch(() => {});
  };

  const totalDuration = activeProject?.duration || 120;
  const pxPerSecond = 8 * zoom;

  const MediaIcon = ({ type }: { type: string }) => {
    if (type === 'video') return <FileVideo size={14} />;
    if (type === 'audio') return <FileAudio size={14} />;
    return <FileImage size={14} />;
  };

  // --- Project List View ---
  if (!activeProject) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Video Editor</h1>
              <p className="text-text-secondary mt-1">Create and edit video projects</p>
            </div>
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProject(project)}
                className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden text-left hover:border-accent-blue/50 transition-colors group"
              >
                <div className="aspect-video bg-bg-primary flex items-center justify-center">
                  <Film size={32} className="text-text-secondary/30" />
                </div>
                <div className="p-4">
                  <h3 className="text-text-primary font-semibold group-hover:text-accent-blue transition-colors">
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-text-secondary mt-2">
                    <span>{project.createdAt}</span>
                    <span>{formatTime(project.duration)}</span>
                    <span>{project.clips.length} clips</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Editor View ---
  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveProject(null); setSelectedClip(null); setIsPlaying(false); }} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={18} />
          </button>
          <input
            value={activeProject.title}
            onChange={(e) => {
              const updated = { ...activeProject, title: e.target.value };
              setActiveProject(updated);
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
            className="bg-transparent text-text-primary font-semibold text-lg border-none outline-none focus:ring-1 focus:ring-accent-blue/30 rounded px-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Media Library */}
        <div className="w-56 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0">
          <div className="p-3 border-b border-border-primary">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Media Library</h3>
            <button
              onClick={handleUploadMedia}
              className="flex items-center gap-1 w-full px-3 py-1.5 text-sm border border-dashed border-border-primary rounded-lg text-text-secondary hover:text-accent-blue hover:border-accent-blue transition-colors"
            >
              <Upload size={14} />
              Upload Media
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeProject.media.map((media) => (
              <div
                key={media.id}
                onClick={() => handleAddToTimeline(media)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-bg-primary transition-colors group"
              >
                <span className={cn(
                  'shrink-0',
                  media.type === 'video' ? 'text-blue-400' : media.type === 'audio' ? 'text-purple-400' : 'text-green-400'
                )}>
                  <MediaIcon type={media.type} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs truncate">{media.name}</p>
                  {media.duration > 0 && (
                    <p className="text-text-secondary text-[10px]">{formatTime(media.duration)}</p>
                  )}
                </div>
                <Plus size={12} className="text-text-secondary opacity-0 group-hover:opacity-100 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Center: Preview + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview Player */}
          <div className="flex-1 flex items-center justify-center bg-black/30 relative min-h-0">
            <div className="w-full max-w-2xl aspect-video bg-bg-primary/80 rounded-lg border border-border-primary flex items-center justify-center relative overflow-hidden">
              {/* Current frame placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                {activeProject.clips.filter((c) => c.track === 'text' && currentTime >= c.start && currentTime <= c.start + c.duration).map((c) => (
                  <div key={c.id} className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-3xl font-bold drop-shadow-lg">{c.text}</span>
                  </div>
                ))}
                {activeProject.clips.filter((c) => c.track === 'video' && currentTime >= c.start && currentTime <= c.start + c.duration).length > 0 ? (
                  <Film size={48} className="text-text-secondary/20" />
                ) : (
                  <span className="text-text-secondary/40 text-sm">No video at current time</span>
                )}
              </div>

              {/* Export Panel Overlay */}
              {showExport && (
                <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10 p-6">
                  <button onClick={() => setShowExport(false)} className="absolute top-3 right-3 text-text-secondary hover:text-text-primary">
                    <X size={16} />
                  </button>
                  <h3 className="text-text-primary font-semibold text-lg">Export Video</h3>
                  <div className="w-full max-w-xs space-y-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Resolution</label>
                      <select
                        value={exportResolution}
                        onChange={(e) => setExportResolution(e.target.value)}
                        className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                      >
                        {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Format</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
                      >
                        {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    {isExporting ? (
                      <div>
                        <div className="flex justify-between text-xs text-text-secondary mb-1">
                          <span>Exporting...</span>
                          <span>{Math.min(100, Math.round(exportProgress))}%</span>
                        </div>
                        <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-blue rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, exportProgress)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleExport}
                        className="w-full py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 text-sm font-medium"
                      >
                        Start Export
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 py-2 bg-bg-secondary border-y border-border-primary shrink-0">
            <button onClick={() => setCurrentTime(0)} className="text-text-secondary hover:text-text-primary">
              <SkipBack size={16} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 flex items-center justify-center bg-accent-blue rounded-full text-white hover:bg-accent-blue/90"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button onClick={() => setCurrentTime(totalDuration)} className="text-text-secondary hover:text-text-primary">
              <SkipForward size={16} />
            </button>
            <span className="text-xs text-text-primary font-mono min-w-[100px] text-center">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            <div className="h-4 w-px bg-border-primary" />
            <Volume2 size={14} className="text-text-secondary" />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-bg-secondary border-b border-border-primary shrink-0">
            <button
              onClick={handleSplitAtPlayhead}
              disabled={!selectedClip}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                selectedClip ? 'text-text-primary hover:bg-bg-primary' : 'text-text-secondary/40 cursor-not-allowed'
              )}
            >
              <Scissors size={13} /> Split
            </button>
            <button onClick={handleAddTextOverlay} className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary rounded hover:bg-bg-primary">
              <Type size={13} /> Text
            </button>

            {/* Transition */}
            <div className="relative">
              <button
                onClick={() => { setShowTransitionMenu(!showTransitionMenu); setShowSpeedMenu(false); setShowFilterMenu(false); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary rounded hover:bg-bg-primary"
              >
                <Layers size={13} /> Transition <ChevronDown size={10} />
              </button>
              {showTransitionMenu && (
                <div className="absolute left-0 bottom-full mb-1 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-20 min-w-[140px]">
                  {TRANSITIONS.map((t) => (
                    <button key={t} onClick={() => setShowTransitionMenu(false)} className="block w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-bg-primary">
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTransitionMenu(false); setShowFilterMenu(false); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary rounded hover:bg-bg-primary"
              >
                <Clock size={13} /> Speed <ChevronDown size={10} />
              </button>
              {showSpeedMenu && (
                <div className="absolute left-0 bottom-full mb-1 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-20 min-w-[100px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        if (selectedClip && activeProject) {
                          const updatedClips = activeProject.clips.map((c) => (c.id === selectedClip.id ? { ...c, speed: s } : c));
                          const updated = { ...activeProject, clips: updatedClips };
                          setActiveProject(updated);
                          setSelectedClip({ ...selectedClip, speed: s });
                        }
                        setShowSpeedMenu(false);
                      }}
                      className={cn(
                        'block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-primary',
                        selectedClip?.speed === s ? 'text-accent-blue' : 'text-text-primary'
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSpeedMenu(false); setShowTransitionMenu(false); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-primary rounded hover:bg-bg-primary"
              >
                <Wand2 size={13} /> Filter <ChevronDown size={10} />
              </button>
              {showFilterMenu && (
                <div className="absolute left-0 bottom-full mb-1 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-20 min-w-[140px]">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        if (selectedClip && activeProject) {
                          const updatedClips = activeProject.clips.map((c) => (c.id === selectedClip.id ? { ...c, filter: f } : c));
                          const updated = { ...activeProject, clips: updatedClips };
                          setActiveProject(updated);
                          setSelectedClip({ ...selectedClip, filter: f });
                        }
                        setShowFilterMenu(false);
                      }}
                      className={cn(
                        'block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-primary',
                        selectedClip?.filter === f ? 'text-accent-blue' : 'text-text-primary'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedClip && (
              <button
                onClick={() => handleDeleteClip(selectedClip.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 rounded hover:bg-red-400/10 ml-auto"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))} className="text-text-secondary hover:text-text-primary p-1">
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] text-text-secondary min-w-[32px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="text-text-secondary hover:text-text-primary p-1">
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="h-48 bg-bg-primary overflow-x-auto overflow-y-hidden shrink-0" ref={timelineRef}>
            <div className="min-w-full relative" style={{ width: `${totalDuration * pxPerSecond + 100}px` }}>
              {/* Time ruler */}
              <div className="h-6 border-b border-border-primary relative">
                {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => (
                  <div key={i} className="absolute top-0" style={{ left: `${i * 5 * pxPerSecond + 40}px` }}>
                    <div className="h-3 w-px bg-border-primary" />
                    <span className="text-[9px] text-text-secondary absolute -translate-x-1/2 top-3">{formatTime(i * 5)}</span>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 w-px bg-red-500 z-10 cursor-col-resize"
                style={{ left: `${currentTime * pxPerSecond + 40}px`, height: '100%' }}
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startTime = currentTime;
                  const onMove = (ev: MouseEvent) => {
                    const dx = ev.clientX - startX;
                    const dt = dx / pxPerSecond;
                    setCurrentTime(Math.max(0, Math.min(totalDuration, startTime + dt)));
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div className="w-3 h-3 bg-red-500 rounded-full -translate-x-[5px] -translate-y-0.5" />
              </div>

              {/* Track Labels */}
              <div className="absolute left-0 top-6 w-10 z-5">
                {(['video', 'audio', 'text'] as const).map((track, i) => (
                  <div key={track} className="h-10 flex items-center justify-center border-b border-border-primary/50">
                    <span className="text-[9px] text-text-secondary uppercase">{track.charAt(0)}</span>
                  </div>
                ))}
              </div>

              {/* Tracks */}
              <div className="ml-10">
                {(['video', 'audio', 'text'] as const).map((track) => (
                  <div key={track} className="h-10 relative border-b border-border-primary/30">
                    {activeProject.clips
                      .filter((c) => c.track === track)
                      .map((clip) => (
                        <div
                          key={clip.id}
                          onClick={() => setSelectedClip(clip)}
                          className={cn(
                            'absolute top-1 h-8 rounded cursor-pointer flex items-center px-2 text-xs text-white font-medium truncate transition-all group',
                            selectedClip?.id === clip.id ? 'ring-2 ring-white/50' : 'hover:brightness-110'
                          )}
                          style={{
                            left: `${clip.start * pxPerSecond + 30}px`,
                            width: `${Math.max(clip.duration * pxPerSecond, 20)}px`,
                            backgroundColor: clip.color,
                          }}
                        >
                          {/* Left trim handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-l"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const startX = e.clientX;
                              const origStart = clip.start;
                              const origDuration = clip.duration;
                              const onMove = (ev: MouseEvent) => {
                                const dx = ev.clientX - startX;
                                const dt = dx / pxPerSecond;
                                const newStart = Math.max(0, origStart + dt);
                                const newDuration = Math.max(1, origDuration - (newStart - origStart));
                                if (activeProject) {
                                  const updatedClips = activeProject.clips.map((c) =>
                                    c.id === clip.id ? { ...c, start: newStart, duration: newDuration } : c
                                  );
                                  setActiveProject({ ...activeProject, clips: updatedClips });
                                }
                              };
                              const onUp = () => {
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                              };
                              window.addEventListener('mousemove', onMove);
                              window.addEventListener('mouseup', onUp);
                            }}
                          />
                          <span className="truncate">{clip.name}</span>
                          {/* Right trim handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-r"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const startX = e.clientX;
                              const origDuration = clip.duration;
                              const onMove = (ev: MouseEvent) => {
                                const dx = ev.clientX - startX;
                                const dt = dx / pxPerSecond;
                                const newDuration = Math.max(1, origDuration + dt);
                                if (activeProject) {
                                  const updatedClips = activeProject.clips.map((c) =>
                                    c.id === clip.id ? { ...c, duration: newDuration } : c
                                  );
                                  const totalDur = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
                                  setActiveProject({ ...activeProject, clips: updatedClips, duration: totalDur });
                                }
                              };
                              const onUp = () => {
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                              };
                              window.addEventListener('mousemove', onMove);
                              window.addEventListener('mouseup', onUp);
                            }}
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
