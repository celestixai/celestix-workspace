import { useState, useMemo, useCallback } from 'react';
import { Inbox, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useInboxItems,
  useInboxCounts,
  useMarkRead,
  useMarkActioned,
  useSnoozeItem,
  useSaveItem,
  useMarkAllRead,
  useClearAllRead,
} from '@/hooks/useInbox';
import type { InboxItem, InboxCategory } from '@/hooks/useInbox';
import { InboxItemRow } from './InboxItem';

type Tab = 'PRIMARY' | 'OTHER' | 'LATER' | 'SAVED';

function dateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  return 'Older';
}

function groupItems(items: InboxItem[]): Map<string, InboxItem[]> {
  const groups = new Map<string, InboxItem[]>();
  for (const item of items) {
    const group = dateGroup(item.createdAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }
  return groups;
}

export function InboxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('PRIMARY');
  const { data: counts } = useInboxCounts();

  // For SAVED tab, we fetch all and filter client-side; otherwise fetch by category
  const category: InboxCategory | undefined = activeTab === 'SAVED' ? undefined : activeTab;
  const { data, isLoading } = useInboxItems(category);

  const markReadMut = useMarkRead();
  const markActionedMut = useMarkActioned();
  const snoozeMut = useSnoozeItem();
  const saveMut = useSaveItem();
  const markAllReadMut = useMarkAllRead();
  const clearAllMut = useClearAllRead();

  const items = useMemo(() => {
    if (!data?.items) return [];
    if (activeTab === 'SAVED') return data.items.filter((i) => i.isSaved);
    return data.items;
  }, [data?.items, activeTab]);

  const grouped = useMemo(() => groupItems(items), [items]);

  const handleClick = useCallback((item: InboxItem) => {
    if (!item.isRead) markReadMut.mutate(item.id);
    // Could navigate to source — for now just mark read
  }, [markReadMut]);

  const handleMarkDone = useCallback((id: string) => {
    markActionedMut.mutate(id);
  }, [markActionedMut]);

  const handleSnooze = useCallback((id: string) => {
    // Snooze for 3 hours by default
    const until = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    snoozeMut.mutate({ itemId: id, until });
  }, [snoozeMut]);

  const handleSave = useCallback((id: string) => {
    saveMut.mutate(id);
  }, [saveMut]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'PRIMARY', label: 'Primary', count: counts?.primary },
    { key: 'OTHER', label: 'Other', count: counts?.other },
    { key: 'LATER', label: 'Later', count: counts?.later },
    { key: 'SAVED', label: 'Saved', count: counts?.saved },
  ];

  return (
    <div className="flex h-full bg-bg-primary">
      {/* Sidebar tabs */}
      <div className="w-52 flex-shrink-0 border-r border-border-primary bg-bg-secondary flex flex-col">
        <div className="p-4 border-b border-border-primary">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Inbox size={16} />
            Inbox
          </h2>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-bg-active text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover',
              )}
            >
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span className={cn(
                  'text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full',
                  activeTab === tab.key ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-tertiary',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bulk actions */}
        <div className="p-2 border-t border-border-primary space-y-1">
          <button
            onClick={() => markAllReadMut.mutate()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:bg-bg-hover transition-colors"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
          <button
            onClick={() => clearAllMut.mutate()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:bg-bg-hover transition-colors"
          >
            <Trash2 size={14} />
            Clear read items
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-3">
            <Inbox size={40} strokeWidth={1.5} />
            <p className="text-sm">
              {activeTab === 'PRIMARY' && 'No new items'}
              {activeTab === 'OTHER' && 'Nothing in Other'}
              {activeTab === 'LATER' && 'No snoozed items'}
              {activeTab === 'SAVED' && 'No saved items'}
            </p>
          </div>
        ) : (
          <div>
            {Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group}>
                <div className="sticky top-0 px-4 py-2 bg-bg-secondary/80 backdrop-blur-sm border-b border-border-primary z-10">
                  <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{group}</span>
                </div>
                {groupItems.map((item) => (
                  <InboxItemRow
                    key={item.id}
                    item={item}
                    onMarkDone={handleMarkDone}
                    onSnooze={handleSnooze}
                    onSave={handleSave}
                    onClick={handleClick}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
