import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import { cn, formatMessageTime, formatFullDate } from '@/lib/utils';
import {
  Inbox,
  Star,
  Send,
  FileEdit,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  MoreHorizontal,
  Plus,
  Search,
  X,
  ChevronDown,
  ArrowLeft,
  Tag,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Email {
  id: string;
  from: { name: string; email: string; avatarUrl?: string };
  to: { name: string; email: string }[];
  cc?: { name: string; email: string }[];
  bcc?: { name: string; email: string }[];
  subject: string;
  body: string;
  preview: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: { id: string; name: string; size: number; type: string }[];
  labels?: string[];
  folder: string;
  sentAt: string;
  receivedAt: string;
}

type Folder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash';

interface FolderConfig {
  id: Folder;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

/* ------------------------------------------------------------------ */
/*  Email Page                                                         */
/* ------------------------------------------------------------------ */

export function EmailPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [activeFolder, setActiveFolder] = useState<Folder>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  /* -- Email accounts -- */
  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/email/accounts');
      return data.data as Array<{ id: string; email: string; displayName?: string; provider?: string; isDefault?: boolean }>;
    },
  });

  /* -- Queries -- */

  const folderToApiParam = (f: Folder): Record<string, string | boolean> => {
    if (f === 'starred') return { isStarred: 'true' };
    const map: Record<string, string> = {
      inbox: 'INBOX', sent: 'SENT', drafts: 'DRAFTS', archive: 'ARCHIVE', trash: 'TRASH',
    };
    return { folder: map[f] || 'INBOX' };
  };

  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['emails', activeFolder],
    queryFn: async () => {
      const { data } = await api.get(`/email/emails`, { params: folderToApiParam(activeFolder) });
      // Transform API shape (fromAddress/fromName/toAddresses) to frontend Email shape
      return (data.data as any[]).map((e: any): Email => ({
        id: e.id,
        from: { name: e.fromName || '', email: e.fromAddress || '', avatarUrl: undefined },
        to: (e.toAddresses || []).map((a: any) => ({ name: a.name || a.address, email: a.address })),
        cc: (e.ccAddresses || []).map((a: any) => ({ name: a.name || a.address, email: a.address })),
        bcc: (e.bccAddresses || []).map((a: any) => ({ name: a.name || a.address, email: a.address })),
        subject: e.subject || '(no subject)',
        body: e.bodyHtml || e.bodyText || '',
        preview: e.bodyText?.slice(0, 120) || '',
        isRead: e.isRead ?? false,
        isStarred: e.isStarred ?? false,
        hasAttachments: Array.isArray(e.attachments) && e.attachments.length > 0,
        attachments: e.attachments || [],
        labels: e.labels || [],
        folder: e.folder || 'INBOX',
        sentAt: e.createdAt,
        receivedAt: e.createdAt,
      }));
    },
  });

  const { data: counts = {} as Record<Folder, number> } = useQuery({
    queryKey: ['email-counts'],
    queryFn: async () => {
      const { data } = await api.get('/email/folders/counts');
      const raw = data.data as Record<string, number>;
      return {
        inbox: raw.INBOX || 0,
        starred: raw.STARRED || 0,
        sent: raw.SENT || 0,
        drafts: raw.DRAFTS || 0,
        archive: raw.ARCHIVE || 0,
        trash: raw.TRASH || 0,
      } as Record<Folder, number>;
    },
  });

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const q = searchQuery.toLowerCase();
    return emails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.name.toLowerCase().includes(q) ||
        e.from.email.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
    );
  }, [emails, searchQuery]);

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  /* -- Mutations -- */

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/email/emails/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      await api.patch(`/email/emails/${id}/star`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails'] }),
  });

  const moveEmail = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      const folderMap: Record<string, string> = {
        inbox: 'INBOX', sent: 'SENT', drafts: 'DRAFTS',
        archive: 'ARCHIVE', trash: 'TRASH',
      };
      await api.patch(`/email/emails/${id}/move/${folderMap[folder] || folder}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
      setSelectedEmailId(null);
      toast('Email moved', 'success');
    },
    onError: () => toast('Failed to move email', 'error'),
  });

  const sendEmail = useMutation({
    mutationFn: async (payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
    }) => {
      await api.post('/email/emails/send', {
        to: payload.to.map((addr) => ({ address: addr })),
        cc: payload.cc?.map((addr) => ({ address: addr })),
        bcc: payload.bcc?.map((addr) => ({ address: addr })),
        subject: payload.subject,
        bodyText: payload.body,
        bodyHtml: `<p>${payload.body.replace(/\n/g, '<br/>')}</p>`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
      setShowCompose(false);
      toast('Email sent', 'success');
    },
    onError: () => toast('Failed to send email', 'error'),
  });

  const handleSelectEmail = (email: Email) => {
    setSelectedEmailId(email.id);
    if (!email.isRead) {
      markAsRead.mutate(email.id);
    }
  };

  /* -- Folder config -- */

  const folders: FolderConfig[] = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} />, count: counts.inbox },
    { id: 'starred', label: 'Starred', icon: <Star size={16} />, count: counts.starred },
    { id: 'sent', label: 'Sent', icon: <Send size={16} /> },
    { id: 'drafts', label: 'Drafts', icon: <FileEdit size={16} />, count: counts.drafts },
    { id: 'archive', label: 'Archive', icon: <Archive size={16} /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 size={16} /> },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Folder Sidebar ===== */}
      <aside className="w-[200px] flex-shrink-0 bg-[#0C0C0E] border-r border-[rgba(255,255,255,0.08)] flex flex-col">
        <div className="p-3 flex-shrink-0 space-y-2">
          <Button className="w-full" onClick={() => setShowCompose(true)}>
            <Plus size={16} />
            Compose
          </Button>

          {/* Account switcher */}
          {emailAccounts.length > 0 && (
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
              className="w-full px-2 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-xs text-[rgba(255,255,255,0.65)] focus:outline-none focus:border-[#2563EB] truncate"
            >
              <option value="">All Accounts</option>
              {emailAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.email}</option>
              ))}
            </select>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => {
                setActiveFolder(folder.id);
                setSelectedEmailId(null);
              }}
              className={cn(
                'w-full flex items-center gap-3 rounded-md text-sm transition-colors',
                'px-[12px] py-[9px]',
                activeFolder === folder.id
                  ? 'bg-[rgba(255,255,255,0.08)] text-white font-medium'
                  : 'text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]'
              )}
            >
              {folder.icon}
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.count != null && folder.count > 0 && (
                <span className="text-[12px] font-mono font-medium text-[rgba(255,255,255,0.40)]">{folder.count}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Labels section */}
        <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] flex-shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[rgba(255,255,255,0.40)] mb-2">Labels</p>
          <div className="space-y-1">
            {['Work', 'Personal', 'Important'].map((label) => (
              <button
                key={label}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)] transition-colors"
              >
                <Tag size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ===== Email List ===== */}
      <div className="w-[350px] flex-shrink-0 border-r border-[rgba(255,255,255,0.08)] flex flex-col bg-[#09090B]">
        {/* List header */}
        <div className="h-12 flex items-center gap-2 px-3 border-b border-[var(--cx-border-1)] flex-shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cx-text-3)]" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:outline-none focus:border-accent-blue"
            />
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['emails'] })}
            aria-label="Refresh emails"
            className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue flex-shrink-0"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {emailsLoading ? (
            <EmailListSkeleton />
          ) : filteredEmails.length === 0 ? (
            <EmptyState
              icon={<Mail size={40} />}
              title={searchQuery ? 'No results' : 'No emails'}
              description={searchQuery ? 'Try a different search term' : `Your ${activeFolder} is empty`}
              className="py-12"
            />
          ) : (
            <div className="divide-y divide-border-primary">
              {filteredEmails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  active={selectedEmailId === email.id}
                  onClick={() => handleSelectEmail(email)}
                  onToggleStar={() =>
                    toggleStar.mutate({ id: email.id, starred: !email.isStarred })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Reading Pane ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090B]">
        {selectedEmail ? (
          <ReadingPane
            email={selectedEmail}
            onArchive={() => moveEmail.mutate({ id: selectedEmail.id, folder: 'archive' })}
            onDelete={() => moveEmail.mutate({ id: selectedEmail.id, folder: 'trash' })}
            onReply={() => setShowCompose(true)}
            onBack={() => setSelectedEmailId(null)}
          />
        ) : (
          <EmptyState
            icon={<MailOpen size={48} />}
            title="Select an email"
            description="Choose an email from the list to read it here"
            className="flex-1"
          />
        )}
      </main>

      {/* ===== Compose Modal ===== */}
      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        onSend={(payload) => sendEmail.mutate(payload)}
        loading={sendEmail.isPending}
        replyTo={selectedEmail}
        accounts={emailAccounts}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmailListItem({
  email,
  active,
  onClick,
  onToggleStar,
}: {
  email: Email;
  active: boolean;
  onClick: () => void;
  onToggleStar: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex gap-3 px-3 h-[64px] items-center cursor-pointer transition-colors',
        active ? 'bg-[rgba(255,255,255,0.06)]' : 'hover:bg-[rgba(255,255,255,0.02)]',
        !email.isRead && 'bg-[rgba(255,255,255,0.03)]'
      )}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Avatar src={email.from.avatarUrl} name={email.from.name} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              'text-sm truncate flex-1',
              !email.isRead ? 'font-bold text-white' : 'text-[rgba(255,255,255,0.65)]'
            )}
          >
            {email.from.name}
          </span>
          <span className="text-[11px] text-[rgba(255,255,255,0.40)] flex-shrink-0">
            {formatMessageTime(email.receivedAt)}
          </span>
        </div>
        <p className={cn('text-[14px] truncate', !email.isRead ? 'font-medium text-white' : 'text-[rgba(255,255,255,0.65)]')}>
          {email.subject}
        </p>
        <p className="text-[12px] text-[rgba(255,255,255,0.40)] truncate mt-0.5">{email.preview}</p>
      </div>
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className={cn(
            'p-0.5 rounded transition-colors',
            email.isStarred ? 'text-accent-amber' : 'text-[var(--cx-text-3)] hover:text-accent-amber opacity-0 group-hover:opacity-100'
          )}
        >
          <Star size={14} fill={email.isStarred ? 'currentColor' : 'none'} />
        </button>
        {email.hasAttachments && <Paperclip size={12} className="text-[var(--cx-text-3)]" />}
        {!email.isRead && (
          <span className="h-2 w-2 rounded-full bg-accent-blue" />
        )}
      </div>
    </div>
  );
}

function ReadingPane({
  email,
  onArchive,
  onDelete,
  onReply,
  onBack,
}: {
  email: Email;
  onArchive: () => void;
  onDelete: () => void;
  onReply: () => void;
  onBack: () => void;
}) {
  return (
    <>
      {/* Toolbar */}
      <div className="h-12 flex items-center gap-1 px-4 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="Back"
          className="p-2 rounded-lg text-[rgba(255,255,255,0.40)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-colors lg:hidden focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onReply}
          aria-label="Reply"
          className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <Reply size={16} />
        </button>
        <button aria-label="Reply all" className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
          <ReplyAll size={16} />
        </button>
        <button aria-label="Forward" className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
          <Forward size={16} />
        </button>
        <div className="w-px h-5 bg-border-primary mx-1" />
        <button
          onClick={onArchive}
          aria-label="Archive"
          className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <Archive size={16} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-accent-red hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <Trash2 size={16} />
        </button>
        <button aria-label="More options" className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-[18px] font-semibold text-white mb-4">{email.subject}</h1>

        <div className="flex items-start gap-3 mb-6">
          <Avatar src={email.from.avatarUrl} name={email.from.name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-white">{email.from.name}</span>
              <span className="text-xs text-[rgba(255,255,255,0.40)]">&lt;{email.from.email}&gt;</span>
            </div>
            <div className="text-[13px] text-[rgba(255,255,255,0.65)] mt-0.5">
              To: {email.to.map((r) => r.name || r.email).join(', ')}
              {email.cc && email.cc.length > 0 && (
                <> | CC: {email.cc.map((r) => r.name || r.email).join(', ')}</>
              )}
            </div>
            <div className="text-xs text-[var(--cx-text-3)]">{formatFullDate(email.receivedAt)}</div>
          </div>
        </div>

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 p-3 bg-cx-surface rounded-lg border border-[var(--cx-border-1)]">
            {email.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 bg-cx-raised rounded-lg border border-[var(--cx-border-1)] hover:border-accent-blue cursor-pointer transition-colors"
              >
                <Paperclip size={14} className="text-[var(--cx-text-3)]" />
                <span className="text-sm text-[var(--cx-text-1)]">{att.name}</span>
                <span className="text-xs text-[var(--cx-text-3)]">
                  ({Math.round(att.size / 1024)}KB)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div
          className="prose prose-sm max-w-none text-[14px] text-[rgba(255,255,255,0.95)] [&_a]:text-[#2563EB] overflow-x-auto [&_img]:max-w-full [&_table]:max-w-full"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>

      {/* Quick reply */}
      <div className="px-6 pb-4 flex-shrink-0">
        <button
          onClick={onReply}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-cx-raised border border-[var(--cx-border-2)] text-sm text-[var(--cx-text-3)] hover:border-accent-blue hover:text-[var(--cx-text-2)] transition-colors"
        >
          <Reply size={16} />
          Click to reply...
        </button>
      </div>
    </>
  );
}

function ComposeModal({
  open,
  onClose,
  onSend,
  loading,
  replyTo,
  accounts = [],
}: {
  open: boolean;
  onClose: () => void;
  onSend: (payload: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; accountId?: string }) => void;
  loading: boolean;
  replyTo?: Email | null;
  accounts?: Array<{ id: string; email: string }>;
}) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);

  const handleSend = () => {
    if (!to.trim() || !subject.trim()) {
      toast('To and Subject are required', 'error');
      return;
    }
    onSend({
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      subject,
      body,
      accountId: fromAccountId || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Message" size="lg">
      <div className="space-y-3">
        {/* From selector */}
        {accounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(255,255,255,0.40)]">From</label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-white focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Default account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.email}</option>
              ))}
            </select>
          </div>
        )}
        {accounts.length === 0 && (
          <p className="text-xs text-accent-amber bg-accent-amber/10 px-3 py-2 rounded-lg">
            No email account connected. Go to Settings → Email Accounts to add one.
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              label="To"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {!showCcBcc && (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-accent-blue hover:underline mt-6"
            >
              CC/BCC
            </button>
          )}
        </div>

        {showCcBcc && (
          <>
            <Input
              label="CC"
              placeholder="cc@example.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
            <Input
              label="BCC"
              placeholder="bcc@example.com"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
            />
          </>
        )}

        <Input
          label="Subject"
          placeholder="Email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--cx-text-2)]">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            rows={10}
            className="w-full px-3 py-2 rounded-lg bg-cx-raised border border-[var(--cx-border-2)] text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:outline-none focus:border-accent-blue resize-y"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <button aria-label="Attach file" className="p-2 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
              <Paperclip size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Discard</Button>
            <Button onClick={handleSend} loading={loading}>
              <Send size={14} />
              Send
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EmailListSkeleton() {
  return (
    <div className="divide-y divide-border-primary">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
