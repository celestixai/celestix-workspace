import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Home,
  Users,
  TrendingUp,
  Hash,
  Plus,
  Image,
  MessageCircle,
  Send,
  Search,
  ThumbsUp,
  Heart,
  PartyPopper,
  Lightbulb,
  HelpCircle,
  Award,
  Pin,
  ChevronDown,
  ChevronRight,
  X,
  BarChart3,
  Megaphone,
  Star,
  Check,
  ArrowLeft,
  Upload,
  MoreHorizontal,
  Globe,
  Lock,
  UserPlus,
  UserMinus,
} from 'lucide-react';

type PostType = 'discussion' | 'question' | 'poll' | 'praise' | 'announcement';
type ReactionType = 'like' | 'love' | 'celebrate' | 'insightful' | 'curious';
type SidebarView = 'feed' | 'communities' | 'trending' | 'people' | 'community-detail';

interface Reaction {
  type: ReactionType;
  count: number;
  reacted: boolean;
}

interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  replies: Comment[];
  isBestAnswer?: boolean;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Post {
  id: string;
  type: PostType;
  authorName: string;
  authorAvatar: string;
  communityId: string;
  communityName: string;
  content: string;
  images: string[];
  reactions: Reaction[];
  comments: Comment[];
  createdAt: string;
  pinned?: boolean;
  pollOptions?: PollOption[];
  pollVoted?: string | null;
  praiseRecipient?: string;
}

interface Community {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  memberCount: number;
  joined: boolean;
  isPrivate: boolean;
}

interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
}

interface TrendingTag {
  tag: string;
  postCount: number;
}

const REACTION_CONFIG: { type: ReactionType; icon: React.ReactNode; label: string }[] = [
  { type: 'like', icon: <ThumbsUp size={14} />, label: 'Like' },
  { type: 'love', icon: <Heart size={14} />, label: 'Love' },
  { type: 'celebrate', icon: <PartyPopper size={14} />, label: 'Celebrate' },
  { type: 'insightful', icon: <Lightbulb size={14} />, label: 'Insightful' },
  { type: 'curious', icon: <HelpCircle size={14} />, label: 'Curious' },
];

