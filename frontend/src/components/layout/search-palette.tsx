import { useState, useEffect, useCallback } from 'react';
import { Search, MessageCircle, Mail, FileText, Users, CheckSquare, CalendarDays, Hash, X } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const categoryIcons: Record<string, React.ReactNode> = {
  message: <MessageCircle size={14} />,
  workspace_message: <Hash size={14} />,
  email: <Mail size={14} />,
  file: <FileText size={14} />,
  contact: <Users size={14} />,
  task: <CheckSquare size={14} />,
  note: <FileText size={14} />,
  event: <CalendarDays size={14} />,
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  preview?: string;
  module: string;
  timestamp: string;
  link: string;
}

export function SearchPalette() {
  const { searchOpen, setSearchOpen, setActiveModule } = useUIStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut
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

  // Search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/search', { params: { q: query } });
        setResults(data.data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    setSearchOpen(false);
    setQuery('');
    setActiveModule(result.module as 'messenger');
    navigate(result.link);
  }, [setSearchOpen, setActiveModule, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="fixed inset-0 bg-black/60" onClick={() => setSearchOpen(false)} />
      <div className="relative w-[calc(100%-2rem)] max-w-2xl bg-bg-secondary border border-border-primary rounded-xl shadow-lg overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-border-primary">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages, emails, files, contacts, tasks..."
            className="flex-1 h-12 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
            aria-label="Search query"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-text-secondary text-sm">Searching...</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-text-secondary text-sm">
              No results found for "{query}"
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                index === selectedIndex ? 'bg-bg-active' : 'hover:bg-bg-hover'
              )}
            >
              <span className="text-text-tertiary flex-shrink-0">
                {categoryIcons[result.type] || <Search size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{result.title}</p>
                {result.preview && (
                  <p className="text-xs text-text-secondary truncate">{result.preview}</p>
                )}
              </div>
              <span className="text-[10px] text-text-tertiary flex-shrink-0 capitalize">{result.module}</span>
              <span className="text-[10px] text-text-tertiary flex-shrink-0">
                {formatRelativeTime(result.timestamp)}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-primary text-[10px] text-text-tertiary">
          <span>
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mr-1">↑↓</kbd> Navigate
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mx-1">↵</kbd> Open
            <kbd className="bg-bg-tertiary px-1 py-0.5 rounded mx-1">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
