import { useState } from 'react';
import { usePost, useAddPostComment, useTogglePostPin, useDeletePost } from '@/hooks/usePosts';
import type { PostComment } from '@/hooks/usePosts';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/shared/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn, formatFullDate } from '@/lib/utils';
import {
  Pin,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Send,
  ArrowLeft,
} from 'lucide-react';

interface PostViewProps {
  postId: string;
  onBack?: () => void;
}

export function PostView({ postId, onBack }: PostViewProps) {
  const { data: post, isLoading } = usePost(postId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const togglePin = useTogglePostPin(postId);
  const deletePost = useDeletePost(postId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-bg-tertiary rounded animate-pulse w-2/3" />
        <div className="h-4 bg-bg-tertiary rounded animate-pulse w-1/3" />
        <div className="h-32 bg-bg-tertiary rounded animate-pulse" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-6 text-text-secondary text-center">Post not found.</div>
    );
  }

  const isAuthor = currentUserId === post.authorId;

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync();
      toast('Post deleted', 'success');
      onBack?.();
    } catch {
      toast('Failed to delete post', 'error');
    }
  };

  const handleTogglePin = async () => {
    try {
      await togglePin.mutateAsync();
      toast(post.isPinned ? 'Post unpinned' : 'Post pinned', 'success');
    } catch {
      toast('Failed to toggle pin', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border-primary sticky top-0 bg-bg-primary z-10">
        {onBack && (
          <button onClick={onBack} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="text-lg font-semibold text-text-primary flex-1 truncate">{post.title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePin}
            className={cn(
              'p-1.5 rounded hover:bg-bg-tertiary transition-colors',
              post.isPinned ? 'text-accent-primary' : 'text-text-tertiary',
            )}
            title={post.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={16} />
          </button>
          {isAuthor && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-text-tertiary hover:text-red-400 hover:bg-bg-tertiary transition-colors"
              title="Delete post"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Cover image */}
      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt="Cover"
          className="w-full h-48 object-cover"
        />
      )}

      {/* Post Content */}
      <div className="p-6">
        {/* Author + meta */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} size="md" />
          <div>
            <div className="font-medium text-text-primary">{post.author.displayName}</div>
            <div className="text-xs text-text-tertiary">{formatFullDate(post.createdAt)}</div>
          </div>
          {post.isPinned && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/20 text-accent-blue">
              Pinned
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-4">{post.title}</h1>

        {/* Content */}
        <div className="prose prose-invert max-w-none text-text-secondary whitespace-pre-wrap text-sm leading-relaxed">
          {post.content}
        </div>
      </div>

      {/* Comments */}
      <div className="border-t border-border-primary p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <MessageSquare size={16} />
          Comments ({post.comments?.length ?? 0})
        </h3>

        {/* Comment list */}
        <div className="space-y-4 mb-6">
          {post.comments?.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))}
        </div>

        {/* Add comment */}
        <CommentInput postId={postId} />
      </div>
    </div>
  );
}

// ==========================================
// Comment Components
// ==========================================

function CommentItem({ comment, postId, depth = 0 }: { comment: PostComment; postId: string; depth?: number }) {
  const [showReplies, setShowReplies] = useState(true);
  const [showReplyInput, setShowReplyInput] = useState(false);

  return (
    <div className={cn('group', depth > 0 && 'ml-6 pl-4 border-l border-border-primary')}>
      <div className="flex items-start gap-3">
        <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{comment.author.displayName}</span>
            <span className="text-xs text-text-tertiary">{formatFullDate(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{comment.content}</p>
          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="text-xs text-text-tertiary hover:text-accent-primary mt-1"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Reply Input */}
      {showReplyInput && (
        <div className="ml-10 mt-2">
          <CommentInput postId={postId} parentCommentId={comment.id} onDone={() => setShowReplyInput(false)} />
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2 ml-10"
          >
            {showReplies ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies &&
            comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} postId={postId} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
}

function CommentInput({
  postId,
  parentCommentId,
  onDone,
}: {
  postId: string;
  parentCommentId?: string;
  onDone?: () => void;
}) {
  const [text, setText] = useState('');
  const addComment = useAddPostComment(postId);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await addComment.mutateAsync({ content: text.trim(), parentCommentId });
      setText('');
      onDone?.();
    } catch {
      toast('Failed to add comment', 'error');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder={parentCommentId ? 'Write a reply...' : 'Add a comment...'}
        className="flex-1 bg-bg-secondary border border-border-primary rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!text.trim() || addComment.isPending}
      >
        <Send size={14} />
      </Button>
    </div>
  );
}
