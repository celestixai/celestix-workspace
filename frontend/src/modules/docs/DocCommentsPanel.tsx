import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Check, MessageSquare, Send, Trash2 } from 'lucide-react';
import {
  useDocComments,
  useCreateDocComment,
  useResolveDocComment,
  useDeleteDocComment,
  type DocCommentEnhanced,
} from '@/hooks/useDocs';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CommentItem({
  comment,
  onResolve,
  onDelete,
}: {
  comment: DocCommentEnhanced;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        comment.isResolved
          ? 'border-border-primary opacity-50'
          : 'border-accent-blue/30 bg-accent-blue/5'
      )}
    >
      {/* Highlighted text quote */}
      {comment.highlightedText && (
        <div className="mb-2 px-2 py-1.5 bg-yellow-500/10 border-l-2 border-yellow-500/50 rounded-r text-xs text-text-secondary italic">
          "{comment.highlightedText}"
        </div>
      )}

      {/* Author + time */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] font-bold text-accent-blue">
            {comment.user.displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span className="text-xs font-medium text-text-primary">{comment.user.displayName}</span>
        </div>
        <span className="text-xs text-text-secondary">{timeAgo(comment.createdAt)}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-text-primary mb-2 ml-6">{comment.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-6">
        {!comment.isResolved && (
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs text-accent-blue hover:underline flex items-center gap-1"
          >
            <Check size={12} />
            Resolve
          </button>
        )}
        {comment.isResolved && (
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs text-text-secondary hover:underline flex items-center gap-1"
          >
            Unresolve
          </button>
        )}
        <button
          onClick={() => onDelete(comment.id)}
          className="text-xs text-text-secondary hover:text-red-400 flex items-center gap-1"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 ml-4 space-y-2 border-l border-border-primary pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-medium text-text-primary">{reply.user.displayName}</span>
                <span className="text-text-secondary">{timeAgo(reply.createdAt)}</span>
              </div>
              <p className="text-text-primary">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// DocCommentsPanel
// ==========================================

export function DocCommentsPanel({
  docId,
  onClose,
}: {
  docId: string;
  onClose: () => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const { data: comments = [] } = useDocComments(docId);
  const createComment = useCreateDocComment();
  const resolveComment = useResolveDocComment();
  const deleteComment = useDeleteDocComment();

  const filteredComments = showResolved
    ? comments
    : comments.filter((c) => !c.isResolved);

  const unresolvedCount = comments.filter((c) => !c.isResolved).length;

  const handleAdd = () => {
    if (!newComment.trim()) return;
    createComment.mutate({ docId, data: { content: newComment.trim() } });
    setNewComment('');
  };

  return (
    <aside className="w-80 bg-bg-secondary border-l border-border-primary flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-accent-blue" />
          <h3 className="text-sm font-semibold text-text-primary">
            Comments ({unresolvedCount})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors',
              showResolved
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {showResolved ? 'Hide Resolved' : 'Show All'}
          </button>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredComments.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">
            {comments.length === 0 ? 'No comments yet.' : 'No unresolved comments.'}
          </p>
        ) : (
          filteredComments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onResolve={(id) => resolveComment.mutate(id)}
              onDelete={(id) => deleteComment.mutate(id)}
            />
          ))
        )}
      </div>

      {/* Add comment input */}
      <div className="p-3 border-t border-border-primary">
        <div className="flex items-center gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a comment..."
            className="flex-1 bg-bg-primary border border-border-primary rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent-blue"
          />
          <button
            onClick={handleAdd}
            disabled={!newComment.trim()}
            className="p-2 text-accent-blue hover:bg-accent-blue/10 rounded transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
