import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutomationLogs } from '@/hooks/useAutomations';
import type { AutomationLog } from '@/hooks/useAutomations';

interface AutomationLogsProps {
  automationId: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  SUCCESS: 'bg-accent-emerald/20 text-accent-emerald',
  PARTIAL: 'bg-accent-amber/20 text-accent-amber',
  FAILED: 'bg-accent-red/20 text-accent-red',
};

export function AutomationLogs({ automationId, onClose }: AutomationLogsProps) {
  const { data: logs, isLoading } = useAutomationLogs(automationId);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allLogs = logs ?? [];
  const totalPages = Math.max(1, Math.ceil(allLogs.length / PAGE_SIZE));
  const pageLogs = allLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[85vh] bg-bg-secondary rounded-2xl border border-border-primary shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Execution Logs</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary">
            <X size={18} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
            </div>
          ) : allLogs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-text-tertiary text-sm">
              No execution logs yet.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary text-text-tertiary">
                  <th className="text-left px-4 py-2 w-6" />
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Trigger</th>
                  <th className="text-left px-4 py-2">Task</th>
                  <th className="text-left px-4 py-2">Actions</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border-primary">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-text-tertiary">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ log, expanded, onToggle }: { log: AutomationLog; expanded: boolean; onToggle: () => void }) {
  const date = new Date(log.createdAt).toLocaleString();
  const statusClass = statusColors[log.status] ?? 'bg-bg-tertiary text-text-secondary';

  return (
    <>
      <tr
        className="border-b border-border-primary hover:bg-bg-hover cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-2 text-text-tertiary">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </td>
        <td className="px-4 py-2 text-text-primary">{date}</td>
        <td className="px-4 py-2 text-text-secondary">{log.triggerEvent}</td>
        <td className="px-4 py-2 text-text-secondary truncate max-w-[120px]">{log.taskName ?? log.taskId ?? '-'}</td>
        <td className="px-4 py-2 text-text-secondary">{log.actionsRun}</td>
        <td className="px-4 py-2">
          <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', statusClass)}>
            {log.status}
          </span>
        </td>
        <td className="px-4 py-2 text-right text-text-tertiary">{log.duration}ms</td>
      </tr>
      {expanded && (
        <tr className="border-b border-border-primary">
          <td colSpan={7} className="px-4 py-3 bg-bg-tertiary">
            {log.error && (
              <p className="text-xs text-accent-red mb-2">Error: {log.error}</p>
            )}
            <pre className="text-[10px] text-text-secondary whitespace-pre-wrap font-mono overflow-x-auto max-h-40">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
