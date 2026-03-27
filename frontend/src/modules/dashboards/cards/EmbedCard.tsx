import { useState } from 'react';
import { Globe } from 'lucide-react';
import { CardWrapper } from './CardWrapper';

interface EmbedCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
  onUpdateConfig?: (config: Record<string, unknown>) => void;
}

export function EmbedCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
  onUpdateConfig,
}: EmbedCardProps) {
  const url = (config?.url as string) ?? '';
  const [urlInput, setUrlInput] = useState(url);
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdateConfig?.({ ...config, url: urlInput });
    setEditing(false);
  };

  return (
    <CardWrapper
      title={title}
      isEditMode={isEditMode}
      onConfigure={onConfigure}
      onDelete={onDelete}
    >
      {isEditMode && editing ? (
        <div className="flex flex-col gap-2 h-full">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="w-full h-8 px-3 bg-bg-tertiary border border-border-primary rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="text-[10px] px-2 py-1 rounded text-text-tertiary hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-[10px] px-2 py-1 rounded bg-accent-blue text-white hover:bg-accent-blue/90"
            >
              Save
            </button>
          </div>
        </div>
      ) : url ? (
        <iframe
          src={url}
          className="w-full h-full rounded-lg border-0"
          sandbox="allow-scripts allow-same-origin"
          title={title}
        />
      ) : (
        <div
          className="flex flex-col items-center justify-center h-full text-text-tertiary text-xs gap-2 cursor-pointer"
          onClick={() => isEditMode && setEditing(true)}
        >
          <Globe size={24} className="opacity-30" />
          <span>{isEditMode ? 'Click to set URL' : 'No URL configured'}</span>
        </div>
      )}
    </CardWrapper>
  );
}
