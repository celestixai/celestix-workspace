import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Users, Hash, MessageSquare, ArrowRight, Check, Link2, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserResult {
  id: string;
  displayName: string;
  email: string;
  username?: string;
  avatarUrl?: string | null;
}

type ChatTypeOption = 'DIRECT' | 'GROUP' | 'CHANNEL';

interface CreateChatModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CreateChatModal({ open, onClose, onChatCreated }: CreateChatModalProps) {
  const queryClient = useQueryClient();

  /* ---- Step state ---- */
  const [step, setStep] = useState<'type' | 'users' | 'details'>('type');
  const [chatType, setChatType] = useState<ChatTypeOption>('DIRECT');
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  /* ---- Reset on close ---- */
  const handleClose = useCallback(() => {
    setStep('type');
    setChatType('DIRECT');
    setSelectedUsers([]);
    setUserSearch('');
    setGroupName('');
    setGroupDescription('');
    onClose();
  }, [onClose]);

  /* ---- Search users ---- */
  const { data: users, isLoading: usersLoading } = useQuery<UserResult[]>({
    queryKey: ['messenger', 'users', userSearch],
    queryFn: async () => {
      const { data } = await api.get('/auth/users', {
        params: { search: userSearch },
      });
      return data.data;
    },
    enabled: step === 'users' && userSearch.length >= 1,
  });

  /* ---- Create chat mutation ---- */
  const createMutation = useMutation({
    mutationFn: async () => {
      // Auto-detect type: 1 person = DIRECT, multiple = GROUP
      const effectiveType: ChatTypeOption =
        chatType === 'DIRECT' || (chatType === 'GROUP' && selectedUsers.length === 1)
          ? 'DIRECT'
          : chatType;

      // For DMs, check if a conversation already exists with this person
      if (effectiveType === 'DIRECT' && selectedUsers.length === 1) {
        const existingChats = queryClient.getQueryData<any[]>(['messenger', 'chats']);
        const existingDM = existingChats?.find(
          (c) => (c.type === 'DM' || c.type === 'DIRECT') && c.dmUserId === selectedUsers[0].id,
        );
        if (existingDM) {
          return existingDM; // Return existing chat instead of creating a new one
        }
      }

      const payload: Record<string, unknown> = {
        type: effectiveType,
        memberIds: selectedUsers.map((u) => u.id),
      };
      if (effectiveType !== 'DIRECT') {
        payload.name = groupName || (selectedUsers.length > 0
          ? selectedUsers.map((u) => u.displayName.split(' ')[0]).join(', ')
          : 'Unnamed');
        if (groupDescription) payload.description = groupDescription;
      }
      const { data } = await api.post('/messenger/chats', payload);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
      toast(chatType === 'CHANNEL' ? 'Channel created' : 'Chat created', 'success');
      onChatCreated(data.id);
      handleClose();
    },
    onError: () => {
      toast('Failed to create chat', 'error');
    },
  });

  /* ---- Toggle user selection ---- */
  const toggleUser = useCallback(
    (user: UserResult) => {
      setSelectedUsers((prev) => {
        const exists = prev.find((u) => u.id === user.id);
        if (exists) return prev.filter((u) => u.id !== user.id);
        // DM = 1 user max
        if (chatType === 'DIRECT') return [user];
        return [...prev, user];
      });
    },
    [chatType],
  );

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  /* ---- Can proceed ---- */
  const canProceedFromUsers =
    chatType === 'DIRECT' ? selectedUsers.length === 1 : selectedUsers.length >= 1;

  const canCreate =
    chatType === 'DIRECT'
      ? selectedUsers.length === 1
      : chatType === 'CHANNEL'
        ? groupName.trim().length > 0
        : selectedUsers.length >= 1;

