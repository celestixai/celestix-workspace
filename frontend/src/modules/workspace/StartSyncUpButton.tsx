import { useActiveSyncUp, useStartSyncUp, useJoinSyncUp } from '@/hooks/useSyncUps';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Headphones } from 'lucide-react';

interface StartSyncUpButtonProps {
  channelId: string;
}

export function StartSyncUpButton({ channelId }: StartSyncUpButtonProps) {
  const { data: syncUp } = useActiveSyncUp(channelId);
  const startMutation = useStartSyncUp(channelId);
  const joinMutation = useJoinSyncUp(channelId);
  const user = useAuthStore((s) => s.user);

  const isParticipant = syncUp?.participants.some((p) => p.userId === user?.id);

  const handleClick = () => {
    if (syncUp) {
      // Active SyncUp exists -- join it
      if (!isParticipant) {
        joinMutation.mutate(syncUp.id);
      }
    } else {
      // Start a new SyncUp
      startMutation.mutate(undefined);
    }
  };

  const isLoading = startMutation.isPending || joinMutation.isPending;
  const isDisabled = isLoading || isParticipant;

  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        'h-8 w-8 p-0',
        isParticipant && 'text-emerald-400',
        !isParticipant && syncUp && 'text-emerald-400 animate-pulse',
      )}
      onClick={handleClick}
      disabled={isDisabled}
      title={
        isParticipant
          ? 'Already in SyncUp'
          : syncUp
            ? 'Join active SyncUp'
            : 'Start a SyncUp'
      }
    >
      <Headphones className="h-4 w-4" />
    </Button>
  );
}
