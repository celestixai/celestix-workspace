import { useState } from 'react';
import { CardWrapper } from './CardWrapper';

interface TextBlockCardProps {
  cardId: string;
  title: string;
  config: Record<string, unknown>;
  isEditMode?: boolean;
  onConfigure?: () => void;
  onDelete?: () => void;
  onUpdateConfig?: (config: Record<string, unknown>) => void;
}

export function TextBlockCard({
  cardId,
  title,
  config,
  isEditMode,
  onConfigure,
  onDelete,
  onUpdateConfig,
}: TextBlockCardProps) {
  const content = (config?.content as string) ?? '';
  const [editContent, setEditContent] = useState(content);
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdateConfig?.({ ...config, content: editContent });
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
        <div className="flex flex-col h-full gap-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 w-full bg-bg-tertiary border border-border-primary rounded-lg p-2 text-xs text-text-primary resize-none focus:outline-none focus:border-accent-blue"
            placeholder="Enter text content..."
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
      ) : (
        <div
          className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed cursor-pointer h-full"
          onClick={() => isEditMode && setEditing(true)}
        >
          {content || (
            <span className="text-text-tertiary italic">
              {isEditMode ? 'Click to add content...' : 'No content'}
            </span>
          )}
        </div>
      )}
    </CardWrapper>
  );
}
