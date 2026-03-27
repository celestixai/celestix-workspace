import { X } from 'lucide-react';
import { SHORTCUT_DEFINITIONS } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null;

  const categories = ['Navigation', 'Actions', 'Views'] as const;
  const grouped = categories
    .map((cat) => ({
      label: cat,
      shortcuts: SHORTCUT_DEFINITIONS.filter((s) => s.category === cat),
    }))
    .filter((g) => g.shortcuts.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border-primary rounded-xl shadow-lg overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <h2 className="text-base font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-5">
          {grouped.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-1">
                    <span className="text-sm text-text-secondary">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.split('+').map((part, i) => {
                        const trimmed = part.trim();
                        // Handle "G then X" style
                        if (trimmed.includes(' then ')) {
                          const [a, b] = trimmed.split(' then ');
                          return (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="bg-bg-tertiary text-text-primary text-[11px] px-1.5 py-0.5 rounded border border-border-secondary font-mono">
                                {a}
                              </kbd>
                              <span className="text-[10px] text-text-tertiary">then</span>
                              <kbd className="bg-bg-tertiary text-text-primary text-[11px] px-1.5 py-0.5 rounded border border-border-secondary font-mono">
                                {b}
                              </kbd>
                            </span>
                          );
                        }
                        return (
                          <kbd
                            key={i}
                            className="bg-bg-tertiary text-text-primary text-[11px] px-1.5 py-0.5 rounded border border-border-secondary font-mono"
                          >
                            {trimmed}
                          </kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-primary text-[10px] text-text-tertiary">
          Press <kbd className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-secondary">?</kbd> anywhere to toggle this dialog
        </div>
      </div>
    </div>
  );
}
