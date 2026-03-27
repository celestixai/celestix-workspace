import { useState } from 'react';
import { Copy, Check, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebhookLogs, useTestIntegration } from '@/hooks/useIntegrations';
import type { Integration } from '@/hooks/useIntegrations';

const WEBHOOK_EVENTS = [
  'task_created',
  'task_updated',
  'status_changed',
  'task_assigned',
  'task_completed',
  'comment_added',
  'due_date_changed',
];

interface WebhookConfigProps {
  integration: Integration;
  onUpdate: (config: any) => void;
}

export function WebhookConfig({ integration, onUpdate }: WebhookConfigProps) {
  const config = integration.config as Record<string, any> | null;
  const isIncoming = integration.type === 'WEBHOOK_INCOMING';
  const isOutgoing = integration.type === 'WEBHOOK_OUTGOING';

  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(config?.url || '');
  const [secret, setSecret] = useState(config?.secret || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(config?.events || []);

  const { data: logs } = useWebhookLogs(integration.id);
  const testMutation = useTestIntegration(integration.id);

  const webhookUrl = `${window.location.origin}/api/v1/integrations/webhooks/incoming/${integration.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleEvent = (event: string) => {
    const next = selectedEvents.includes(event)
      ? selectedEvents.filter((e) => e !== event)
      : [...selectedEvents, event];
    setSelectedEvents(next);
  };

  const handleSave = () => {
    if (isOutgoing) {
      onUpdate({ url, events: selectedEvents, secret });
    } else {
      onUpdate({ events: selectedEvents });
    }
  };

  return (
    <div className="space-y-5">
      {/* Incoming: show webhook URL */}
      {isIncoming && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">Webhook URL</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-primary font-mono"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-secondary hover:text-text-primary transition-colors"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-text-tertiary">
            Send POST requests with JSON body: {'{ "event": "...", "data": {...} }'}
          </p>
        </div>
      )}

      {/* Outgoing: URL input */}
      {isOutgoing && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">Destination URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-primary placeholder:text-text-tertiary"
          />
        </div>
      )}

      {/* Event checkboxes */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">Events</label>
        <div className="grid grid-cols-2 gap-1.5">
          {WEBHOOK_EVENTS.map((event) => (
            <label
              key={event}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                selectedEvents.includes(event)
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary',
              )}
            >
              <input
                type="checkbox"
                checked={selectedEvents.includes(event)}
                onChange={() => toggleEvent(event)}
                className="sr-only"
              />
              <div className={cn(
                'w-3.5 h-3.5 rounded border flex items-center justify-center',
                selectedEvents.includes(event)
                  ? 'bg-accent-blue border-accent-blue'
                  : 'border-border-primary',
              )}>
                {selectedEvents.includes(event) && <Check size={10} className="text-white" />}
              </div>
              {event.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {/* Outgoing: secret */}
      {isOutgoing && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">Signing Secret (optional)</label>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Auto-generated if empty"
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-primary placeholder:text-text-tertiary font-mono"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
        >
          Save Configuration
        </button>
        {isOutgoing && (
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {testMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Test
          </button>
        )}
      </div>

      {/* Test result */}
      {testMutation.data && (
        <div className={cn(
          'px-3 py-2 rounded-lg text-xs',
          testMutation.data.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
        )}>
          {testMutation.data.message}
        </div>
      )}

      {/* Delivery logs */}
      {logs && logs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-secondary">Recent Deliveries</h4>
          <div className="rounded-lg border border-border-primary overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-tertiary text-text-tertiary">
                  <th className="px-3 py-2 text-left font-medium">Event</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Attempts</th>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="border-t border-border-primary">
                    <td className="px-3 py-2 text-text-primary font-mono">{log.event}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        log.status && log.status >= 200 && log.status < 300
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400',
                      )}>
                        {log.status || 'Failed'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">{log.attempts}</td>
                    <td className="px-3 py-2 text-text-tertiary">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
