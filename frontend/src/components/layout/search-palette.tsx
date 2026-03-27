import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, MessageCircle, Mail, FileText, Users, CheckSquare,
  CalendarDays, Hash, X, ClipboardList, Table2, CalendarClock,
  PenTool, PlayCircle, Workflow, FileType, Sheet, Presentation,
  GitFork, ListTodo, Palette, Globe, Heart, BarChart3,
  Sparkles, Clock, Bookmark, Trash2, Target, StickyNote, ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  useAdvancedSearch,
  useDeepSearch,
  useSearchHistory,
  useSavedSearches,
  useSaveSearch,
  useClearSearchHistory,
  useDeleteSavedSearch,
  type SearchResultItem,
  type AdvancedSearchParams,
} from '@/hooks/useSearch';
import { useAIStatus } from '@/hooks/useAI';

// ---------------------------------------------------------------------------
// Icons mapping
// ---------------------------------------------------------------------------

const categoryIcons: Record<string, React.ReactNode> = {
  message: <MessageCircle size={14} />,
  workspace_message: <Hash size={14} />,
  email: <Mail size={14} />,
  file: <FileText size={14} />,
  contact: <Users size={14} />,
  task: <CheckSquare size={14} />,
  note: <StickyNote size={14} />,
  event: <CalendarDays size={14} />,
  form: <ClipboardList size={14} />,
  list: <Table2 size={14} />,
  booking: <CalendarClock size={14} />,
  video: <PlayCircle size={14} />,
  whiteboard: <PenTool size={14} />,
  workflow: <Workflow size={14} />,
  document: <FileType size={14} />,
  spreadsheet: <Sheet size={14} />,
  presentation: <Presentation size={14} />,
  diagram: <GitFork size={14} />,
  todo: <ListTodo size={14} />,
  design: <Palette size={14} />,
  site: <Globe size={14} />,
  social_post: <Heart size={14} />,
  post: <Heart size={14} />,
  report: <BarChart3 size={14} />,
  goal: <Target size={14} />,
};

const typeLabels: Record<string, string> = {
  task: 'Tasks',
  document: 'Documents',
  message: 'Messages',
  file: 'Files',
  contact: 'Contacts',
  note: 'Notes',
  goal: 'Goals',
  post: 'Posts',
  email: 'Emails',
  event: 'Events',
  form: 'Forms',
  list: 'Lists',
  booking: 'Bookings',
  video: 'Videos',
  whiteboard: 'Whiteboards',
  workflow: 'Workflows',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  diagram: 'Diagrams',
  todo: 'To-dos',
  design: 'Designs',
  site: 'Sites',
  social_post: 'Posts',
};

