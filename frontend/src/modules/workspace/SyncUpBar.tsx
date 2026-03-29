import { useState, useEffect } from 'react';
import {
  useActiveSyncUp,
  useLeaveSyncUp,
  useEndSyncUp,
  useToggleSyncUpAudio,
  useToggleSyncUpVideo,
  type SyncUp,
} from '@/hooks/useSyncUps';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/avatar';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2 } from 'lucide-react';

interface SyncUpBarProps {
  channelId: string;
}

function formatDuration(startedAt: string) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SyncUpBar({ channelId }: SyncUpBarProps) {
  const { data: syncUp } = useActiveSyncUp(channelId);
  const leaveMutation = useLeaveSyncUp(channelId);
  const endMutation = useEndSyncUp(channelId);
  const toggleAudio = useToggleSyncUpAudio(channelId);
  const toggleVideo = useToggleSyncUpVideo(channelId);
  const user = useAuthStore((s) => s.user);
  const [duration, setDuration] = useState('0:00');

  const participant = syncUp?.participants.find((p) => p.userId === user?.id);
  const isStarter = syncUp?.startedById === user?.id;

  // Update duration timer every second
  useEffect(() => {
    if (!syncUp) return;
    const update = () => setDuration(formatDuration(syncUp.startedAt));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [syncUp?.startedAt, syncUp]);

  if (!syncUp || !participant) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-cx-bg border-t border-[var(--cx-border-1)]">
      {/* Left: participant avatars (stacked) + duration */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {syncUp.participants.slice(0, 5).map((p) => (
            <Avatar
              key={p.id}
              src={p.user.avatarUrl}
              name={p.user.displayName}
              size="sm"
              className="ring-2 ring-cx-bg"
            />
          ))}
          {syncUp.participants.length > 5 && (
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-cx-raised ring-2 ring-cx-bg text-xs text-[var(--cx-text-1)]">
              +{syncUp.participants.length - 5}
            </div>
          )}
        </div>

        <span className="text-sm font-mono text-[var(--cx-text-2)]">{duration}</span>
        {syncUp.title && (
          <span className="text-sm text-[var(--cx-text-3)] truncate max-w-[200px]">{syncUp.title}</span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        {/* Mute / Unmute */}
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 w-8 p-0',
            !participant.isAudioEnabled && 'text-cx-danger hover:text-cx-danger',
          )}
          onClick={() =>
            toggleAudio.mutate({
              syncUpId: syncUp.id,
              enabled: !participant.isAudioEnabled,
            })
          }
          title={participant.isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {participant.isAudioEnabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </Button>

        {/* Video on/off */}
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 w-8 p-0',
            !participant.isVideoEnabled && 'text-[var(--cx-text-3)]',
          )}
          onClick={() =>
            toggleVideo.mutate({
              syncUpId: syncUp.id,
              enabled: !participant.isVideoEnabled,
            })
          }
          title={participant.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {participant.isVideoEnabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </Button>

        {/* Leave */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-cx-danger hover:text-cx-danger hover:bg-cx-danger/10"
          onClick={() => leaveMutation.mutate(syncUp.id)}
          disabled={leaveMutation.isPending}
          title="Leave SyncUp"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>

        {/* End SyncUp (only for starter) */}
        {isStarter && (
          <Button
            size="sm"
            className="h-7 px-2 ml-1 text-xs bg-red-600 hover:bg-red-700 text-white"
            onClick={() => endMutation.mutate(syncUp.id)}
            disabled={endMutation.isPending}
          >
            End SyncUp
          </Button>
        )}

        {/* Expand (future) */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-[var(--cx-text-3)]"
          title="Expand (coming soon)"
          disabled
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
