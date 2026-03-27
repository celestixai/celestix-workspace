import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useCreatePost } from '@/hooks/usePosts';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  ImageIcon,
  X,
} from 'lucide-react';

interface PostComposerProps {
  channelId: string;
  onClose?: () => void;
  onPublished?: () => void;
}

export function PostComposer({ channelId, onClose, onPublished }: PostComposerProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [showCoverInput, setShowCoverInput] = useState(false);

  const createPost = useCreatePost(channelId);

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) {
      toast('Title and content are required', 'error');
      return;
    }

    try {
      await createPost.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        coverImageUrl: coverImageUrl.trim() || undefined,
      });
      toast('Post published', 'success');
      setTitle('');
      setContent('');
      setCoverImageUrl('');
      onPublished?.();
      onClose?.();
    } catch {
      toast('Failed to publish post', 'error');
    }
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = document.getElementById('post-content') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);
    setContent(before + prefix + selected + suffix + after);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + selected.length;
    }, 0);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary rounded-lg border border-border-primary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <h3 className="text-lg font-semibold text-text-primary">Write a Post</h3>
        {onClose && (
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Cover Image */}
      {showCoverInput ? (
        <div className="px-4 pt-4 flex items-center gap-2">
          <Input
            placeholder="Cover image URL..."
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            className="flex-1"
          />
          <button
            onClick={() => { setShowCoverInput(false); setCoverImageUrl(''); }}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {coverImageUrl && (
        <div className="px-4 pt-2">
          <img
            src={coverImageUrl}
            alt="Cover"
            className="w-full h-40 object-cover rounded-md"
            onError={() => setCoverImageUrl('')}
          />
        </div>
      )}

      {/* Title */}
      <div className="px-4 pt-4">
        <input
          type="text"
          placeholder="Post title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary"
        />
      </div>

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <ToolbarButton icon={<Bold size={16} />} onClick={() => insertFormatting('**', '**')} title="Bold" />
        <ToolbarButton icon={<Italic size={16} />} onClick={() => insertFormatting('*', '*')} title="Italic" />
        <ToolbarButton icon={<Code size={16} />} onClick={() => insertFormatting('`', '`')} title="Code" />
        <ToolbarButton icon={<Link size={16} />} onClick={() => insertFormatting('[', '](url)')} title="Link" />
        <ToolbarButton icon={<List size={16} />} onClick={() => insertFormatting('\n- ', '')} title="Bullet list" />
        <ToolbarButton icon={<ListOrdered size={16} />} onClick={() => insertFormatting('\n1. ', '')} title="Numbered list" />
        <ToolbarButton
          icon={<ImageIcon size={16} />}
          onClick={() => setShowCoverInput(true)}
          title="Add cover image"
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-4">
        <textarea
          id="post-content"
          placeholder="Write your post content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full min-h-[200px] bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary resize-none text-sm leading-relaxed"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-4 border-t border-border-primary">
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handlePublish}
          disabled={!title.trim() || !content.trim() || createPost.isPending}
        >
          {createPost.isPending ? 'Publishing...' : 'Publish Post'}
        </Button>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors',
      )}
    >
      {icon}
    </button>
  );
}