  /* ---- Chat type cards ---- */
  const typeOptions: { type: ChatTypeOption; icon: typeof MessageSquare; label: string; description: string }[] = [
    {
      type: 'DIRECT',
      icon: MessageSquare,
      label: 'Direct Message',
      description: 'Private conversation between two people',
    },
    {
      type: 'GROUP',
      icon: Users,
      label: 'Group Chat',
      description: 'Conversation with multiple people',
    },
    {
      type: 'CHANNEL',
      icon: Hash,
      label: 'Channel',
      description: 'Broadcast messages to a large audience',
    },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="New Conversation" size="md">
      {/* ---- Step 1: Choose type ---- */}
      {step === 'type' && (
        <div className="space-y-2">
          {typeOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => {
                setChatType(opt.type);
                // Channels go straight to details (members are optional)
                if (opt.type === 'CHANNEL') {
                  setStep('details');
                } else {
                  setStep('users');
                }
              }}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-lg border transition-all duration-150 ease-out text-left',
                'border-border-secondary hover:border-accent-blue/50 hover:bg-bg-hover',
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue flex-shrink-0">
                <opt.icon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{opt.label}</p>
                <p className="text-xs text-text-secondary">{opt.description}</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-text-tertiary" />
            </button>
          ))}
        </div>
      )}

      {/* ---- Step 2: Select users ---- */}
      {step === 'users' && (
        <div className="space-y-4">
          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-medium max-w-[200px]"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size="xs" className="flex-shrink-0" />
                  <span className="truncate">{user.displayName}</span>
                  <button
                    onClick={() => removeUser(user.id)}
                    aria-label={`Remove ${user.displayName}`}
                    className="hover:text-accent-red transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <Input
            placeholder="Search people..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            icon={<Search size={15} />}
            autoFocus
          />

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto space-y-0.5">
            {usersLoading && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {users?.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ease-out text-left',
                    isSelected
                      ? 'bg-accent-blue/10 border border-accent-blue/20'
                      : 'hover:bg-bg-hover border border-transparent',
                  )}
                >
                  <Avatar
                    src={user.avatarUrl}
                    name={user.displayName}
                    size="sm"
                    userId={user.id}
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{user.username ? `@${user.username}` : user.email}</p>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-accent-blue flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}

            {!usersLoading && userSearch.length >= 1 && users?.length === 0 && (
              <p className="text-center text-sm text-text-tertiary py-6">No users found</p>
            )}

            {!usersLoading && userSearch.length === 0 && (
              <p className="text-center text-sm text-text-tertiary py-6">
                Start typing to search for people
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border-primary">
            <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={!canProceedFromUsers}
              onClick={() => {
                if (chatType === 'DIRECT') {
                  createMutation.mutate();
                } else {
                  setStep('details');
                }
              }}
              loading={chatType === 'DIRECT' && createMutation.isPending}
            >
              {chatType === 'DIRECT' ? 'Start Chat' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Group/Channel details ---- */}
      {step === 'details' && (
        <div className="space-y-4">
          <Input
            label={chatType === 'CHANNEL' ? 'Channel Name' : 'Group Name'}
            placeholder={chatType === 'CHANNEL' ? 'e.g. announcements' : 'e.g. Design Team'}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Description (optional)
            </label>
            <textarea
              placeholder={chatType === 'CHANNEL' ? 'What is this channel about?' : 'What is this group about?'}
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={3}
              className={cn(
                'w-full resize-none rounded-lg bg-bg-tertiary border border-border-secondary px-3 py-2 text-sm text-text-primary',
                'placeholder:text-text-tertiary',
                'focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none',
                'transition-all duration-150 ease-out',
              )}
            />
          </div>

          {/* Channel info note */}
          {chatType === 'CHANNEL' && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-accent-blue/5 border border-accent-blue/10">
              <Link2 size={16} className="text-accent-blue flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-text-primary">Invite link will be generated</p>
                <p className="text-xs text-text-secondary">
                  You can share the invite link to let others join the channel. You can also add members manually later.
                </p>
              </div>
            </div>
          )}

          {/* Members preview (if any selected — for channels this may be empty) */}
          {selectedUsers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">
                Members ({selectedUsers.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-tertiary text-text-secondary text-xs"
                  >
                    <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
                    {user.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* For channels, option to add members now */}
          {chatType === 'CHANNEL' && selectedUsers.length === 0 && (
            <button
              onClick={() => setStep('users')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border-secondary text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue hover:bg-bg-hover transition-all text-sm"
            >
              <Users size={16} />
              Add members (optional)
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border-primary">
            <Button variant="ghost" size="sm" onClick={() => {
              if (chatType === 'CHANNEL' && selectedUsers.length === 0) {
                setStep('type');
              } else {
                setStep('users');
              }
            }}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
            >
              Create {chatType === 'CHANNEL' ? 'Channel' : 'Group'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
