import { Film, Mic, Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Clip } from '@/hooks/useClips';
import { Avatar } from '@/components/shared/avatar';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface ClipCardProps {
  clip: Clip;
  onClick: (clip: Clip) => void;
}

export function ClipCard({ clip, onClick }: ClipCardProps) {
  const isVideo = clip.type === 'SCREEN_RECORDING';

  return (
    <button
      onClick={() => onClick(clip)}
      className={cn(
        'group relative flex flex-col rounded-xl border border-[var(--cx-border-1)] bg-cx-surface',
        'hover:border-accent-blue/40 hover:shadow-lg transition-all duration-200 text-left overflow-hidden',
      )}
    >
      {/* Thumbnail / Icon area */}
      <div className="relative aspect-video bg-cx-raised flex items-center justify-center">
        {isVideo ? (
          <Film className="w-10 h-10 text-[var(--cx-text-3)]" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Mic className="w-10 h-10 text-[var(--cx-text-3)]" />
            <div className="flex gap-0.5">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-accent-blue/30 rounded-full"
                  style={{ height: `${8 + Math.random() * 16}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            <Play className="w-5 h-5 text-cx-bg ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {clip.duration != null && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[11px] font-medium rounded bg-black/70 text-white">
            {formatDuration(clip.duration)}
          </span>
        )}

        {/* Type badge */}
        <span
          className={cn(
            'absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full',
            isVideo
              ? 'bg-cx-brand/20 text-cx-brand'
              : 'bg-purple-500/20 text-purple-400',
          )}
        >
          {isVideo ? 'Screen' : 'Voice'}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[var(--cx-text-1)] line-clamp-2">{clip.title}</h3>
        <div className="flex items-center gap-2 mt-auto">
          <Avatar
            src={clip.createdBy.avatarUrl}
            name={clip.createdBy.displayName}
            size="xs"
          />
          <span className="text-xs text-[var(--cx-text-3)] truncate">
            {clip.createdBy.displayName}
          </span>
          <span className="text-xs text-[var(--cx-text-3)] ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(clip.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
