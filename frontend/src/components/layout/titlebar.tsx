import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import logoIcon from '@/assets/logo-icon-blue.png';

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron?.()) return;

    const onMaxChange = (isMax: boolean) => setMaximized(isMax);
    api.onMaximizeChange?.(onMaxChange);
  }, []);

  const isElectron = !!(window as any).electronAPI?.isElectron?.();
  if (!isElectron) return null;

  const api = (window as any).electronAPI;

  return (
    <div
      className="h-8 bg-bg-secondary flex items-center select-none flex-shrink-0 border-b border-border-primary"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App icon + title */}
      <div className="flex items-center gap-2 px-3">
        <img src={logoIcon} alt="" className="w-4 h-4 object-contain" />
        <span className="text-[11px] text-text-tertiary font-medium">Celestix Workspace</span>
      </div>

      <div className="flex-1" />

      {/* Window controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => api.minimizeWindow?.()}
          className="h-full w-11 flex items-center justify-center text-text-tertiary hover:bg-white/5 hover:text-text-secondary transition-colors"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => api.maximizeWindow?.()}
          className="h-full w-11 flex items-center justify-center text-text-tertiary hover:bg-white/5 hover:text-text-secondary transition-colors"
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => api.closeWindow?.()}
          className="h-full w-11 flex items-center justify-center text-text-tertiary hover:bg-red-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