const RESULTS_PER_GROUP = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchPalette() {
  const { searchOpen, setSearchOpen, setActiveModule } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deepMode, setDeepMode] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // AI status
  const { data: aiStatus } = useAIStatus();
  const aiAvailable = aiStatus?.isAvailable ?? false;

  // Search params
  const searchParams: AdvancedSearchParams | null = useMemo(() => {
    if (!query || query.length < 2) return null;
    return {
      q: query,
      types: activeTypeFilter ? [activeTypeFilter] : undefined,
      sortBy: 'relevance',
    };
  }, [query, activeTypeFilter]);

  // Hooks
  const { data: searchData, isLoading: searchLoading } = useAdvancedSearch(searchParams);
  const deepSearch = useDeepSearch();
  const { data: historyData } = useSearchHistory();
  const { data: savedData } = useSavedSearches();
  const saveSearchMut = useSaveSearch();
  const clearHistoryMut = useClearSearchHistory();
  const deleteSavedMut = useDeleteSavedSearch();

  const results = deepMode && deepSearch.data ? deepSearch.data.results : searchData?.results ?? [];
  const facets = deepMode && deepSearch.data ? deepSearch.data.facets : searchData?.facets;
  const total = deepMode && deepSearch.data ? deepSearch.data.total : searchData?.total ?? 0;
  const loading = searchLoading || deepSearch.isPending;

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    results.forEach((r) => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: SearchResultItem[] = [];
    Object.values(groupedResults).forEach((group) => {
      group.slice(0, RESULTS_PER_GROUP).forEach((r) => flat.push(r));
    });
    return flat;
  }, [groupedResults]);

  // Deep search trigger
  useEffect(() => {
    if (deepMode && query.length >= 2) {
      deepSearch.mutate({ q: query, workspaceId: '' });
    }
  }, [deepMode, query]);

  // Reset state on close
  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
      setSelectedIndex(0);
      setDeepMode(false);
      setActiveTypeFilter(null);
      setShowSaveDialog(false);
    }
  }, [searchOpen]);

  // Keyboard shortcut to open/close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, setSearchOpen]);

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current) {
      const el = resultsRef.current.querySelector(`[data-idx="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (result: SearchResultItem) => {
      setSearchOpen(false);
      setQuery('');
      setActiveModule(result.module as 'messenger');
      navigate(result.link);
    },
    [setSearchOpen, setActiveModule, navigate],
  );

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const handleSavedClick = (saved: { query: Record<string, unknown> }) => {
    if (saved.query.q) {
      setQuery(String(saved.query.q));
      inputRef.current?.focus();
    }
  };

  const handleSaveSearch = () => {
    if (saveName.trim() && query) {
      saveSearchMut.mutate({
        name: saveName.trim(),
        query: { q: query, types: activeTypeFilter ? [activeTypeFilter] : undefined },
      });
      setShowSaveDialog(false);
      setSaveName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      handleSelect(flatResults[selectedIndex]);
    }
  };

  if (!searchOpen) return null;

  const showEmpty = !loading && query.length >= 2 && results.length === 0;
  const showHistory = query.length < 2 && !showSaveDialog;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="fixed inset-0 bg-black/60" onClick={() => setSearchOpen(false)} />

      <div className="relative w-[calc(100%-2rem)] max-w-3xl bg-bg-secondary border border-border-primary rounded-xl shadow-lg overflow-hidden animate-scale-in">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 border-b border-border-primary">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, docs, messages, files, contacts..."
            className="flex-1 h-12 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
            aria-label="Search query"
          />
          {/* Deep search toggle */}
          <button
            onClick={() => setDeepMode((v) => !v)}
            disabled={!aiAvailable}
            title={aiAvailable ? (deepMode ? 'AI Deep Search ON' : 'Enable AI Deep Search') : 'AI unavailable'}
            className={cn(
              'p-1.5 rounded-lg transition-colors flex-shrink-0',
              deepMode && aiAvailable
                ? 'text-accent-purple bg-accent-purple/10'
                : aiAvailable
                  ? 'text-text-tertiary hover:text-accent-purple hover:bg-bg-hover'
                  : 'text-text-tertiary/30 cursor-not-allowed',
            )}
          >
            <Sparkles size={16} />
          </button>
          {/* Save search button */}
          {query.length >= 2 && (
            <button
              onClick={() => setShowSaveDialog((v) => !v)}
              title="Save this search"
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0"
            >
              <Bookmark size={16} />
            </button>
          )}
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        {/* Save search dialog */}
        {showSaveDialog && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border-primary bg-bg-tertiary">
            <Bookmark size={14} className="text-text-tertiary flex-shrink-0" />
            <input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
              placeholder="Name this search..."
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-xs"
            />
            <button
              onClick={handleSaveSearch}
              disabled={!saveName.trim()}
              className="text-xs px-2 py-1 rounded bg-accent-blue text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="text-xs px-2 py-1 rounded text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Facet badges */}
        {facets && Object.keys(facets.byType).length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border-primary overflow-x-auto">
            <button
              onClick={() => setActiveTypeFilter(null)}
              className={cn(
                'text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors',
                !activeTypeFilter
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
              )}
            >
              All ({total})
            </button>
            {Object.entries(facets.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors flex items-center gap-1',
                    activeTypeFilter === type
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  {categoryIcons[type]}
                  {typeLabels[type] || type} ({count})
                </button>
              ))}
          </div>
        )}

        {/* Deep search summary */}
        {deepMode && deepSearch.data?.aiSummary && (
          <div className="px-4 py-2 border-b border-border-primary bg-accent-purple/5 text-xs text-accent-purple flex items-center gap-2">
            <Sparkles size={12} />
            {deepSearch.data.aiSummary}
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-text-secondary text-sm">
              {deepMode ? 'AI searching...' : 'Searching...'}
            </div>
          )}

          {showEmpty && (
            <div className="p-8 text-center text-text-secondary text-sm">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {/* Grouped results */}
          {!loading &&
            Object.entries(groupedResults).map(([type, items]) => {
              const visibleItems = items.slice(0, RESULTS_PER_GROUP);
              return (
                <div key={type}>
                  {/* Group header */}
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-tertiary/50 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {categoryIcons[type]}
                      {typeLabels[type] || type}
                    </span>
                    {items.length > RESULTS_PER_GROUP && (
                      <button
                        onClick={() => setActiveTypeFilter(type)}
                        className="text-accent-blue hover:underline normal-case tracking-normal font-normal flex items-center gap-0.5"
                      >
                        Show all {items.length} <ChevronRight size={10} />
                      </button>
                    )}
                  </div>
                  {visibleItems.map((result) => {
                    const globalIdx = flatResults.indexOf(result);
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        data-idx={globalIdx}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          globalIdx === selectedIndex ? 'bg-bg-active' : 'hover:bg-bg-hover',
                        )}
                      >
                        <span className="text-text-tertiary flex-shrink-0">
                          {categoryIcons[result.type] || <Search size={14} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{result.title}</p>
                          {result.preview && (
                            <p className="text-xs text-text-secondary truncate mt-0.5">{result.preview}</p>
                          )}
                        </div>
                        {result.breadcrumb && (
                          <span className="text-[10px] text-text-tertiary flex-shrink-0 max-w-[120px] truncate">
                            {result.breadcrumb}
                          </span>
                        )}
                        <span className="text-[10px] text-text-tertiary flex-shrink-0">
                          {formatRelativeTime(result.timestamp)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* History + Saved — shown when input is empty */}
          {showHistory && (
            <>
              {/* Recent searches */}
              {historyData && historyData.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-tertiary/50 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock size={10} />
                      Recent Searches
                    </span>
                    <button
                      onClick={() => clearHistoryMut.mutate()}
                      className="text-text-tertiary hover:text-red-400 normal-case tracking-normal font-normal"
                      title="Clear history"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  {historyData.slice(0, 8).map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleHistoryClick(h.query)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-bg-hover transition-colors"
                    >
                      <Clock size={14} className="text-text-tertiary flex-shrink-0" />
                      <span className="text-sm text-text-secondary truncate">{h.query}</span>
                      <span className="text-[10px] text-text-tertiary flex-shrink-0 ml-auto">
                        {formatRelativeTime(h.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Saved searches */}
              {savedData && savedData.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-tertiary/50 flex items-center gap-1.5">
                    <Bookmark size={10} />
                    Saved Searches
                  </div>
                  {savedData.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-bg-hover transition-colors group"
                    >
                      <button
                        onClick={() => handleSavedClick(s)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <Bookmark size={14} className="text-text-tertiary flex-shrink-0" />
                        <span className="text-sm text-text-secondary truncate">{s.name}</span>
                      </button>
                      <button
                        onClick={() => deleteSavedMut.mutate(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-all flex-shrink-0"
                        title="Delete saved search"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {(!historyData || historyData.length === 0) && (!savedData || savedData.length === 0) && (
                <div className="p-8 text-center text-text-secondary text-sm">
                  Type to search across your workspace
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-primary text-[10px] text-text-tertiary">
          <span>
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mr-1">&#8593;&#8595;</kbd> Navigate
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mx-1">&#8629;</kbd> Open
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mx-1">Esc</kbd> Close
          </span>
          <span className="flex items-center gap-2">
            {deepMode && (
              <span className="flex items-center gap-1 text-accent-purple">
                <Sparkles size={10} /> Deep Search
              </span>
            )}
            {total > 0 && <span>{total} results</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
