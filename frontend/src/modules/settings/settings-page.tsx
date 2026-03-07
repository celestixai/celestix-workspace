import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  User,
  Shield,
  Palette,
  Bell,
  Lock,
  Mail,
  Camera,
  Check,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  LogOut,
  Key,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Session {
  id: string;
  device?: string;
  deviceInfo?: string;
  browser?: string;
  ip?: string;
  ipAddress?: string;
  location?: string;
  lastActive?: string;
  createdAt: string;
  isCurrent?: boolean;
}

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  isDefault: boolean;
  syncEnabled: boolean;
  lastSynced?: string;
}

type SettingsSection = 'profile' | 'account' | 'appearance' | 'notifications' | 'privacy' | 'email-accounts';

/* ------------------------------------------------------------------ */
/*  Settings Page                                                      */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'account', label: 'Account', icon: <Shield size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'privacy', label: 'Privacy', icon: <Lock size={16} /> },
    { id: 'email-accounts', label: 'Email Accounts', icon: <Mail size={16} /> },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Sidebar ===== */}
      <aside className="w-[220px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        <div className="h-12 flex items-center px-4 border-b border-border-primary flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">Settings</span>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                activeSection === section.id
                  ? 'bg-bg-active text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-border-primary text-[10px] text-text-tertiary flex-shrink-0">
          Celestix Workspace v1.0.0
        </div>
      </aside>

      {/* ===== Content ===== */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'account' && <AccountSection />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'privacy' && <PrivacySection />}
          {activeSection === 'email-accounts' && <EmailAccountsSection />}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Section                                                    */
