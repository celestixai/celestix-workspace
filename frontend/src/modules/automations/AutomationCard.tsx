import { useState } from 'react';
import {
  ArrowRightLeft, Plus, Move, UserPlus, Flag, Clock,
  MessageSquare, Tag, Settings, Trash2, MoreVertical,
  Play, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Automation, TriggerType } from '@/hooks/useAutomations';

const triggerIcons: Record<TriggerType, React.ElementType> = {
  STATUS_CHANGED: ArrowRightLeft,
  TASK_CREATED: Plus,
  TASK_MOVED: Move,
  ASSIGNEE_CHANGED: UserPlus,
  PRIORITY_CHANGED: Flag,
  DUE_DATE_ARRIVES: Clock,
  COMMENT_ADDED: MessageSquare,
  TAG_ADDED: Tag,
  CUSTOM_FIELD_CHANGED: Settings,
};

const triggerLabels: Record<TriggerType, string> = {
  STATUS_CHANGED: 'Status Changed',
  TASK_CREATED: 'Task Created',
  TASK_MOVED: 'Task Moved',
  ASSIGNEE_CHANGED: 'Assignee Changed',
  PRIORITY_CHANGED: 'Priority Changed',
  DUE_DATE_ARRIVES: 'Due Date Arrives',
  COMMENT_ADDED: 'Comment Added',
  TAG_ADDED: 'Tag Added',
  CUSTOM_FIELD_CHANGED: 'Custom Field Changed',
};

interface AutomationCardProps {
  automation: Automation;
  onEdit: (automation: Automation) => void;
  onToggle: (automationId: string) => void;
  onDelete: (automationId: string) => void;
  onViewLogs: (automationId: string) => void;
}

export function AutomationCard({ automation, onEdit, onToggle, onDelete, onViewLogs }: AutomationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const TriggerIcon = triggerIcons[automation.trigger.type] ?? Settings;
  const triggerLabel = triggerLabels[automation.trigger.type] ?? automation.trigger.type;

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(automation.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const lastRun = automation.lastRunAt
    ? new Date(automation.lastRunAt).toLocaleString()
    : 'Never';

  return (
    <div
      className={cn(
        'group relative rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md',
        automation.isActive
          ? 'border-border-primary bg-bg-secondary hover:border-accent-blue/50'
          : 'border-border-secondary bg-bg-secondary/60 opacity-70 hover:opacity-90'
      )}
      onClick={() => onEdit(automation)}
    >
      {/* Top row: icon, name, toggle */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
          automation.isActive ? 'bg-accent-blue/10 text-accent-blue' : 'bg-bg-tertiary text-text-tertiary'
        )}>
          <TriggerIcon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{automation.name}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">When {triggerLabel}</p>
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(automation.id); }}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
            automation.isActive ? 'bg-accent-blue' : 'bg-bg-tertiary'
          )}
          aria-label={automation.isActive ? 'Deactivate' : 'Activate'}
        >
          <span className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            automation.isActive ? 'left-[18px]' : 'left-0.5'
          )} />
        </button>
      </div>

      {/* Action count + location badge */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-text-tertiary">
          <Play size={10} className="inline mr-1" />
          {automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary">
          {automation.locationType}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-text-tertiary">
        <span>
          <History size={10} className="inline mr-1" />
          {automation.executionCount} runs
        </span>
        <span>Last: {lastRun}</span>
      </div>

      {/* Context menu */}
      <div className="absolute top-3 right-12">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className="p-1 rounded-md text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-bg-hover transition-all"
          aria-label="More options"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-border-primary bg-bg-secondary shadow-lg py-1">
            <button
              onClick={(e) => { e.stopPropagation(); onViewLogs(automation.id); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
            >
              View Logs
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-accent-red hover:bg-bg-hover"
            >
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
