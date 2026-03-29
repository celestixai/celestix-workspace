import { useState, useMemo } from 'react';
import { Film, Monitor, Mic, Search, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useClips, useClipsHub } from '@/hooks/useClips';
import type { Clip, ClipType } from '@/hooks/useClips';
import { ClipCard } from './ClipCard';
import { ClipPlayer } from './ClipPlayer';
import { ClipRecorder } from './ClipRecorder';
import { VoiceRecorder } from './VoiceRecorder';

type FilterType = 'ALL' | ClipType;

function formatTotalDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function ClipsHub() {
  // Workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId: string | undefined = workspaces?.[0]?.id;

  // Data
  const { data: hub } = useClipsHub(workspaceId);
  const { data: clips, isLoading } = useClips(workspaceId);

  // UI state
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [showScreenRecorder, setShowScreenRecorder] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  // Filter clips
  const filtered = useMemo(() => {
    let list = clips ?? [];
    if (filter !== 'ALL') {
      list = list.filter((c) => c.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [clips, filter, searchQuery]);

  const stats = hub?.stats;
  const screenCount = stats?.byType?.SCREEN_RECORDING?.count ?? 0;
  const voiceCount = stats?.byType?.VOICE_CLIP?.count ?? 0;

  return (
    <div className="flex flex-col h-full bg-cx-bg">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--cx-border-1)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-accent-blue" />
            <h1 className="text-xl font-display text-[var(--cx-text-1)]">Clips</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScreenRecorder(true)}
              disabled={!workspaceId}
              className="flex items-center gap-2 px-3 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Monitor className="w-4 h-4" />
              Record Screen
            </button>
            <button
              onClick={() => setShowVoiceRecorder(true)}
              disabled={!workspaceId}
              className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Mic className="w-4 h-4" />
              Voice Clip
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2 text-sm text-[var(--cx-text-2)]">
              <Film className="w-4 h-4" />
              <span className="font-medium text-[var(--cx-text-1)]">{stats.totalClips}</span> clips
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--cx-text-2)]">
              <Clock className="w-4 h-4" />
              <span className="font-medium text-[var(--cx-text-1)]">{formatTotalDuration(stats.totalDuration)}</span> total
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--cx-text-2)]">
              <Monitor className="w-3.5 h-3.5 text-cx-brand" />
              <span>{screenCount} screen</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--cx-text-2)]">
              <Mic className="w-3.5 h-3.5 text-purple-400" />
              <span>{voiceCount} voice</span>
            </div>
          </div>
        )}

        {/* Filter + Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-cx-surface rounded-lg p-0.5">
            {(['ALL', 'SCREEN_RECORDING', 'VOICE_CLIP'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  filter === f
                    ? 'bg-cx-raised text-[var(--cx-text-1)]'
                    : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-2)]',
                )}
              >
                {f === 'ALL' ? 'All' : f === 'SCREEN_RECORDING' ? 'Screen' : 'Voice'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cx-text-3)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clips..."
              className="w-full pl-9 pr-3 py-1.5 bg-cx-surface border border-[var(--cx-border-1)] rounded-lg text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-video bg-cx-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--cx-text-3)]">
            <Film className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No clips yet</p>
            <p className="text-xs mt-1">Record your screen or voice to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((clip) => (
              <ClipCard key={clip.id} clip={clip} onClick={setSelectedClip} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedClip && (
        <ClipPlayer clip={selectedClip} onClose={() => setSelectedClip(null)} />
      )}
      {showScreenRecorder && workspaceId && (
        <ClipRecorder
          workspaceId={workspaceId}
          onClose={() => setShowScreenRecorder(false)}
          onSaved={() => setShowScreenRecorder(false)}
        />
      )}
      {showVoiceRecorder && workspaceId && (
        <VoiceRecorder
          workspaceId={workspaceId}
          onClose={() => setShowVoiceRecorder(false)}
          onSaved={() => setShowVoiceRecorder(false)}
        />
      )}
    </div>
  );
}
