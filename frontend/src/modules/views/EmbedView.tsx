import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Link,
  ExternalLink,
  Loader2,
  Globe,
  FileText,
  Paintbrush,
  Video,
  LayoutGrid,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface EmbedViewProps {
  config?: { url?: string };
  onConfigChange?: (config: { url: string }) => void;
}

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

interface EmbedHint {
  name: string;
  icon: React.ReactNode;
  hint: string;
  example: string;
}

const EMBED_HINTS: EmbedHint[] = [
  {
    name: 'Google Docs',
    icon: <FileText size={16} className="text-blue-500" />,
    hint: 'Use the "Publish to web" URL',
    example: 'https://docs.google.com/document/d/.../pub',
  },
  {
    name: 'Figma',
    icon: <Paintbrush size={16} className="text-purple-500" />,
    hint: 'Use the embed link from Share menu',
    example: 'https://www.figma.com/embed?...',
  },
  {
    name: 'Miro',
    icon: <LayoutGrid size={16} className="text-yellow-500" />,
    hint: 'Use the embed link from board settings',
    example: 'https://miro.com/app/live-embed/...',
  },
  {
    name: 'YouTube',
    icon: <Video size={16} className="text-red-500" />,
    hint: 'Use the embed URL',
    example: 'https://www.youtube.com/embed/VIDEO_ID',
  },
  {
    name: 'Loom',
    icon: <Video size={16} className="text-indigo-500" />,
    hint: 'Use the share embed URL',
    example: 'https://www.loom.com/embed/VIDEO_ID',
  },
];

// -----------------------------------------------
// Component
// -----------------------------------------------

export function EmbedView({ config, onConfigChange }: EmbedViewProps) {
  const [urlInput, setUrlInput] = useState(config?.url ?? '');
  const [isEditing, setIsEditing] = useState(!config?.url);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentUrl = config?.url;

  const handleEmbed = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      return;
    }
    setError('');
    setIframeLoading(true);
    onConfigChange?.({ url: trimmed });
    setIsEditing(false);
  }, [urlInput, onConfigChange]);

  const handleChangeUrl = useCallback(() => {
    setIsEditing(true);
    setUrlInput(currentUrl ?? '');
  }, [currentUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleEmbed();
    },
    [handleEmbed],
  );

  // URL input mode
  if (isEditing || !currentUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-bg-secondary flex items-center justify-center mb-3">
              <Globe size={28} className="text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Embed a URL</h3>
            <p className="text-sm text-text-tertiary mt-1">
              Embed external content like documents, designs, or videos
            </p>
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="https://..."
              className={cn(
                'flex-1 px-3 py-2 text-sm rounded-md border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50',
                error ? 'border-red-500' : 'border-border',
              )}
              autoFocus
            />
            <button
              onClick={handleEmbed}
              className="px-4 py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              Embed
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

          {/* Embed hints */}
          <div className="mt-8">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
              Supported Embeds
            </p>
            <div className="space-y-2">
              {EMBED_HINTS.map((hint) => (
                <div
                  key={hint.name}
                  className="flex items-start gap-3 p-2.5 rounded-md bg-bg-secondary/50 border border-border/50"
                >
                  <div className="mt-0.5 shrink-0">{hint.icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary">{hint.name}</p>
                    <p className="text-[11px] text-text-tertiary">{hint.hint}</p>
                    <p className="text-[10px] text-text-tertiary/60 font-mono truncate mt-0.5">
                      {hint.example}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Iframe mode
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-bg-secondary/50">
        <Link size={14} className="text-text-tertiary" />
        <span className="text-xs text-text-secondary truncate flex-1" title={currentUrl}>
          {currentUrl}
        </span>
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-bg-secondary transition-colors text-text-tertiary"
          title="Open in new tab"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={handleChangeUrl}
          className="px-2.5 py-1 text-xs rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors"
        >
          Change URL
        </button>
      </div>

      {/* Iframe */}
      <div className="flex-1 relative">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-text-tertiary" />
              <span className="text-xs text-text-tertiary">Loading embed...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={currentUrl}
          className="w-full h-full border-0"
          style={{ minHeight: 'calc(100vh - 200px)' }}
          onLoad={() => setIframeLoading(false)}
          onError={() => setIframeLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