const POST_TYPE_CONFIG: { type: PostType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'discussion', label: 'Discussion', icon: <MessageCircle size={12} />, color: 'text-cx-brand bg-cx-brand/10' },
  { type: 'question', label: 'Question', icon: <HelpCircle size={12} />, color: 'text-amber-400 bg-amber-400/10' },
  { type: 'poll', label: 'Poll', icon: <BarChart3 size={12} />, color: 'text-purple-400 bg-purple-400/10' },
  { type: 'praise', label: 'Praise', icon: <Award size={12} />, color: 'text-pink-400 bg-pink-400/10' },
  { type: 'announcement', label: 'Announcement', icon: <Megaphone size={12} />, color: 'text-cx-danger bg-red-400/10' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function timeAgo(dateStr: string): string {
  const now = new Date('2026-03-07');
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function createDefaultReactions(): Reaction[] {
  return REACTION_CONFIG.map((r) => ({ type: r.type, count: 0, reacted: false }));
}

export function SocialPage() {
  const [sidebarView, setSidebarView] = useState<SidebarView>('feed');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [trending, setTrending] = useState<TrendingTag[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<PostType>('discussion');
  const [newPostCommunity, setNewPostCommunity] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [newPraiseRecipient, setNewPraiseRecipient] = useState('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId?: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');

  useEffect(() => {
    api.get('/social/feed').then((res: any) => {
      if (res?.data) {
        setPosts(res.data.posts || []);
        setCommunities(res.data.communities || []);
        setPeople(res.data.people || []);
        setTrending(res.data.trending || []);
      }
    }).catch(() => {
      setCommunities([
        { id: 'c1', name: 'Engineering', description: 'Engineering team discussions, code reviews, and tech talks.', coverImage: '', memberCount: 142, joined: true, isPrivate: false },
        { id: 'c2', name: 'Product & Design', description: 'Product roadmap, design reviews, and UX discussions.', coverImage: '', memberCount: 89, joined: true, isPrivate: false },
        { id: 'c3', name: 'All Hands', description: 'Company-wide announcements and discussions.', coverImage: '', memberCount: 450, joined: true, isPrivate: false },
        { id: 'c4', name: 'Random', description: 'Off-topic fun, memes, and water cooler chat.', coverImage: '', memberCount: 380, joined: false, isPrivate: false },
        { id: 'c5', name: 'Leadership', description: 'Executive team updates and strategy discussions.', coverImage: '', memberCount: 25, joined: false, isPrivate: true },
      ]);
      setPosts([
        {
          id: 'p1', type: 'announcement', authorName: 'Sarah Kim', authorAvatar: '', communityId: 'c3', communityName: 'All Hands',
          content: 'Excited to announce that we have officially surpassed 10,000 customers! This is a huge milestone for the company. Thank you all for your incredible work! #milestone #growth',
          images: [], reactions: [{ type: 'like', count: 45, reacted: true }, { type: 'love', count: 32, reacted: false }, { type: 'celebrate', count: 78, reacted: false }, { type: 'insightful', count: 5, reacted: false }, { type: 'curious', count: 0, reacted: false }],
          comments: [
            { id: 'cm1', authorName: 'Mike Chen', authorAvatar: '', content: 'This is amazing! Congrats team!', createdAt: '2026-03-07T10:00:00', reactions: [{ type: 'like', count: 12, reacted: false }, { type: 'love', count: 3, reacted: false }, { type: 'celebrate', count: 0, reacted: false }, { type: 'insightful', count: 0, reacted: false }, { type: 'curious', count: 0, reacted: false }], replies: [] },
          ],
          createdAt: '2026-03-07T08:00:00', pinned: true,
        },
        {
          id: 'p2', type: 'question', authorName: 'Alex Rivera', authorAvatar: '', communityId: 'c1', communityName: 'Engineering',
          content: 'Has anyone successfully set up hot module replacement with the new build pipeline? I keep running into a caching issue where changes are not reflected. Any tips?',
          images: [], reactions: [{ type: 'like', count: 3, reacted: false }, { type: 'love', count: 0, reacted: false }, { type: 'celebrate', count: 0, reacted: false }, { type: 'insightful', count: 2, reacted: false }, { type: 'curious', count: 8, reacted: false }],
          comments: [
            { id: 'cm2', authorName: 'Jordan Lee', authorAvatar: '', content: 'Yes! You need to clear the .cache directory and add the --force flag to the dev server. That fixed it for me.', createdAt: '2026-03-06T15:30:00', reactions: [{ type: 'like', count: 7, reacted: false }, { type: 'love', count: 0, reacted: false }, { type: 'celebrate', count: 0, reacted: false }, { type: 'insightful', count: 4, reacted: false }, { type: 'curious', count: 0, reacted: false }], replies: [
              { id: 'cm2r1', authorName: 'Alex Rivera', authorAvatar: '', content: 'That worked! Thank you so much!', createdAt: '2026-03-06T16:00:00', reactions: createDefaultReactions(), replies: [] },
            ], isBestAnswer: true },
          ],
          createdAt: '2026-03-06T14:00:00',
        },
        {
          id: 'p3', type: 'poll', authorName: 'Dana Park', authorAvatar: '', communityId: 'c2', communityName: 'Product & Design',
          content: 'Which design system component should we prioritize next?',
          images: [], reactions: [{ type: 'like', count: 15, reacted: false }, { type: 'love', count: 0, reacted: false }, { type: 'celebrate', count: 0, reacted: false }, { type: 'insightful', count: 6, reacted: false }, { type: 'curious', count: 2, reacted: false }],
          comments: [],
          createdAt: '2026-03-06T09:00:00',
          pollOptions: [
            { id: 'po1', text: 'Date Picker', votes: 28 },
            { id: 'po2', text: 'Data Table', votes: 42 },
            { id: 'po3', text: 'Command Palette', votes: 35 },
            { id: 'po4', text: 'Rich Text Editor', votes: 19 },
          ],
          pollVoted: null,
        },
        {
          id: 'p4', type: 'praise', authorName: 'Chris Yang', authorAvatar: '', communityId: 'c3', communityName: 'All Hands',
          content: 'Huge shoutout to the infrastructure team for achieving 99.99% uptime this quarter! Your dedication to reliability is truly inspiring. #kudos #infrastructure',
          images: [], reactions: [{ type: 'like', count: 22, reacted: false }, { type: 'love', count: 18, reacted: false }, { type: 'celebrate', count: 41, reacted: false }, { type: 'insightful', count: 0, reacted: false }, { type: 'curious', count: 0, reacted: false }],
          comments: [], createdAt: '2026-03-05T16:00:00', praiseRecipient: 'Infrastructure Team',
        },
        {
          id: 'p5', type: 'discussion', authorName: 'Robin Patel', authorAvatar: '', communityId: 'c1', communityName: 'Engineering',
          content: 'Just finished reading "Designing Data-Intensive Applications" and I highly recommend it. The chapters on distributed systems and consensus are incredibly well written. Who else has read it?',
          images: [], reactions: [{ type: 'like', count: 9, reacted: false }, { type: 'love', count: 2, reacted: false }, { type: 'celebrate', count: 0, reacted: false }, { type: 'insightful', count: 14, reacted: false }, { type: 'curious', count: 3, reacted: false }],
          comments: [], createdAt: '2026-03-05T11:00:00',
        },
      ]);
      setPeople([
        { id: 'u1', name: 'Sarah Kim', role: 'CEO', department: 'Executive', avatar: '' },
        { id: 'u2', name: 'Alex Rivera', role: 'Senior Engineer', department: 'Engineering', avatar: '' },
        { id: 'u3', name: 'Dana Park', role: 'Product Designer', department: 'Design', avatar: '' },
        { id: 'u4', name: 'Mike Chen', role: 'Engineering Manager', department: 'Engineering', avatar: '' },
        { id: 'u5', name: 'Jordan Lee', role: 'Staff Engineer', department: 'Engineering', avatar: '' },
        { id: 'u6', name: 'Chris Yang', role: 'VP of Operations', department: 'Operations', avatar: '' },
        { id: 'u7', name: 'Robin Patel', role: 'Backend Engineer', department: 'Engineering', avatar: '' },
        { id: 'u8', name: 'Taylor Kim', role: 'UX Researcher', department: 'Design', avatar: '' },
        { id: 'u9', name: 'Morgan Liu', role: 'Data Analyst', department: 'Analytics', avatar: '' },
        { id: 'u10', name: 'Casey Wong', role: 'Frontend Engineer', department: 'Engineering', avatar: '' },
      ]);
      setTrending([
        { tag: '#milestone', postCount: 24 },
        { tag: '#growth', postCount: 18 },
        { tag: '#kudos', postCount: 15 },
        { tag: '#infrastructure', postCount: 12 },
        { tag: '#designsystem', postCount: 11 },
        { tag: '#quarterly-review', postCount: 9 },
        { tag: '#hackathon', postCount: 8 },
        { tag: '#onboarding', postCount: 7 },
      ]);
    });
  }, []);

  const handleReact = (postId: string, reactionType: ReactionType) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              reactions: p.reactions.map((r) =>
                r.type === reactionType
                  ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
                  : r
              ),
            }
          : p
      )
    );
  };

  const handleCommentReact = (postId: string, commentId: string, reactionType: ReactionType) => {
    const updateComments = (comments: Comment[]): Comment[] =>
      comments.map((c) =>
        c.id === commentId
          ? { ...c, reactions: c.reactions.map((r) => r.type === reactionType ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r) }
          : { ...c, replies: updateComments(c.replies) }
      );
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: updateComments(p.comments) } : p));
  };

  const handleVotePoll = (postId: string, optionId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId && !p.pollVoted
          ? {
              ...p,
              pollVoted: optionId,
              pollOptions: p.pollOptions?.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
            }
          : p
      )
    );
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim() || !newPostCommunity) return;
    const community = communities.find((c) => c.id === newPostCommunity);
    const newPost: Post = {
      id: generateId(),
      type: newPostType,
      authorName: 'You',
      authorAvatar: '',
      communityId: newPostCommunity,
      communityName: community?.name || '',
      content: newPostContent,
      images: [],
      reactions: createDefaultReactions(),
      comments: [],
      createdAt: new Date().toISOString(),
      pollOptions: newPostType === 'poll' ? newPollOptions.filter((o) => o.trim()).map((o) => ({ id: generateId(), text: o, votes: 0 })) : undefined,
      praiseRecipient: newPostType === 'praise' ? newPraiseRecipient : undefined,
    };
    setPosts((prev) => [newPost, ...prev]);
    setNewPostContent('');
    setNewPostType('discussion');
    setNewPollOptions(['', '']);
    setNewPraiseRecipient('');
    setShowCreatePost(false);
  };

  const handleAddComment = (postId: string, parentCommentId?: string) => {
    if (!replyText.trim()) return;
    const newComment: Comment = {
      id: generateId(),
      authorName: 'You',
      authorAvatar: '',
      content: replyText,
      createdAt: new Date().toISOString(),
      reactions: createDefaultReactions(),
      replies: [],
    };

    if (parentCommentId) {
      const addReply = (comments: Comment[]): Comment[] =>
        comments.map((c) =>
          c.id === parentCommentId ? { ...c, replies: [...c.replies, newComment] } : { ...c, replies: addReply(c.replies) }
        );
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: addReply(p.comments) } : p));
    } else {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    }
    setReplyText('');
    setReplyingTo(null);
  };

  const handleToggleCommunity = (communityId: string) => {
    setCommunities((prev) =>
      prev.map((c) => c.id === communityId ? { ...c, joined: !c.joined, memberCount: c.joined ? c.memberCount - 1 : c.memberCount + 1 } : c)
    );
  };

  const handleCreateCommunity = () => {
    if (!newCommunityName.trim()) return;
    const newC: Community = {
      id: generateId(),
      name: newCommunityName,
      description: newCommunityDesc,
      coverImage: '',
      memberCount: 1,
      joined: true,
      isPrivate: false,
    };
    setCommunities((prev) => [...prev, newC]);
    setNewCommunityName('');
    setNewCommunityDesc('');
    setShowCreateCommunity(false);
  };

  const filteredPosts = selectedCommunity
    ? posts.filter((p) => p.communityId === selectedCommunity.id)
    : posts.filter((p) => communities.find((c) => c.id === p.communityId)?.joined);

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filteredPeople = people.filter(
    (p) =>
      p.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      p.role.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      p.department.toLowerCase().includes(peopleSearch.toLowerCase())
  );

  const renderComment = (comment: Comment, postId: string, depth: number = 0) => (
    <div key={comment.id} className={cn('mt-2', depth > 0 && 'ml-6 pl-3 border-l border-[var(--cx-border-1)]/50')}>
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-cx-bg flex items-center justify-center shrink-0">
          <span className="text-[10px] text-[var(--cx-text-2)] font-medium">{comment.authorName.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--cx-text-1)]">{comment.authorName}</span>
            <span className="text-[10px] text-[var(--cx-text-2)]">{timeAgo(comment.createdAt)}</span>
            {comment.isBestAnswer && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-cx-success bg-green-400/10 px-1.5 py-0.5 rounded-full">
                <Check size={8} /> Best Answer
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--cx-text-1)] mt-0.5">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1">
            {comment.reactions.filter((r) => r.count > 0 || r.reacted).slice(0, 3).map((r) => {
              const config = REACTION_CONFIG.find((rc) => rc.type === r.type);
              return (
                <button
                  key={r.type}
                  onClick={() => handleCommentReact(postId, comment.id, r.type)}
                  className={cn(
                    'flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded transition-colors',
                    r.reacted ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--cx-text-2)] hover:bg-cx-bg'
                  )}
                >
                  {config?.icon} {r.count > 0 && r.count}
                </button>
              );
            })}
            <button
              onClick={() => setReplyingTo({ postId, commentId: comment.id })}
              className="text-[10px] text-[var(--cx-text-2)] hover:text-accent-blue"
            >
              Reply
            </button>
          </div>
          {replyingTo?.postId === postId && replyingTo.commentId === comment.id && (
            <div className="flex gap-2 mt-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(postId, comment.id); }}
                placeholder="Write a reply..."
                className="flex-1 bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-1 text-xs text-[var(--cx-text-1)] outline-none"
              />
              <button onClick={() => handleAddComment(postId, comment.id)} className="text-accent-blue hover:text-accent-blue/80">
                <Send size={12} />
              </button>
            </div>
          )}
          {comment.replies.map((reply) => renderComment(reply, postId, depth + 1))}
        </div>
      </div>
    </div>
  );

  const renderPost = (post: Post) => {
    const typeConfig = POST_TYPE_CONFIG.find((t) => t.type === post.type);
    const totalPollVotes = post.pollOptions?.reduce((s, o) => s + o.votes, 0) || 0;
    const isExpanded = expandedComments.has(post.id);

    return (
      <div
        key={post.id}
        className={cn(
          'bg-cx-surface border rounded-xl p-4 mb-3',
          post.pinned ? 'border-amber-500/30' : 'border-[var(--cx-border-1)]',
          post.type === 'announcement' && 'ring-1 ring-red-500/10'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-cx-bg flex items-center justify-center shrink-0">
            <span className="text-sm text-[var(--cx-text-2)] font-medium">{post.authorName.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[var(--cx-text-1)]">{post.authorName}</span>
              <span className="text-xs text-[var(--cx-text-2)]">in</span>
              <button
                onClick={() => {
                  const c = communities.find((cm) => cm.id === post.communityId);
                  if (c) { setSelectedCommunity(c); setSidebarView('community-detail'); }
                }}
                className="text-xs text-accent-blue hover:underline"
              >
                {post.communityName}
              </button>
              <span className={cn('flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full', typeConfig?.color)}>
                {typeConfig?.icon} {typeConfig?.label}
              </span>
              {post.pinned && <Pin size={10} className="text-amber-400" />}
            </div>
            <span className="text-[10px] text-[var(--cx-text-2)]">{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        {/* Praise recipient */}
        {post.type === 'praise' && post.praiseRecipient && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-pink-500/5 border border-pink-500/10 rounded-lg">
            <Award size={16} className="text-pink-400" />
            <span className="text-sm text-[var(--cx-text-1)]">
              Praising <span className="font-semibold text-pink-400">{post.praiseRecipient}</span>
            </span>
          </div>
        )}

        {/* Content */}
        <p className="text-sm text-[var(--cx-text-1)] whitespace-pre-wrap mb-3">{post.content}</p>

        {/* Poll options */}
        {post.type === 'poll' && post.pollOptions && (
          <div className="space-y-2 mb-3">
            {post.pollOptions.map((opt) => {
              const pct = totalPollVotes > 0 ? (opt.votes / totalPollVotes) * 100 : 0;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleVotePoll(post.id, opt.id)}
                  disabled={!!post.pollVoted}
                  className={cn(
                    'w-full text-left relative rounded-lg border p-2.5 overflow-hidden transition-colors',
                    post.pollVoted === opt.id ? 'border-accent-blue bg-accent-blue/5' : 'border-[var(--cx-border-1)] hover:border-accent-blue/50'
                  )}
                >
                  {post.pollVoted && (
                    <div
                      className="absolute inset-y-0 left-0 bg-accent-blue/10 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative flex items-center justify-between">
                    <span className="text-sm text-[var(--cx-text-1)]">{opt.text}</span>
                    {post.pollVoted && (
                      <span className="text-xs text-[var(--cx-text-2)]">{Math.round(pct)}%</span>
                    )}
                  </div>
                </button>
              );
            })}
            <p className="text-[10px] text-[var(--cx-text-2)]">{totalPollVotes} votes</p>
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {post.reactions.map((r) => {
            const config = REACTION_CONFIG.find((rc) => rc.type === r.type);
            if (r.count === 0 && !r.reacted) return null;
            return (
              <button
                key={r.type}
                onClick={() => handleReact(post.id, r.type)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors',
                  r.reacted ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30' : 'bg-cx-bg text-[var(--cx-text-2)] hover:bg-cx-bg/80 border border-transparent'
                )}
              >
                {config?.icon}
                <span>{r.count}</span>
              </button>
            );
          })}
          {/* Quick react buttons for reactions with 0 count */}
          <div className="flex items-center gap-0.5 ml-1">
            {REACTION_CONFIG.filter((rc) => {
              const r = post.reactions.find((rr) => rr.type === rc.type);
              return (!r || r.count === 0) && !r?.reacted;
            }).map((rc) => (
              <button
                key={rc.type}
                onClick={() => handleReact(post.id, rc.type)}
                className="p-1 text-[var(--cx-text-2)]/40 hover:text-[var(--cx-text-2)] rounded transition-colors"
                title={rc.label}
              >
                {rc.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Comments toggle */}
        <div className="border-t border-[var(--cx-border-1)]/50 pt-2">
          <button
            onClick={() => {
              const next = new Set(expandedComments);
              isExpanded ? next.delete(post.id) : next.add(post.id);
              setExpandedComments(next);
            }}
            className="flex items-center gap-1 text-xs text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]"
          >
            <MessageCircle size={12} />
            {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
            <ChevronDown size={10} className={cn('transition-transform', isExpanded && 'rotate-180')} />
          </button>

          {isExpanded && (
            <div className="mt-2">
              {post.comments.map((c) => renderComment(c, post.id))}
              {/* Add comment */}
              <div className="flex gap-2 mt-3">
                <input
                  value={replyingTo?.postId === post.id && !replyingTo.commentId ? replyText : ''}
                  onChange={(e) => { setReplyText(e.target.value); setReplyingTo({ postId: post.id }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                  placeholder="Write a comment..."
                  className="flex-1 bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-1.5 text-xs text-[var(--cx-text-1)] outline-none"
                />
                <button
                  onClick={() => { setReplyingTo({ postId: post.id }); handleAddComment(post.id); }}
                  className="text-accent-blue hover:text-accent-blue/80"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-cx-bg flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-60 bg-cx-surface border-r border-[var(--cx-border-1)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--cx-border-1)]">
          <h1 className="text-lg font-display text-[var(--cx-text-1)]">Social</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {[
            { view: 'feed' as SidebarView, icon: <Home size={16} />, label: 'Feed' },
            { view: 'communities' as SidebarView, icon: <Users size={16} />, label: 'My Communities' },
            { view: 'trending' as SidebarView, icon: <TrendingUp size={16} />, label: 'Trending' },
            { view: 'people' as SidebarView, icon: <Users size={16} />, label: 'People' },
          ].map((item) => (
            <button
              key={item.view}
              onClick={() => { setSidebarView(item.view); setSelectedCommunity(null); }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                sidebarView === item.view && !selectedCommunity ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--cx-text-1)] hover:bg-cx-bg'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-[var(--cx-border-1)]">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[10px] font-semibold text-[var(--cx-text-2)] uppercase tracking-wider">Communities</span>
              <button onClick={() => setShowCreateCommunity(true)} className="text-[var(--cx-text-2)] hover:text-accent-blue">
                <Plus size={12} />
              </button>
            </div>
            {communities.filter((c) => c.joined).map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedCommunity(c); setSidebarView('community-detail'); }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors',
                  selectedCommunity?.id === c.id ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--cx-text-1)] hover:bg-cx-bg'
                )}
              >
                <Hash size={12} className="shrink-0" />
                <span className="truncate">{c.name}</span>
                {c.isPrivate && <Lock size={10} className="shrink-0 text-[var(--cx-text-2)]" />}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Feed / Community Detail */}
        {(sidebarView === 'feed' || sidebarView === 'community-detail') && (
          <div className="max-w-2xl mx-auto p-6">
            {/* Community Header */}
            {selectedCommunity && (
              <div className="mb-6 bg-cx-surface border border-[var(--cx-border-1)] rounded-xl overflow-hidden">
                <div className="h-28 bg-gradient-to-r from-accent-blue/20 to-purple-600/20 flex items-end p-4">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--cx-text-1)]">{selectedCommunity.name}</h2>
                    <p className="text-xs text-[var(--cx-text-2)] mt-0.5">{selectedCommunity.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border-t border-[var(--cx-border-1)]">
                  <span className="text-xs text-[var(--cx-text-2)]">{selectedCommunity.memberCount} members</span>
                  <button
                    onClick={() => handleToggleCommunity(selectedCommunity.id)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                      selectedCommunity.joined
                        ? 'bg-cx-bg text-[var(--cx-text-2)] hover:text-cx-danger'
                        : 'bg-accent-blue text-white hover:bg-accent-blue/90'
                    )}
                  >
                    {selectedCommunity.joined ? <><UserMinus size={12} /> Leave</> : <><UserPlus size={12} /> Join</>}
                  </button>
                </div>
              </div>
            )}

            {/* Create Post */}
            <button
              onClick={() => setShowCreatePost(true)}
              className="w-full bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 mb-4 flex items-center gap-3 hover:border-accent-blue/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-cx-bg flex items-center justify-center">
                <span className="text-xs text-[var(--cx-text-2)] font-medium">Y</span>
              </div>
              <span className="text-sm text-[var(--cx-text-2)]">Share something with your community...</span>
            </button>

            {/* Create Post Modal */}
            {showCreatePost && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                <div className="bg-cx-surface border border-[var(--cx-border-1)] rounded-2xl p-5 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">Create Post</h2>
                    <button onClick={() => setShowCreatePost(false)} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Post type selector */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {POST_TYPE_CONFIG.map((pt) => (
                      <button
                        key={pt.type}
                        onClick={() => setNewPostType(pt.type)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors',
                          newPostType === pt.type ? pt.color : 'text-[var(--cx-text-2)] bg-cx-bg hover:bg-cx-bg/80'
                        )}
                      >
                        {pt.icon} {pt.label}
                      </button>
                    ))}
                  </div>

                  {/* Community picker */}
                  <select
                    value={newPostCommunity}
                    onChange={(e) => setNewPostCommunity(e.target.value)}
                    className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none mb-3"
                  >
                    <option value="">Select community...</option>
                    {communities.filter((c) => c.joined).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {/* Praise recipient */}
                  {newPostType === 'praise' && (
                    <input
                      value={newPraiseRecipient}
                      onChange={(e) => setNewPraiseRecipient(e.target.value)}
                      placeholder="Who are you praising?"
                      className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none mb-3"
                    />
                  )}

                  <textarea
                    autoFocus
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="What do you want to share?"
                    rows={4}
                    className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none resize-none mb-3"
                  />

                  {/* Poll options */}
                  {newPostType === 'poll' && (
                    <div className="space-y-2 mb-3">
                      <label className="text-xs text-[var(--cx-text-2)]">Poll Options</label>
                      {newPollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const next = [...newPollOptions];
                              next[i] = e.target.value;
                              setNewPollOptions(next);
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none"
                          />
                          {newPollOptions.length > 2 && (
                            <button
                              onClick={() => setNewPollOptions(newPollOptions.filter((_, j) => j !== i))}
                              className="text-[var(--cx-text-2)] hover:text-cx-danger"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setNewPollOptions([...newPollOptions, ''])}
                        className="text-xs text-accent-blue hover:text-accent-blue/80"
                      >
                        + Add option
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button className="flex items-center gap-1 text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] text-sm">
                      <Image size={16} /> Photo
                    </button>
                    <button
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim() || !newPostCommunity}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        newPostContent.trim() && newPostCommunity
                          ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                          : 'bg-cx-bg text-[var(--cx-text-2)] cursor-not-allowed'
                      )}
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Posts */}
            {sortedPosts.map(renderPost)}

            {sortedPosts.length === 0 && (
              <div className="text-center py-16">
                <MessageCircle size={32} className="text-[var(--cx-text-2)]/20 mx-auto mb-2" />
                <p className="text-[var(--cx-text-2)] text-sm">No posts yet. Be the first to share something!</p>
              </div>
            )}
          </div>
        )}

        {/* Communities View */}
        {sidebarView === 'communities' && !selectedCommunity && (
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">All Communities</h2>
              <button
                onClick={() => setShowCreateCommunity(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
              >
                <Plus size={14} /> Create
              </button>
            </div>

            {/* Create Community Modal */}
            {showCreateCommunity && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                <div className="bg-cx-surface border border-[var(--cx-border-1)] rounded-2xl p-5 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">Create Community</h2>
                    <button onClick={() => setShowCreateCommunity(false)} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
                      <X size={18} />
                    </button>
                  </div>
                  <input
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    placeholder="Community name"
                    className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none mb-3"
                  />
                  <textarea
                    value={newCommunityDesc}
                    onChange={(e) => setNewCommunityDesc(e.target.value)}
                    placeholder="Description"
                    rows={3}
                    className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none resize-none mb-3"
                  />
                  <button
                    onClick={handleCreateCommunity}
                    disabled={!newCommunityName.trim()}
                    className="w-full py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 text-sm font-medium disabled:opacity-50"
                  >
                    Create Community
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {communities.map((c) => (
                <div key={c.id} className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                    <Hash size={20} className="text-accent-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[var(--cx-text-1)] font-medium">{c.name}</h3>
                      {c.isPrivate && <Lock size={12} className="text-[var(--cx-text-2)]" />}
                    </div>
                    <p className="text-xs text-[var(--cx-text-2)] truncate">{c.description}</p>
                    <span className="text-[10px] text-[var(--cx-text-2)]">{c.memberCount} members</span>
                  </div>
                  <button
                    onClick={() => handleToggleCommunity(c.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0',
                      c.joined ? 'bg-cx-bg text-[var(--cx-text-2)] hover:text-cx-danger' : 'bg-accent-blue text-white hover:bg-accent-blue/90'
                    )}
                  >
                    {c.joined ? 'Leave' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending View */}
        {sidebarView === 'trending' && (
          <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-lg font-semibold text-[var(--cx-text-1)] mb-6">Trending</h2>
            <div className="space-y-2">
              {trending.map((t, i) => (
                <div key={t.tag} className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 flex items-center gap-4">
                  <span className="text-lg font-bold text-[var(--cx-text-2)]/30 w-8 text-center">{i + 1}</span>
                  <div className="flex-1">
                    <h3 className="text-[var(--cx-text-1)] font-medium">{t.tag}</h3>
                    <span className="text-xs text-[var(--cx-text-2)]">{t.postCount} posts</span>
                  </div>
                  <TrendingUp size={16} className="text-accent-blue shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* People View */}
        {sidebarView === 'people' && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">People Directory</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-2)]" />
                <input
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                  placeholder="Search people..."
                  className="bg-cx-surface border border-[var(--cx-border-1)] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none w-64"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredPeople.map((person) => (
                <div key={person.id} className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-cx-bg flex items-center justify-center mb-3">
                    <span className="text-lg text-[var(--cx-text-2)] font-medium">{person.name.charAt(0)}</span>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--cx-text-1)]">{person.name}</h3>
                  <p className="text-xs text-[var(--cx-text-2)] mt-0.5">{person.role}</p>
                  <span className="text-[10px] text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full mt-2">
                    {person.department}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
