import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { NavRail } from '@/components/layout/nav-rail';
import { TopBar } from '@/components/layout/top-bar';
import { Titlebar } from '@/components/layout/titlebar';
import { SearchPalette } from '@/components/layout/search-palette';
import { NotificationPanel } from '@/components/layout/notification-panel';
import { UpdateBanner } from '@/components/shared/update-banner';
import { LoginPage } from '@/modules/auth/login-page';
import { RegisterPage } from '@/modules/auth/register-page';
import { WelcomePage } from '@/modules/auth/welcome-page';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { usePresenceStore } from '@/stores/presence.store';
import { useNotificationStore } from '@/stores/notification.store';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load modules
const MessengerPage = lazy(() => import('@/modules/messenger/messenger-page').then((m) => ({ default: m.MessengerPage })));
const WorkspacePage = lazy(() => import('@/modules/workspace/workspace-page').then((m) => ({ default: m.WorkspacePage })));
const EmailPage = lazy(() => import('@/modules/email/email-page').then((m) => ({ default: m.EmailPage })));
const CalendarPage = lazy(() => import('@/modules/calendar/calendar-page').then((m) => ({ default: m.CalendarPage })));
const TasksPage = lazy(() => import('@/modules/tasks/tasks-page').then((m) => ({ default: m.TasksPage })));
const FilesPage = lazy(() => import('@/modules/files/files-page').then((m) => ({ default: m.FilesPage })));
const NotesPage = lazy(() => import('@/modules/notes/notes-page').then((m) => ({ default: m.NotesPage })));
const ContactsPage = lazy(() => import('@/modules/contacts/contacts-page').then((m) => ({ default: m.ContactsPage })));
const MeetingsPage = lazy(() => import('@/modules/meetings/meetings-page').then((m) => ({ default: m.MeetingsPage })));
const SettingsPage = lazy(() => import('@/modules/settings/settings-page').then((m) => ({ default: m.SettingsPage })));
const DashboardPage = lazy(() => import('@/modules/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })));
const FormsPage = lazy(() => import('@/modules/forms/forms-page').then((m) => ({ default: m.FormsPage })));
const ListsPage = lazy(() => import('@/modules/lists/lists-page').then((m) => ({ default: m.ListsPage })));
const BookingsPage = lazy(() => import('@/modules/bookings/bookings-page').then((m) => ({ default: m.BookingsPage })));
const LoopPage = lazy(() => import('@/modules/loop/loop-page').then((m) => ({ default: m.LoopPage })));
const WhiteboardPage = lazy(() => import('@/modules/whiteboard/whiteboard-page').then((m) => ({ default: m.WhiteboardPage })));
const StreamPage = lazy(() => import('@/modules/stream/stream-page').then((m) => ({ default: m.StreamPage })));
const WorkflowsPage = lazy(() => import('@/modules/workflows/workflows-page').then((m) => ({ default: m.WorkflowsPage })));

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-primary">
      <div className="space-y-4 w-64">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { activeModule } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const { setUserStatus, bulkSetOnline } = usePresenceStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!user) return;

    const socket = connectSocket();

    // Get initial online users
    socket.emit('presence:get-online', (users: Array<{ userId: string; status: string }>) => {
      bulkSetOnline(users);
    });

    // Listen for presence updates
    socket.on('presence:update', (data: { userId: string; status: string }) => {
      setUserStatus(data.userId, data.status);
    });

    // Listen for notifications
    socket.on('notification:new', (notification: { id: string; type: string; title: string; body?: string; isRead: boolean; sender?: { id: string; displayName: string; avatarUrl?: string }; createdAt: string }) => {
      addNotification(notification);
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.body });
      }
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      socket.emit('presence:heartbeat');
    }, 30000);

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      clearInterval(heartbeat);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setUserStatus, bulkSetOnline, addNotification]);

  // Fetch profile once on mount
  useEffect(() => {
    if (!user) return;
    api.get('/auth/me').then(({ data }) => {
      useAuthStore.getState().setUser(data.data);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moduleMap: Record<string, React.ReactNode> = {
    messenger: <MessengerPage />,
    workspace: <WorkspacePage />,
    email: <EmailPage />,
    calendar: <CalendarPage />,
    tasks: <TasksPage />,
    files: <FilesPage />,
    notes: <NotesPage />,
    contacts: <ContactsPage />,
    meetings: <MeetingsPage />,
    settings: <SettingsPage />,
    dashboard: <DashboardPage />,
    forms: <FormsPage />,
    lists: <ListsPage />,
    bookings: <BookingsPage />,
    loop: <LoopPage />,
    whiteboard: <WhiteboardPage />,
    stream: <StreamPage />,
    workflows: <WorkflowsPage />,
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Titlebar />
      <UpdateBanner />
      <div className="flex flex-1 min-h-0">
        <NavRail />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            <Suspense fallback={<LoadingFallback />}>
              {moduleMap[activeModule] || <MessengerPage />}
            </Suspense>
          </main>
        </div>
      </div>
      <SearchPalette />
      <NotificationPanel />
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Titlebar />
      {children}
    </div>
  );
}

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Routes>
      <Route path="/welcome" element={isAuthenticated ? <Navigate to="/" /> : <AuthLayout><WelcomePage /></AuthLayout>} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <AuthLayout><RegisterPage /></AuthLayout>} />
      <Route
        path="/*"
        element={isAuthenticated ? <AuthenticatedLayout /> : <Navigate to="/welcome" />}
      />
    </Routes>
  );
}
