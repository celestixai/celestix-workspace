import { useState } from 'react';
import { useFollowUps, useUpdateFollowUp, useDeleteFollowUp } from '@/hooks/usePosts';
import type { FollowUp } from '@/hooks/usePosts';
import { Avatar } from '@/components/shared/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn, formatFullDate } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  Circle,
  Trash2,
  Hash,
  ChevronDown,
} from 'lucide-react';

interface FollowUpsListProps {
  workspaceId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: 'Pending', icon: <Circle size={14} />, color: 'text-yellow-400' },
  IN_PROGRESS: { label: 'In Progress', icon: <Clock size={14} />, color: 'text-blue-400' },
  DONE: { label: 'Done', icon: <CheckCircle size={14} />, color: 'text-green-400' },
};

export function FollowUpsList({ workspaceId }: FollowUpsListProps) {
  const { data: followUps, isLoading } = useFollowUps(workspaceId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-bg-tertiary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!followUps || followUps.length === 0) {
    return (
      <div className="p-8 text-center text-text-tertiary">
        <Clock size={32} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">No follow-ups assigned to you.</p>
      </div>
    );
  }

  const pending = followUps.filter((f) => f.status === 'PENDING');
  const inProgress = followUps.filter((f) => f.status === 'IN_PROGRESS');
  const done = followUps.filter((f) => f.status === 'DONE');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-lg font-semibold text-text-primary">Follow-Ups</h2>
        <p className="text-xs text-text-tertiary mt-1">
          {pending.length} pending, {inProgress.length} in progress, {done.length} done
        </p>
      </div>

      <div className="p-4 space-y-6">
        {pending.length > 0 && (
          <FollowUpGroup title="Pending" items={pending} />
        )}
        {inProgress.length > 0 && (
          <FollowUpGroup title="In Progress" items={inProgress} />
        )}
        {done.length > 0 && (
          <FollowUpGroup title="Done" items={done} defaultCollapsed />
        )}
      </div>
    </div>
  );
}

function FollowUpGroup({
  title,
  items,
  defaultCollapsed = false,
}: {
  title: string;
  items: FollowUp[];
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary mb-2"
      >
        <ChevronDown
          size={14}
          className={cn('transition-transform', collapsed && '-rotate-90')}
        />
        {title} ({items.length})
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {items.map((followUp) => (
            <FollowUpCard key={followUp.id} followUp={followUp} />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpCard({ followUp }: { followUp: FollowUp }) {
  const [showActions, setShowActions] = useState(false);
  const updateFollowUp = useUpdateFollowUp(followUp.id);
  const deleteFollowUp = useDeleteFollowUp(followUp.id);

  const statusInfo = STATUS_CONFIG[followUp.status];
  const isOverdue = followUp.dueDate && new Date(followUp.dueDate) < new Date() && followUp.status !== 'DONE';

  const handleStatusChange = async (status: 'PENDING' | 'IN_PROGRESS' | 'DONE') => {
    try {
      await updateFollowUp.mutateAsync({ status });
      toast(`Marked as ${STATUS_CONFIG[status].label}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
    setShowActions(false);
  };

  const handleDelete = async () => {
    try {
      await deleteFollowUp.mutateAsync();
      toast('Follow-up removed', 'success');
    } catch {
      toast('Failed to delete follow-up', 'error');
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        followUp.status === 'DONE'
          ? 'border-border-primary bg-bg-secondary opacity-70'
          : 'border-border-primary bg-bg-secondary hover:bg-bg-tertiary',
        isOverdue && 'border-red-500/30',
      )}
    >
      {/* Top row: status + channel + due date */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('flex items-center gap-1 text-xs', statusInfo.color)}>
          {statusInfo.icon}
          {statusInfo.label}
        </span>
        <span className="text-xs text-text-tertiary flex items-center gap-1">
          <Hash size={10} />
          {followUp.channel.name}
        </span>
        {followUp.dueDate && (
          <span
            className={cn(
              'text-xs ml-auto',
              isOverdue ? 'text-red-400 font-medium' : 'text-text-tertiary',
            )}
          >
            {isOverdue ? 'Overdue: ' : 'Due: '}
            {formatFullDate(followUp.dueDate)}
          </span>
        )}
      </div>

      {/* Message preview */}
      <p className="text-sm text-text-primary line-clamp-2 mb-2">
        {followUp.message.content || '(no content)'}
      </p>

      {/* Note */}
      {followUp.note && (
        <p className="text-xs text-text-tertiary italic mb-2">Note: {followUp.note}</p>
      )}

      {/* Bottom row: assigned by + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={followUp.assignedBy.displayName} src={followUp.assignedBy.avatarUrl} size="sm" />
          <span className="text-xs text-text-tertiary">
            Assigned by {followUp.assignedBy.displayName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {followUp.status !== 'DONE' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStatusChange('DONE')}
              title="Mark done"
            >
              <CheckCircle size={14} className="text-green-400" />
            </Button>
          )}
          {followUp.status === 'PENDING' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStatusChange('IN_PROGRESS')}
              title="Start"
            >
              <Clock size={14} className="text-blue-400" />
            </Button>
          )}
          {followUp.status === 'DONE' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStatusChange('PENDING')}
              title="Reopen"
            >
              <Circle size={14} className="text-yellow-400" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            title="Delete follow-up"
          >
            <Trash2 size={14} className="text-text-tertiary hover:text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}
