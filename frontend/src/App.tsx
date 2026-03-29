import { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { NavRail } from '@/components/layout/nav-rail';
import { TopBar } from '@/components/layout/top-bar';
import { Titlebar } from '@/components/layout/titlebar';
import { SearchPalette } from '@/components/layout/search-palette';
import { NotificationPanel } from '@/components/layout/notification-panel';
import { UpdateBanner } from '@/components/shared/update-banner';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { LoginPage } from '@/modules/auth/login-page';
import { RegisterPage } from '@/modules/auth/register-page';
import { WelcomePage } from '@/modules/auth/welcome-page';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { usePresenceStore } from '@/stores/presence.store';
import { useNotificationStore } from '@/stores/notification.store';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { AICommandBar } from '@/modules/ai/AICommandBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from '@/components/shared/KeyboardShortcutsModal';
import { QuickTaskModal } from '@/components/shared/QuickTaskModal';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

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
const DocumentsPage = lazy(() => import('@/modules/documents/documents-page').then((m) => ({ default: m.DocumentsPage })));
const SpreadsheetsPage = lazy(() => import('@/modules/spreadsheets/spreadsheets-page').then((m) => ({ default: m.SpreadsheetsPage })));
const PresentationsPage = lazy(() => import('@/modules/presentations/presentations-page').then((m) => ({ default: m.PresentationsPage })));
const PdfPage = lazy(() => import('@/modules/pdf/pdf-page').then((m) => ({ default: m.PdfPage })));
const DiagramsPage = lazy(() => import('@/modules/diagrams/diagrams-page').then((m) => ({ default: m.DiagramsPage })));
const AnalyticsPage = lazy(() => import('@/modules/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage })));
const TodoPage = lazy(() => import('@/modules/todo/todo-page').then((m) => ({ default: m.TodoPage })));
const VideoEditorPage = lazy(() => import('@/modules/video-editor/video-editor-page').then((m) => ({ default: m.VideoEditorPage })));
const DesignerPage = lazy(() => import('@/modules/designer/designer-page').then((m) => ({ default: m.DesignerPage })));
const SitesPage = lazy(() => import('@/modules/sites/sites-page').then((m) => ({ default: m.SitesPage })));
const SocialPage = lazy(() => import('@/modules/social/social-page').then((m) => ({ default: m.SocialPage })));
const SpacesPage = lazy(() => import('@/modules/spaces/spaces-page').then((m) => ({ default: m.SpacesPage })));
const AutomationsPage = lazy(() => import('@/modules/automations/AutomationsPage').then((m) => ({ default: m.AutomationsPage })));
const GoalsPage = lazy(() => import('@/modules/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })));
const DashboardsPage = lazy(() => import('@/modules/dashboards/DashboardsPage').then((m) => ({ default: m.DashboardsPage })));
const InboxPage = lazy(() => import('@/modules/inbox/InboxPage').then((m) => ({ default: m.InboxPage })));
const PlannerPage = lazy(() => import('@/modules/planner/PlannerPage').then((m) => ({ default: m.PlannerPage })));
const ClipsPage = lazy(() => import('@/modules/clips/ClipsHub').then((m) => ({ default: m.ClipsHub })));
const SprintsPage = lazy(() => import('@/modules/sprints/SprintsPage').then((m) => ({ default: m.SprintsPage })));
const TimeReportPage = lazy(() => import('@/modules/time-tracking/TimeReportPage').then((m) => ({ default: m.TimeReportPage })));
const IntegrationsPage = lazy(() => import('@/modules/integrations/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })));
const PeoplePage = lazy(() => import('@/modules/teams/TeamsHubPage').then((m) => ({ default: m.TeamsHubPage })));

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { activeModule } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const { setUserStatus, bulkSetOnline } = usePresenceStore();
  const { addNotification } = useNotificationStore();
  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should show (only for truly new users)
  useEffect(() => {
    if (localStorage.getItem('onboarding-complete') === 'true') return;
    // Check if user already has workspaces — if so, skip onboarding
    const checkWorkspaces = async () => {
      try {
        const { data } = await (await import('@/lib/api')).api.get('/workspace');
        if (data?.data?.length > 0) {
          // User already has a workspace, mark onboarding complete
          localStorage.setItem('onboarding-complete', 'true');
          return;
        }
        setShowOnboarding(true);
      } catch {
        // If API fails, don't block the user with onboarding
        localStorage.setItem('onboarding-complete', 'true');
      }
    };
    checkWorkspaces();
  }, []);

  // Listen for onboarding completion
  useEffect(() => {
    const handler = () => setShowOnboarding(false);
    window.addEventListener('onboarding-done', handler);
    return () => window.removeEventListener('onboarding-done', handler);
  }, []);

  // Cmd+J / Ctrl+J opens AI command bar
  const handleAIShortcut = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      setAiCommandOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleAIShortcut);
    return () => window.removeEventListener('keydown', handleAIShortcut);
  }, [handleAIShortcut]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => setQuickTaskOpen(true),
    onNewReminder: () => {
      // Could open a reminder modal — stub for now
      console.log('New reminder shortcut triggered');
    },
    onShowShortcuts: () => setShortcutsOpen((prev) => !prev),
  });

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
    documents: <DocumentsPage />,
    spreadsheets: <SpreadsheetsPage />,
    presentations: <PresentationsPage />,
    pdf: <PdfPage />,
    diagrams: <DiagramsPage />,
    analytics: <AnalyticsPage />,
    todo: <TodoPage />,
    'video-editor': <VideoEditorPage />,
    designer: <DesignerPage />,
    sites: <SitesPage />,
    social: <SocialPage />,
    spaces: <SpacesPage />,
    automations: <AutomationsPage />,
    goals: <GoalsPage />,
    dashboards: <DashboardsPage />,
    inbox: <InboxPage />,
    planner: <PlannerPage />,
    clips: <ClipsPage />,
    sprints: <SprintsPage />,
    'time-reports': <TimeReportPage />,
    integrations: <IntegrationsPage />,
    people: <PeoplePage />,
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090B] overflow-hidden">
      <Titlebar />
      <UpdateBanner />
      <div className="flex flex-1 min-h-0">
        {/* NavRail: hidden on mobile, shown on md+ */}
        <div className="hidden md:block">
          <NavRail />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-hidden pb-14 md:pb-0">
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeModule}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    {moduleMap[activeModule] || <MessengerPage />}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      {/* Mobile bottom tab bar: shown on mobile only */}
      <BottomTabBar />
      <SearchPalette />
      <NotificationPanel />
      <AICommandBar open={aiCommandOpen} onClose={() => setAiCommandOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <QuickTaskModal open={quickTaskOpen} onClose={() => setQuickTaskOpen(false)} />
      {showOnboarding && <OnboardingWizard />}
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
