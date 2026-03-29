import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import { cn, formatFullDate, formatRelativeTime } from '@/lib/utils';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  Plus,
  Calendar,
  Clock,
  Users,
  Copy,
  MessageSquare,
  ChevronRight,
  Camera,
  CameraOff,
  Shield,
  Link,
  Hand,
} from 'lucide-react';
import { format, isToday, isTomorrow, isAfter, parseISO, addHours } from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Meeting {
  id: string;
  title: string;
  description?: string;
  meetingCode: string;
  meetingUrl?: string;
  scheduledAt?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  status: string;
  isRecurring?: boolean;
  host: { id: string; displayName: string; avatarUrl?: string };
  hostId?: string;
  hostName?: string;
  hostAvatar?: string;
  participants: Array<{
    id?: string;
    userId?: string;
    displayName: string;
    avatarUrl?: string;
    role?: string;
    status?: string;
    user?: { id: string; displayName: string; avatarUrl?: string };
  }>;
  settings?: {
    muteOnEntry: boolean;
    videoOff: boolean;
    waitingRoom: boolean;
  };
  _count?: { chatMessages: number };
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Meetings Page                                                      */
/* ------------------------------------------------------------------ */

export function MeetingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [showJoinMeeting, setShowJoinMeeting] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [showLobby, setShowLobby] = useState(false);
  const [lobbyMeeting, setLobbyMeeting] = useState<Meeting | null>(null);

  /* -- Queries -- */

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data } = await api.get('/meetings');
      return data.data as Meeting[];
    },
  });

  /* -- Group meetings -- */

  const groupedMeetings = useMemo(() => {
    const now = new Date();
    const getStartDate = (m: Meeting) => {
      const dateStr = m.scheduledAt || m.startTime;
      return dateStr ? parseISO(dateStr) : new Date(m.createdAt);
    };

    const active = meetings.filter((m) => m.status === 'active' || m.status === 'LIVE');
    const scheduled = meetings.filter((m) => m.status === 'scheduled' || m.status === 'SCHEDULED');

    const todayMeetings = scheduled.filter((m) => isToday(getStartDate(m)));
    const tomorrowMeetings = scheduled.filter((m) => isTomorrow(getStartDate(m)));
    const laterMeetings = scheduled.filter(
      (m) => !isToday(getStartDate(m)) && !isTomorrow(getStartDate(m)) && isAfter(getStartDate(m), now)
    );
    const past = meetings
      .filter((m) => m.status === 'ended' || m.status === 'ENDED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return { active, today: todayMeetings, tomorrow: tomorrowMeetings, later: laterMeetings, past };
  }, [meetings]);

  /* -- Mutations -- */

  const createMeeting = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/meetings', payload);
      return data.data as Meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowCreateMeeting(false);
      toast('Meeting scheduled', 'success');
    },
    onError: () => toast('Failed to create meeting', 'error'),
  });

  const startInstantMeeting = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/meetings', { title: 'Instant Meeting' });
      return data.data as Meeting;
    },
    onSuccess: (meeting) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting started! Code: ' + meeting.meetingCode, 'success');
      setLobbyMeeting(meeting);
      setShowLobby(true);
    },
    onError: () => toast('Failed to start meeting', 'error'),
  });

  const joinMeeting = useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post(`/meetings/${code}/join`);
      return data.data as Meeting;
    },
    onSuccess: (meeting) => {
      setShowJoinMeeting(false);
      setLobbyMeeting(meeting);
      setShowLobby(true);
    },
    onError: () => toast('Invalid meeting code', 'error'),
  });

  const handleJoinFromCard = (meeting: Meeting) => {
    setLobbyMeeting(meeting);
    setShowLobby(true);
  };

  const handleEnterMeeting = () => {
    if (lobbyMeeting) {
      setActiveMeeting(lobbyMeeting);
      setShowLobby(false);
      setLobbyMeeting(null);
    }
  };

  const handleLeaveMeeting = () => {
    setActiveMeeting(null);
  };

  /* -- If in an active meeting, render that -- */

  if (activeMeeting) {
    return (
      <ActiveMeetingView
        meeting={activeMeeting}
        currentUserId={user?.id || ''}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Hero / Quick actions */}
        <div className="px-6 py-8 bg-gradient-to-br from-bg-secondary to-bg-primary border-b border-border-primary">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-display text-text-primary mb-1">Meetings</h1>
            <p className="text-sm text-text-secondary mb-6">
              Start, schedule, or join video meetings
            </p>

            <div className="flex items-center gap-3">
              <Button onClick={() => startInstantMeeting.mutate()} loading={startInstantMeeting.isPending}>
                <Video size={16} />
                New Meeting
              </Button>
              <Button variant="secondary" onClick={() => setShowJoinMeeting(true)}>
                <Phone size={16} />
                Join Meeting
              </Button>
              <Button variant="outline" onClick={() => setShowCreateMeeting(true)}>
                <Plus size={16} />
                Schedule
              </Button>
            </div>
          </div>
        </div>

        {/* Meeting lists */}
        <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-6">
          {meetingsLoading ? (
            <MeetingsSkeleton />
          ) : meetings.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No meetings"
              description="Start or schedule a meeting"
              actionLabel="New Meeting"
              onAction={() => startInstantMeeting.mutate()}
            />
          ) : (
            <>
              {/* Active meetings */}
              {groupedMeetings.active.length > 0 && (
                <MeetingSection title="Happening Now" badge={groupedMeetings.active.length}>
                  {groupedMeetings.active.map((m) => (
                    <MeetingCard key={m.id} meeting={m} onJoin={() => handleJoinFromCard(m)} live />
                  ))}
                </MeetingSection>
              )}

              {/* Today */}
              {groupedMeetings.today.length > 0 && (
                <MeetingSection title="Today">
                  {groupedMeetings.today.map((m) => (
                    <MeetingCard key={m.id} meeting={m} onJoin={() => handleJoinFromCard(m)} />
                  ))}
                </MeetingSection>
              )}

              {/* Tomorrow */}
              {groupedMeetings.tomorrow.length > 0 && (
                <MeetingSection title="Tomorrow">
                  {groupedMeetings.tomorrow.map((m) => (
                    <MeetingCard key={m.id} meeting={m} onJoin={() => handleJoinFromCard(m)} />
                  ))}
                </MeetingSection>
              )}

              {/* Later */}
              {groupedMeetings.later.length > 0 && (
                <MeetingSection title="Upcoming">
                  {groupedMeetings.later.map((m) => (
                    <MeetingCard key={m.id} meeting={m} onJoin={() => handleJoinFromCard(m)} />
                  ))}
                </MeetingSection>
              )}

              {/* Past */}
              {groupedMeetings.past.length > 0 && (
                <MeetingSection title="Recent" collapsed>
                  {groupedMeetings.past.map((m) => (
                    <MeetingCard key={m.id} meeting={m} past />
                  ))}
                </MeetingSection>
              )}
            </>
          )}
        </div>
      </main>

      {/* ===== Schedule Meeting Modal ===== */}
      <CreateMeetingModal
        open={showCreateMeeting}
        onClose={() => setShowCreateMeeting(false)}
        onCreate={(payload) => createMeeting.mutate(payload)}
        loading={createMeeting.isPending}
      />

      {/* ===== Join Meeting Modal ===== */}
      <JoinMeetingModal
        open={showJoinMeeting}
        onClose={() => setShowJoinMeeting(false)}
        onJoin={(code) => joinMeeting.mutate(code)}
        loading={joinMeeting.isPending}
      />

      {/* ===== Meeting Lobby ===== */}
      {showLobby && lobbyMeeting && (
        <MeetingLobby
          meeting={lobbyMeeting}
          onEnter={handleEnterMeeting}
          onCancel={() => { setShowLobby(false); setLobbyMeeting(null); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meeting Section                                                    */
/* ------------------------------------------------------------------ */

function MeetingSection({
  title,
  badge,
  collapsed: initialCollapsed = false,
  children,
}: {
  title: string;
  badge?: number;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 mb-3">
        <ChevronRight
          size={16}
          className={cn('text-text-tertiary transition-transform', !collapsed && 'rotate-90')}
        />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {badge != null && badge > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent-red text-white text-[10px] font-bold">
            {badge}
          </span>
        )}
      </button>
      {!collapsed && <div className="space-y-2">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meeting Card                                                       */
/* ------------------------------------------------------------------ */

function MeetingCard({
  meeting,
  onJoin,
  live,
  past,
}: {
  meeting: Meeting;
  onJoin?: () => void;
  live?: boolean;
  past?: boolean;
}) {
  const startDate = meeting.scheduledAt || meeting.startTime;
  const start = startDate ? parseISO(startDate) : null;

  const copyCode = () => {
    navigator.clipboard.writeText(meeting.meetingCode);
    toast('Meeting code copied', 'info');
  };

  const participantList = meeting.participants || [];
  const displayParticipants = participantList.map((p) => ({
    id: p.id || p.userId || p.user?.id || '',
    name: p.displayName || p.user?.displayName || 'User',
    avatar: p.avatarUrl || p.user?.avatarUrl,
  }));

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-colors',
        live
          ? 'bg-accent-blue/5 border-accent-blue/30'
          : past
            ? 'bg-bg-secondary/50 border-border-primary opacity-70'
            : 'bg-bg-secondary border-border-primary hover:border-border-secondary'
      )}
    >
      {/* Time */}
      <div className="w-16 text-center flex-shrink-0">
        {live ? (
          <div className="flex items-center gap-1.5 justify-center">
            <span className="h-2 w-2 rounded-full bg-accent-red animate-pulse" />
            <span className="text-xs font-bold text-accent-red">LIVE</span>
          </div>
        ) : start ? (
          <>
            <p className="text-sm font-semibold text-text-primary">{format(start, 'HH:mm')}</p>
            <p className="text-[10px] text-text-tertiary">{format(start, 'MMM d')}</p>
          </>
        ) : (
          <p className="text-xs text-text-tertiary">--</p>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary truncate">{meeting.title}</h3>
        <div className="flex items-center gap-3 mt-1">
          {start && (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Clock size={10} />
              {format(start, 'h:mm a')}
              {meeting.durationMinutes && ` (${meeting.durationMinutes}m)`}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <Users size={10} />
            {participantList.length}
          </span>
          <button
            onClick={copyCode}
            aria-label="Copy meeting code"
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent-blue transition-colors"
          >
            <Copy size={10} />
            {meeting.meetingCode}
          </button>
        </div>
      </div>

      {/* Participants preview */}
      <div className="flex -space-x-2 flex-shrink-0">
        {displayParticipants.slice(0, 4).map((p, i) => (
          <Avatar key={p.id || i} src={p.avatar} name={p.name} size="xs" />
        ))}
        {displayParticipants.length > 4 && (
          <span className="h-6 w-6 rounded-full bg-bg-tertiary text-[10px] text-text-tertiary flex items-center justify-center border border-border-primary">
            +{displayParticipants.length - 4}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!past && onJoin && (
          <Button size="sm" onClick={onJoin}>
            {live ? 'Join Now' : 'Join'}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meeting Lobby                                                      */
/* ------------------------------------------------------------------ */

function MeetingLobby({
  meeting,
  onEnter,
  onCancel,
}: {
  meeting: Meeting;
  onEnter: () => void;
  onCancel: () => void;
}) {
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => setCameraOn(false));
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraOn]);

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex items-center justify-center">
      <div className="max-w-2xl w-full mx-4">
        <h2 className="text-xl font-bold text-text-primary text-center mb-2">Ready to join?</h2>
        <p className="text-sm text-text-secondary text-center mb-6">{meeting.title}</p>

        <div className="relative w-full aspect-video bg-bg-tertiary rounded-2xl overflow-hidden mb-6 border border-border-primary">
          {cameraOn ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CameraOff size={48} className="text-text-tertiary" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setMicOn(!micOn)}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              micOn ? 'bg-bg-tertiary text-text-primary hover:bg-bg-active' : 'bg-accent-red text-white'
            )}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={() => setCameraOn(!cameraOn)}
            aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              cameraOn ? 'bg-bg-tertiary text-text-primary hover:bg-bg-active' : 'bg-accent-red text-white'
            )}
          >
            {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>
        </div>

        <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-tertiary">Meeting Code</p>
              <p className="text-sm font-mono text-text-primary">{meeting.meetingCode}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Users size={12} />
              {(meeting.participants || []).length} invited
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="lg" onClick={onCancel}>Cancel</Button>
          <Button size="lg" onClick={onEnter}>
            <Video size={16} /> Join Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active Meeting View                                                */
/* ------------------------------------------------------------------ */

function ActiveMeetingView({
  meeting,
  currentUserId,
  onLeave,
}: {
  meeting: Meeting;
  currentUserId: string;
  onLeave: () => void;
}) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const displayParticipants = [
    { id: '0', name: 'You', avatarUrl: undefined as string | undefined },
    ...(meeting.participants || []).map((p) => ({
      id: p.id || p.userId || p.user?.id || '',
      name: p.displayName || p.user?.displayName || 'User',
      avatarUrl: p.avatarUrl || p.user?.avatarUrl,
    })).filter((p) => p.id !== currentUserId).slice(0, 8),
  ];

  const gridCols = displayParticipants.length <= 1 ? 1 : displayParticipants.length <= 4 ? 2 : 3;

  return (
    <div className="flex h-full bg-[#09090B]">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-3">
          <div
            className="h-full grid gap-2"
            style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridAutoRows: '1fr' }}
          >
            {displayParticipants.map((p, i) => (
              <div key={p.id || i} className="relative bg-bg-tertiary rounded-xl overflow-hidden flex items-center justify-center">
                <Avatar src={p.avatarUrl} name={p.name} size="xl" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                  <span className="text-xs text-white font-medium">{p.name}</span>
                  {i === 0 && <span className="text-[10px] text-text-tertiary">(You)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-16 flex items-center justify-center gap-2 px-4 flex-shrink-0">
          <button
            onClick={() => setMicOn(!micOn)}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={cn('h-10 w-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue', micOn ? 'bg-bg-tertiary text-white hover:bg-bg-active' : 'bg-accent-red text-white')}
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button
            onClick={() => setCameraOn(!cameraOn)}
            aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            className={cn('h-10 w-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue', cameraOn ? 'bg-bg-tertiary text-white hover:bg-bg-active' : 'bg-accent-red text-white')}
          >
            {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button
            onClick={() => setScreenSharing(!screenSharing)}
            aria-label={screenSharing ? 'Stop screen sharing' : 'Share screen'}
            className={cn('h-10 w-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue', screenSharing ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-white hover:bg-bg-active')}
          >
            <Monitor size={18} />
          </button>

          <div className="w-px h-6 bg-border-secondary mx-2" />

          <button
            onClick={() => { setShowChat(!showChat); setShowParticipants(false); }}
            aria-label={showChat ? 'Close chat' : 'Open chat'}
            className={cn('h-10 w-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue', showChat ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-white hover:bg-bg-active')}
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
            aria-label={showParticipants ? 'Close participants' : 'Show participants'}
            className={cn('h-10 w-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue', showParticipants ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-white hover:bg-bg-active')}
          >
            <Users size={18} />
          </button>

          <div className="w-px h-6 bg-border-secondary mx-2" />

          <button
            onClick={onLeave}
            className="h-10 px-5 rounded-full bg-accent-red text-white hover:bg-red-600 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <PhoneOff size={16} /> Leave
          </button>
        </div>
      </div>

      {(showChat || showParticipants) && (
        <div className="w-[320px] bg-bg-secondary border-l border-border-primary flex flex-col flex-shrink-0">
          <div className="h-12 flex items-center px-4 border-b border-border-primary">
            <span className="text-sm font-semibold text-text-primary">
              {showChat ? 'Chat' : 'Participants'}
            </span>
            <span className="text-xs text-text-tertiary ml-2">({(meeting.participants || []).length})</span>
          </div>

          {showParticipants && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {displayParticipants.map((p, i) => (
                <div key={p.id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg min-w-0">
                  <Avatar src={p.avatarUrl} name={p.name} size="sm" className="flex-shrink-0" />
                  <p className="text-sm text-text-primary truncate flex-1 min-w-0">{p.name}</p>
                </div>
              ))}
            </div>
          )}

          {showChat && (
            <>
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-sm text-text-tertiary text-center py-8">No messages yet</p>
              </div>
              <div className="p-3 border-t border-border-primary">
                <input
                  type="text"
                  placeholder="Send a message..."
                  className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modals                                                             */
/* ------------------------------------------------------------------ */

function CreateMeetingModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('60');

  const handleCreate = () => {
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      durationMinutes: parseInt(duration),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule Meeting" size="md">
      <div className="space-y-4">
        <Input label="Title" placeholder="Team standup" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Description" placeholder="Meeting agenda (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date & Time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <Input label="Duration (minutes)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!title.trim()}>
            Schedule Meeting
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function JoinMeetingModal({
  open,
  onClose,
  onJoin,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
  loading: boolean;
}) {
  const [code, setCode] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Join Meeting" size="sm">
      <div className="space-y-4">
        <Input
          label="Meeting Code"
          placeholder="Enter meeting code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          icon={<Link size={14} />}
          onKeyDown={(e) => e.key === 'Enter' && code.trim() && onJoin(code.trim())}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onJoin(code.trim())} loading={loading} disabled={!code.trim()}>
            Join
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function MeetingsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-24" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
