import { useState, useMemo } from 'react';
import { Plug, Search, X, Bell } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  useIntegrations,
  useCreateIntegration,
  useDeleteIntegration,
  useSyncIntegration,
  useUpdateIntegration,
} from '@/hooks/useIntegrations';
import type { IntegrationType, Integration } from '@/hooks/useIntegrations';
import { IntegrationCard } from './IntegrationCard';
import { WebhookConfig } from './WebhookConfig';

type Category = 'all' | 'calendar' | 'communication' | 'development' | 'storage' | 'automation';

const INTEGRATION_TYPES: IntegrationType[] = [
  'GOOGLE_CALENDAR',
  'OUTLOOK_CALENDAR',
  'SLACK',
  'GITHUB',
  'GOOGLE_DRIVE',
  'WEBHOOK_INCOMING',
  'WEBHOOK_OUTGOING',
  'ZAPIER',
];

const categoryMap: Record<IntegrationType, Category> = {
  GOOGLE_CALENDAR: 'calendar',
  OUTLOOK_CALENDAR: 'calendar',
  SLACK: 'communication',
  GITHUB: 'development',
  GOOGLE_DRIVE: 'storage',
  WEBHOOK_INCOMING: 'automation',
  WEBHOOK_OUTGOING: 'automation',
  ZAPIER: 'automation',
};

const categories: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'communication', label: 'Communication' },
  { id: 'development', label: 'Development' },
  { id: 'storage', label: 'Storage' },
  { id: 'automation', label: 'Automation' },
];

export function IntegrationsPage() {
  // Workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId: string | undefined = workspaces?.[0]?.id;

  const { data: integrations } = useIntegrations(workspaceId);
  const createMutation = useCreateIntegration();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Map of connected integrations by type
  const connectedMap = useMemo(() => {
    const map: Partial<Record<IntegrationType, Integration>> = {};
    integrations?.forEach((i) => {
      map[i.type] = i;
    });
    return map;
  }, [integrations]);

  // Filter types
  const filteredTypes = useMemo(() => {
    return INTEGRATION_TYPES.filter((type) => {
      if (activeCategory !== 'all' && categoryMap[type] !== activeCategory) return false;
      if (search) {
        const label = type.replace(/_/g, ' ').toLowerCase();
        if (!label.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [activeCategory, search]);

  const [comingSoonType, setComingSoonType] = useState<IntegrationType | null>(null);

  const handleConnect = (type: IntegrationType) => {
    if (!workspaceId) return;
    // Webhook types work — everything else shows Coming Soon
    if (isWebhookType(type)) {
      const name = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      createMutation.mutate({ workspaceId, type, name });
    } else {
      setComingSoonType(type);
    }
  };

  const handleDisconnect = (integration: Integration) => {
    // We need a fresh hook per call — use inline api call
    api.delete(`/integrations/${integration.id}`).then(() => {
      // Invalidate via window reload or manual refetch
      window.location.reload();
    });
  };

  const handleSync = async (integration: Integration) => {
    setSyncingId(integration.id);
    try {
      await api.post(`/integrations/${integration.id}/sync`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleWebhookUpdate = async (config: any) => {
    if (!configuring) return;
    await api.patch(`/integrations/${configuring.id}`, { config });
    setConfiguring(null);
    window.location.reload();
  };

  const isWebhookType = (type: IntegrationType) =>
    type === 'WEBHOOK_INCOMING' || type === 'WEBHOOK_OUTGOING';

  return (
    <div className="flex-1 flex flex-col h-full bg-cx-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-[var(--cx-border-1)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <Plug size={18} className="text-accent-blue" />
            </div>
            <div>
              <h1 className="text-lg font-display text-[var(--cx-text-1)]">Integrations</h1>
              <p className="text-xs text-[var(--cx-text-3)]">
                Connect your favorite tools and services
              </p>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-3)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-xs text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] w-56"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeCategory === cat.id
                  ? 'bg-accent-blue text-white'
                  : 'text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] hover:bg-cx-raised',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTypes.map((type) => {
            const connected = connectedMap[type];
            return (
              <IntegrationCard
                key={type}
                type={type}
                connected={connected}
                onConnect={() => handleConnect(type)}
                onDisconnect={connected ? () => handleDisconnect(connected) : undefined}
                onSync={connected ? () => handleSync(connected) : undefined}
                onConfigure={connected && isWebhookType(type) ? () => setConfiguring(connected) : undefined}
                syncing={connected?.id === syncingId}
              />
            );
          })}
        </div>

        {filteredTypes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--cx-text-3)]">
            <Plug size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No integrations found</p>
          </div>
        )}
      </div>

      {/* Coming Soon modal */}
      {comingSoonType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setComingSoonType(null)}>
          <div
            className="bg-[#161618] border border-[rgba(255,255,255,0.12)] rounded-2xl shadow-2xl w-96 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-accent-blue/10 flex items-center justify-center mx-auto">
                <Plug size={28} className="text-accent-blue" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Connect {comingSoonType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </h3>
                <p className="text-sm text-[rgba(255,255,255,0.40)] mt-2">
                  This integration is coming soon. We'll notify you when it's available.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setComingSoonType(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#111113] border border-[rgba(255,255,255,0.12)] text-sm font-medium text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Could save interest to DB — for now just toast
                    setComingSoonType(null);
                    import('@/components/ui/toast').then(({ toast }) => {
                      toast('We\'ll notify you when this integration is ready!', 'success');
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
                >
                  <Bell size={14} /> Notify Me
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook config panel */}
      {configuring && isWebhookType(configuring.type) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-cx-surface rounded-xl border border-[var(--cx-border-1)] p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--cx-text-1)]">
                Configure {configuring.name}
              </h2>
              <button onClick={() => setConfiguring(null)} className="text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]">
                <X size={16} />
              </button>
            </div>
            <WebhookConfig
              integration={configuring}
              onUpdate={handleWebhookUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
}
