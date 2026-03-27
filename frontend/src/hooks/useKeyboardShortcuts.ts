import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/stores/ui.store';

type ShortcutAction = () => void;

interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: ShortcutAction;
  description: string;
  category: 'Navigation' | 'Actions' | 'Views';
}

// Two-key "g then X" navigation combo state
let gPending = false;
let gTimer: ReturnType<typeof setTimeout> | null = null;

export const SHORTCUT_DEFINITIONS: Array<{
  keys: string;
  description: string;
  category: 'Navigation' | 'Actions' | 'Views';
}> = [
  { keys: 'Ctrl+K', description: 'Open search', category: 'Actions' },
  { keys: 'Ctrl+J', description: 'Open AI Brain', category: 'Actions' },
  { keys: 'Ctrl+N', description: 'New task (quick create)', category: 'Actions' },
  { keys: 'Alt+R', description: 'New reminder', category: 'Actions' },
  { keys: '?', description: 'Show keyboard shortcuts', category: 'Actions' },
  { keys: 'Escape', description: 'Close any open modal/panel', category: 'Actions' },
  { keys: 'G then I', description: 'Go to Inbox', category: 'Navigation' },
  { keys: 'G then T', description: 'Go to Tasks/Spaces', category: 'Navigation' },
  { keys: 'G then M', description: 'Go to Messenger', category: 'Navigation' },
  { keys: 'G then C', description: 'Go to Calendar', category: 'Navigation' },
  { keys: 'G then G', description: 'Go to Goals', category: 'Navigation' },
  { keys: 'G then D', description: 'Go to Dashboards', category: 'Navigation' },
];

interface UseKeyboardShortcutsOptions {
  onNewTask?: () => void;
  onNewReminder?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { setActiveModule, setSearchOpen, setNotificationPanelOpen, searchOpen, notificationPanelOpen } = useUIStore();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Ctrl/Cmd + N — New task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        optionsRef.current.onNewTask?.();
        return;
      }

      // Alt + R — New reminder
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        optionsRef.current.onNewReminder?.();
        return;
      }

      // Escape — Close any modal/panel
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (notificationPanelOpen) {
          setNotificationPanelOpen(false);
          return;
        }
        // Also fire the callback so modals in App can close
        return;
      }

      // Skip single-key shortcuts when input is focused
      if (isInputFocused) return;

      // ? — Show shortcuts modal
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        optionsRef.current.onShowShortcuts?.();
        return;
      }

      // G-then-X two-key combos
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!gPending) {
          gPending = true;
          if (gTimer) clearTimeout(gTimer);
          gTimer = setTimeout(() => {
            gPending = false;
          }, 800);
          return;
        }
      }

      if (gPending) {
        gPending = false;
        if (gTimer) clearTimeout(gTimer);
        const navMap: Record<string, string> = {
          i: 'inbox',
          t: 'spaces',
          m: 'messenger',
          c: 'calendar',
          g: 'goals',
          d: 'dashboards',
        };
        const mod = navMap[e.key];
        if (mod) {
          e.preventDefault();
          setActiveModule(mod as any);
          return;
        }
      }
    },
    [searchOpen, notificationPanelOpen, setActiveModule, setSearchOpen, setNotificationPanelOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
