import { useState } from 'react';
import { X, Share2, Trash2, Mic, Clock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Clip } from '@/hooks/useClips';
import { useDeleteClip, useShareClip } from '@/hooks/useClips';
import { Avatar } from '@/components/shared/avatar';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ClipPlayerProps {
  clip: Clip;
  onClose: () => void;
}

export function ClipPlayer({ clip, onClose }: ClipPlayerProps) {
  const isVideo = clip.type === 'SCREEN_RECORDING';
  const deleteMutation = useDeleteClip(clip.id);
  const shareMutation = useShareClip(clip.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const streamUrl = `/api/v1/clips/${clip.id}/stream`;
  // For Electron, use full backend URL
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || '';
  const fullStreamUrl = backendUrl ? `${backendUrl}${streamUrl}` : streamUrl;

  const handleShare = () => {
    shareMutation.mutate();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteMutation.mutate(undefined, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl mx-4 bg-cx-bg rounded-xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={cn(
                'px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full shrink-0',
                isVideo
                  ? 'bg-cx-brand/20 text-cx-brand'
                  : 'bg-purple-500/20 text-purple-400',
              )}
            >
              {isVideo ? 'Screen' : 'Voice'}
            </span>
            <h2 className="text-sm font-medium text-[var(--cx-text-1)] truncate">{clip.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-cx-raised rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--cx-text-2)]" />
          </button>
        </div>

        {/* Player */}
        <div className="bg-[#09090B]">
          {isVideo ? (
            <video
              src={fullStreamUrl}
              controls
              autoPlay
              className="w-full max-h-[60vh]"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 px-4">
              <Mic className="w-16 h-16 text-purple-400/50" />
              <audio src={fullStreamUrl} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="px-4 py-3 border-t border-border flex items-center gap-4">
          <Avatar
            src={clip.createdBy.avatarUrl}
            name={clip.createdBy.displayName}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--cx-text-1)]">{clip.createdBy.displayName}</p>
            <p className="text-xs text-[var(--cx-text-3)]">
              {new Date(clip.createdAt).toLocaleDateString()} &middot;{' '}
              {formatDuration(clip.duration)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--cx-text-3)]">
            <Eye className="w-3.5 h-3.5" />
            {clip.viewCount}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              disabled={shareMutation.isPending}
              className="p-2 hover:bg-cx-raised rounded-lg transition-colors text-[var(--cx-text-2)] hover:text-accent-blue"
              title={clip.isPublic ? 'Already shared' : 'Share clip'}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className={cn(
                'p-2 rounded-lg transition-colors',
                confirmDelete
                  ? 'bg-cx-danger/20 text-cx-danger'
                  : 'hover:bg-cx-raised text-[var(--cx-text-2)] hover:text-cx-danger',
              )}
              title={confirmDelete ? 'Click again to confirm' : 'Delete clip'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transcript */}
        {clip.transcriptText && (
          <div className="px-4 py-3 border-t border-border">
            <h3 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase mb-2">Transcript</h3>
            <p className="text-sm text-[var(--cx-text-1)] whitespace-pre-wrap max-h-40 overflow-y-auto">
              {clip.transcriptText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
