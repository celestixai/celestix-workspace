import { CalendarDays, MessageCircle, Github, HardDrive, Webhook, Zap, RefreshCw, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Integration, IntegrationType } from '@/hooks/useIntegrations';

const integrationMeta: Record<IntegrationType, { icon: React.ElementType; description: string; category: string }> = {
  GOOGLE_CALENDAR: { icon: CalendarDays, description: 'Sync events with Google Calendar', category: 'Calendar' },
  OUTLOOK_CALENDAR: { icon: CalendarDays, description: 'Sync events with Outlook Calendar', category: 'Calendar' },
  SLACK: { icon: MessageCircle, description: 'Send notifications to Slack channels', category: 'Communication' },
  GITHUB: { icon: Github, description: 'Link issues and PRs to tasks', category: 'Development' },
  GOOGLE_DRIVE: { icon: HardDrive, description: 'Attach files from Google Drive', category: 'Storage' },
  WEBHOOK_INCOMING: { icon: Webhook, description: 'Receive data from external services', category: 'Automation' },
  WEBHOOK_OUTGOING: { icon: Webhook, description: 'Send events to external URLs', category: 'Automation' },
  ZAPIER: { icon: Zap, description: 'Connect with 5,000+ apps via Zapier', category: 'Automation' },
};

interface IntegrationCardProps {
  type: IntegrationType;
  connected?: Integration;
  onConnect: () => void;
  onDisconnect?: () => void;
  onSync?: () => void;
  onConfigure?: () => void;
  syncing?: boolean;
}

export function IntegrationCard({ type, connected, onConnect, onDisconnect, onSync, syncing }: IntegrationCardProps) {
  const meta = integrationMeta[type];
  const Icon = meta.icon;

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={cn(
      'rounded-xl border p-5 transition-all',
      connected
        ? 'border-accent-blue/30 bg-accent-blue/5'
        : 'border-[var(--cx-border-1)] bg-cx-surface hover:border-[var(--cx-border-2)]',
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          connected ? 'bg-accent-blue/20 text-accent-blue' : 'bg-cx-raised text-[var(--cx-text-2)]',
        )}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--cx-text-1)] truncate">
            {type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </h3>
          <p className="text-xs text-[var(--cx-text-3)] mt-0.5">{meta.category}</p>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-cx-success">
            <CheckCircle size={12} />
            Connected
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--cx-text-2)] mb-4 line-clamp-2">{meta.description}</p>

      {/* Connected state */}
      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--cx-text-3)]">
            <span>Last sync: {formatTime(connected.lastSyncAt)}</span>
            {connected.syncStatus && (
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                connected.syncStatus === 'success' && 'bg-cx-success/20 text-cx-success',
                connected.syncStatus === 'error' && 'bg-cx-danger/20 text-cx-danger',
                connected.syncStatus === 'syncing' && 'bg-cx-warning/20 text-cx-warning',
              )}>
                {connected.syncStatus}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cx-raised text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync
            </button>
            <button
              onClick={onDisconnect}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cx-raised text-cx-danger hover:bg-cx-danger/10 transition-colors"
            >
              <Trash2 size={12} />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
        >
          Connect
        </button>
      )}
    </div>
  );
}
