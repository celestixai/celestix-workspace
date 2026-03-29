import { useActiveSyncUp, useJoinSyncUp } from '@/hooks/useSyncUps';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface SyncUpIndicatorProps {
  channelId: string;
}

export function SyncUpIndicator({ channelId }: SyncUpIndicatorProps) {
  const { data: syncUp } = useActiveSyncUp(channelId);
  const joinMutation = useJoinSyncUp(channelId);
  const user = useAuthStore((s) => s.user);

  if (!syncUp) return null;

  const isParticipant = syncUp.participants.some((p) => p.userId === user?.id);
  const participantCount = syncUp.participants.length;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      {/* Pulsing green dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>

      <span className="text-sm font-medium text-emerald-400">
        SyncUp Active
      </span>

      <div className="flex items-center gap-1 text-xs text-[var(--cx-text-2)]">
        <Users className="h-3.5 w-3.5" />
        <span>{participantCount}</span>
      </div>

      {!isParticipant && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-6 px-2 text-xs font-medium',
            'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
          )}
          onClick={() => joinMutation.mutate(syncUp.id)}
          disabled={joinMutation.isPending}
        >
          Join
        </Button>
      )}
    </div>
  );
}
