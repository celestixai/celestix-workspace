import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';
type ActiveModule = 'dashboard' | 'messenger' | 'workspace' | 'email' | 'calendar' | 'tasks' | 'files' | 'notes' | 'contacts' | 'meetings' | 'settings' | 'forms' | 'lists' | 'bookings' | 'loop' | 'whiteboard' | 'stream' | 'workflows' | 'documents' | 'spreadsheets' | 'presentations' | 'pdf' | 'diagrams' | 'analytics' | 'todo' | 'video-editor' | 'designer' | 'sites' | 'social';

export interface FileToOpen {
  fileId: string;
  fileName: string;
  mimeType: string;
  downloadUrl?: string;
}

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  notificationPanelOpen: boolean;
  activeModule: ActiveModule;
  fileToOpen: FileToOpen | null;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSearchOpen: (open: boolean) => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setActiveModule: (module: ActiveModule) => void;
  openFileInModule: (file: FileToOpen, module: ActiveModule) => void;
  clearFileToOpen: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      searchOpen: false,
      notificationPanelOpen: false,
      activeModule: 'messenger',
      fileToOpen: null,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setNotificationPanelOpen: (notificationPanelOpen) => set({ notificationPanelOpen }),
      setActiveModule: (activeModule) => set({ activeModule }),
      openFileInModule: (file, module) => set({ fileToOpen: file, activeModule: module }),
      clearFileToOpen: () => set({ fileToOpen: null }),
    }),
    {
      name: 'celestix-ui',
      partialize: (state) => ({ theme: state.theme, activeModule: state.activeModule }),
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
  } else if (theme === 'dark') {
    root.classList.remove('light');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
  }
}

// Apply theme on load
const savedTheme = (JSON.parse(localStorage.getItem('celestix-ui') || '{}')?.state?.theme || 'dark') as Theme;
applyTheme(savedTheme);