/* ------------------------------------------------------------------ */

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const updateProfile = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch('/auth/profile', payload);
      return data.data;
    },
    onSuccess: (data) => {
      updateUserStore(data);
      toast('Profile updated', 'success');
    },
    onError: () => toast('Failed to update profile', 'error'),
  });

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUserStore({ avatarUrl: data.data.avatarUrl });
      toast('Avatar updated', 'success');
    } catch {
      toast('Failed to upload avatar', 'error');
    }
  };

  const handleSave = () => {
    updateProfile.mutate({ displayName: displayName.trim(), firstName: firstName.trim(), lastName: lastName.trim(), bio: bio.trim(), phone: phone.trim() });
  };

  return (
    <div>
      <SectionHeader title="Profile" description="Manage your personal information" />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          <Avatar src={user?.avatarUrl} name={user?.displayName || 'User'} size="xl" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Upload avatar"
          >
            <Camera size={20} className="text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{user?.displayName}</p>
          <p className="text-xs text-text-tertiary">{user?.email}</p>
          <button onClick={() => fileInputRef.current?.click()} className="text-xs text-accent-blue hover:underline mt-1">
            Change avatar
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>
        <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={updateProfile.isPending}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Section                                                    */
/* ------------------------------------------------------------------ */

function AccountSection() {
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get('/auth/sessions');
      return data.data as Session[];
    },
  });

  const changePassword = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      await api.post('/auth/change-password', payload);
    },
    onSuccess: () => {
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed', 'success');
    },
    onError: () => toast('Failed to change password', 'error'),
  });

  const revokeSession = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast('Session revoked', 'success');
    },
    onError: () => toast('Failed to revoke session', 'error'),
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) { toast('Passwords do not match', 'error'); return; }
    if (newPassword.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div>
      <SectionHeader title="Account" description="Manage your account security and sessions" />

      <SettingsCard title="Email" description={user?.email || ''}>
        <span className="text-xs text-accent-emerald flex items-center gap-1"><Check size={12} /> Verified</span>
      </SettingsCard>

      <SettingsCard title="Password" description="Change your account password">
        {!showChangePassword ? (
          <Button variant="secondary" size="sm" onClick={() => setShowChangePassword(true)}>Change Password</Button>
        ) : (
          <div className="space-y-3 w-full mt-2">
            <div className="relative">
              <Input label="Current Password" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-[34px] text-text-tertiary focus-visible:outline-2 focus-visible:outline-accent-blue rounded-lg" aria-label={showCurrent ? 'Hide password' : 'Show password'}>
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="relative">
              <Input label="New Password" type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-[34px] text-text-tertiary focus-visible:outline-2 focus-visible:outline-accent-blue rounded-lg" aria-label={showNew ? 'Hide password' : 'Show password'}>
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowChangePassword(false)}>Cancel</Button>
              <Button size="sm" onClick={handleChangePassword} loading={changePassword.isPending}>Update Password</Button>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Two-Factor Authentication" description={user?.is2FAEnabled ? 'Enabled' : 'Add an extra layer of security'}>
        <Button
          variant={user?.is2FAEnabled ? 'danger' : 'secondary'}
          size="sm"
          onClick={async () => {
            try {
              if (user?.is2FAEnabled) {
                await api.post('/auth/2fa/disable');
                updateUserStore({ is2FAEnabled: false });
                toast('Two-factor authentication disabled', 'success');
              } else {
                await api.post('/auth/2fa/enable');
                updateUserStore({ is2FAEnabled: true });
                toast('Two-factor authentication enabled', 'success');
              }
            } catch {
              toast('Failed to update 2FA settings', 'error');
            }
          }}
        >
          <Key size={14} /> {user?.is2FAEnabled ? 'Disable' : 'Enable'}
        </Button>
      </SettingsCard>

      {/* Sessions */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Active Sessions</h3>
        {sessionsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-tertiary">No active sessions</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border-primary">
                <div className="text-text-tertiary flex-shrink-0">
                  {(session.device || session.deviceInfo || '').toLowerCase().includes('mobile') ? <Smartphone size={20} /> : <Monitor size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {session.browser ? `${session.browser} on ${session.device}` : session.deviceInfo || 'Unknown device'}
                    {session.isCurrent && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-lg bg-accent-emerald/10 text-accent-emerald font-medium">Current</span>
                    )}
                  </p>
                  <p className="text-xs text-text-tertiary truncate">
                    {session.ip || session.ipAddress}
                    {session.location && ` - ${session.location}`}
                    {' '}| {formatRelativeTime(session.lastActive || session.createdAt)}
                  </p>
                </div>
                {!session.isCurrent && (
                  <button onClick={() => revokeSession.mutate(session.id)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-accent-red transition-colors flex-shrink-0" aria-label="Revoke session">
                    <LogOut size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-8 p-4 rounded-lg border border-accent-red/30 bg-accent-red/5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-accent-red" />
          <h3 className="text-sm font-semibold text-accent-red">Danger Zone</h3>
        </div>
        <p className="text-xs text-text-secondary mb-3">Once you delete your account, there is no going back.</p>

        {!showDeleteConfirm ? (
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Delete Account
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              await api.post('/auth/logout').catch(() => {});
              logout();
              window.location.href = '/login';
            }}>
              <LogOut size={14} /> Sign Out
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-3 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
            <p className="text-sm text-text-primary">
              Type <strong className="text-accent-red">DELETE</strong> to confirm account deletion:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirmText !== 'DELETE'}
                onClick={async () => {
                  try {
                    await api.delete('/auth/account');
                    logout();
                    window.location.href = '/login';
                  } catch {
                    toast('Failed to delete account', 'error');
                  }
                }}
              >
                <Trash2 size={14} /> Permanently Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Appearance Section                                                 */
/* ------------------------------------------------------------------ */

function AppearanceSection() {
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateUser);
  const { theme, setTheme } = useUIStore();

  const [fontSize, setFontSize] = useState(user?.fontSize || 14);
  const [accentColor, setAccentColor] = useState(user?.accentColor || '#4F8EF7');

  const updateAppearance = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch('/auth/profile', payload);
      return data.data;
    },
    onSuccess: (data) => {
      updateUserStore(data);
      toast('Appearance updated', 'success');
    },
    onError: () => toast('Failed to update appearance', 'error'),
  });

  const themes = [
    { id: 'dark' as const, label: 'Dark', icon: <Moon size={20} /> },
    { id: 'light' as const, label: 'Light', icon: <Sun size={20} /> },
    { id: 'system' as const, label: 'System', icon: <Monitor size={20} /> },
  ];

  const accentColors = [
    { name: 'Blue', value: '#4F8EF7' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Indigo', value: '#6366F1' },
  ];

  return (
    <div>
      <SectionHeader title="Appearance" description="Customize the look and feel" />

      <div className="mb-6">
        <label className="text-sm font-medium text-text-secondary mb-3 block">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); updateAppearance.mutate({ theme: t.id }); }}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                theme === t.id
                  ? 'border-accent-blue bg-accent-blue/5 shadow-glow'
                  : 'border-border-primary hover:border-border-secondary bg-bg-secondary'
              )}
            >
              <span className={cn('text-text-primary', theme === t.id && 'text-accent-blue')}>{t.icon}</span>
              <span className={cn('text-sm', theme === t.id ? 'text-accent-blue font-medium' : 'text-text-secondary')}>{t.label}</span>
              {theme === t.id && <Check size={14} className="text-accent-blue" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-text-secondary mb-3 block">Accent Color</label>
        <div className="flex items-center gap-3 flex-wrap">
          {accentColors.map((c) => (
            <button
              key={c.value}
              onClick={() => { setAccentColor(c.value); updateAppearance.mutate({ accentColor: c.value }); }}
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110',
                accentColor === c.value && 'ring-2 ring-offset-2 ring-offset-bg-primary scale-110'
              )}
              style={{ backgroundColor: c.value } as React.CSSProperties}
              title={c.name}
              aria-label={`Select ${c.name} accent color`}
            >
              {accentColor === c.value && <Check size={16} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-text-secondary mb-3 block">Font Size: {fontSize}px</label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">12</span>
          <input
            type="range"
            min={12}
            max={18}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            onMouseUp={() => updateAppearance.mutate({ fontSize })}
            className="flex-1 accent-accent-blue"
          />
          <span className="text-xs text-text-tertiary">18</span>
        </div>
        <p className="text-sm text-text-secondary mt-2" style={{ fontSize }}>Preview text at {fontSize}px</p>
      </div>

      <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary">
        <div className="min-w-0 flex-1 mr-4">
          <p className="text-sm font-medium text-text-primary truncate">Compact Mode</p>
          <p className="text-xs text-text-tertiary truncate">Reduce spacing and padding throughout the app</p>
        </div>
        <ToggleSwitch
          enabled={user?.compactMode || false}
          onChange={(enabled) => updateAppearance.mutate({ compactMode: enabled })}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications Section                                              */
/* ------------------------------------------------------------------ */

const NOTIF_STORAGE_KEY = 'celestix-notification-prefs';

interface NotifPrefs {
  notifyMessages: boolean;
  notifyEmails: boolean;
  notifyTasks: boolean;
  notifyCalendar: boolean;
  notifyMeetings: boolean;
  notifyFiles: boolean;
  sound: boolean;
  desktop: boolean;
}

const defaultNotifPrefs: NotifPrefs = {
  notifyMessages: true,
  notifyEmails: true,
  notifyTasks: true,
  notifyCalendar: true,
  notifyMeetings: true,
  notifyFiles: true,
  sound: true,
  desktop: true,
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? { ...defaultNotifPrefs, ...JSON.parse(raw) } : { ...defaultNotifPrefs };
  } catch { return { ...defaultNotifPrefs }; }
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
      toast(`${key === 'sound' ? 'Sound' : key === 'desktop' ? 'Desktop notifications' : key.replace('notify', '')} ${next[key] ? 'enabled' : 'disabled'}`, 'success');
      return next;
    });
  };

  const notificationSettings: { key: keyof NotifPrefs; label: string; description: string }[] = [
    { key: 'notifyMessages', label: 'Messages', description: 'New messages and mentions' },
    { key: 'notifyEmails', label: 'Emails', description: 'New incoming emails' },
    { key: 'notifyTasks', label: 'Tasks', description: 'Task assignments and updates' },
    { key: 'notifyCalendar', label: 'Calendar', description: 'Event reminders and invitations' },
    { key: 'notifyMeetings', label: 'Meetings', description: 'Meeting reminders and changes' },
    { key: 'notifyFiles', label: 'Files', description: 'File shares and comments' },
  ];

  const requestDesktopPermission = async () => {
    if (!('Notification' in window)) {
      toast('Your browser does not support desktop notifications', 'error');
      return;
    }
    if (Notification.permission === 'granted') {
      toggle('desktop');
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') toggle('desktop');
      else toast('Desktop notification permission denied', 'error');
    } else {
      toast('Desktop notifications are blocked by your browser. Enable them in browser settings.', 'error');
    }
  };

  return (
    <div>
      <SectionHeader title="Notifications" description="Choose what you want to be notified about" />
      <div className="space-y-3">
        {notificationSettings.map((setting) => (
          <div key={setting.key} className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-sm font-medium text-text-primary">{setting.label}</p>
              <p className="text-xs text-text-tertiary">{setting.description}</p>
            </div>
            <ToggleSwitch enabled={prefs[setting.key]} onChange={() => toggle(setting.key)} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Sound & Desktop</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-sm font-medium text-text-primary">Sound</p>
              <p className="text-xs text-text-tertiary">Play a sound for new notifications</p>
            </div>
            <ToggleSwitch enabled={prefs.sound} onChange={() => toggle('sound')} />
          </div>
          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-sm font-medium text-text-primary">Desktop Notifications</p>
              <p className="text-xs text-text-tertiary">Show desktop push notifications</p>
            </div>
            <ToggleSwitch enabled={prefs.desktop} onChange={requestDesktopPermission} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Privacy Section                                                    */
/* ------------------------------------------------------------------ */

function PrivacySection() {
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateUser);

  const updatePrivacy = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch('/auth/profile', payload);
      return data.data;
    },
    onSuccess: (data) => {
      updateUserStore(data);
      toast('Privacy settings updated', 'success');
    },
    onError: () => toast('Failed to update', 'error'),
  });

  const toggles = [
    { key: 'showOnlineStatus' as const, label: 'Online Status', description: 'Show when you are online' },
    { key: 'showReadReceipts' as const, label: 'Read Receipts', description: 'Let others know when you\'ve read their messages' },
    { key: 'showLastSeen' as const, label: 'Last Seen', description: 'Show when you were last active' },
  ];

  return (
    <div>
      <SectionHeader title="Privacy" description="Control your privacy settings" />
      <div className="space-y-3">
        {toggles.map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-sm font-medium text-text-primary truncate">{toggle.label}</p>
              <p className="text-xs text-text-tertiary truncate">{toggle.description}</p>
            </div>
            <ToggleSwitch
              enabled={user?.[toggle.key] ?? true}
              onChange={(enabled) => updatePrivacy.mutate({ [toggle.key]: enabled })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Email Accounts Section                                             */
/* ------------------------------------------------------------------ */

function EmailAccountsSection() {
  const queryClient = useQueryClient();
  const [showAddAccount, setShowAddAccount] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/email/accounts');
      return data.data as EmailAccount[];
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/email/accounts/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-accounts'] }); toast('Account removed', 'success'); },
    onError: () => toast('Failed to remove account', 'error'),
  });

  const syncAccount = useMutation({
    mutationFn: async (id: string) => { await api.post(`/email/accounts/${id}/sync`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-accounts'] }); toast('Sync started', 'info'); },
    onError: () => toast('Failed to sync', 'error'),
  });

  return (
    <div>
      <SectionHeader title="Email Accounts" description="Manage your connected email accounts" />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-8">
          <Mail size={40} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary mb-4">No email accounts connected</p>
          <Button onClick={() => setShowAddAccount(true)}><Plus size={14} /> Add Account</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 p-4 bg-bg-secondary rounded-lg border border-border-primary">
              <div className="h-10 w-10 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                <Mail size={18} className="text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{account.email}</p>
                  {account.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-accent-blue/10 text-accent-blue font-medium">Default</span>
                  )}
                </div>
                <p className="text-xs text-text-tertiary truncate">
                  {account.provider}
                  {account.lastSynced && ` | Last synced ${formatRelativeTime(account.lastSynced)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => syncAccount.mutate(account.id)} className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue" title="Sync now" aria-label="Sync now">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => removeAccount.mutate(account.id)} className="p-2 rounded-lg text-text-tertiary hover:text-accent-red hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue" title="Remove" aria-label="Remove account">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setShowAddAccount(true)} className="mt-3">
            <Plus size={14} /> Add Account
          </Button>
        </div>
      )}

      <AddEmailAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} />
    </div>
  );
}

function AddEmailAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const providers = [
    { name: 'Gmail', description: 'Connect your Google account' },
    { name: 'Outlook', description: 'Connect your Microsoft account' },
    { name: 'IMAP', description: 'Connect via IMAP/SMTP' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Add Email Account" size="sm">
      <div className="space-y-2">
        {providers.map((provider) => (
          <button
            key={provider.name}
            onClick={() => { toast('OAuth flow would start here', 'info'); onClose(); }}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-border-primary hover:border-accent-blue hover:bg-bg-hover transition-colors"
          >
            <Mail size={20} className="text-text-secondary" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-text-primary">{provider.name}</p>
              <p className="text-xs text-text-tertiary">{provider.description}</p>
            </div>
            <ChevronRight size={16} className="text-text-tertiary" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                  */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-text-primary">{title}</h2>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between p-4 bg-bg-secondary rounded-lg border border-border-primary mb-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-tertiary mt-0.5 truncate">{description}</p>
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ease-in-out flex-shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue',
        enabled ? 'bg-accent-blue' : 'bg-text-tertiary/30'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out',
          enabled ? 'translate-x-[22px] mt-0.5' : 'translate-x-0.5 mt-0.5'
        )}
      />
    </button>
  );
}
