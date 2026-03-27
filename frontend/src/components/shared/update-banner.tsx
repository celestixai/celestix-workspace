import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UpdateBanner() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron?.()) return;

    api.onUpdateAvailable?.((version: string) => {
      setUpdateVersion(version);
    });

    api.onUpdateDownloaded?.((version: string) => {
      setUpdateVersion(version);
      setDownloaded(true);
    });
  }, []);

  if (!updateVersion || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-accent-blue text-white px-4 py-2 flex items-center justify-center gap-3 text-sm shadow-lg">
      <Download size={16} />
      <span>
        {downloaded
          ? `Update v${updateVersion} ready — restart to apply`
          : `Downloading update v${updateVersion}...`}
      </span>
      {downloaded && (
        <Button
          size="sm"
          variant="ghost"
          className="text-white border-white/30 border hover:bg-white/20"
          onClick={() => (window as any).electronAPI?.installUpdate?.()}
        >
          Restart Now
        </Button>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notification"
        className="ml-2 p-1 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
