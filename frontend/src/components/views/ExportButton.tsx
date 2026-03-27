import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ExportButtonProps {
  locationType: string;
  locationId: string;
  viewId?: string;
}

export function ExportButton({ locationType, locationId, viewId }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setOpen(false);
    try {
      const params = new URLSearchParams({
        locationType,
        locationId,
        format,
      });
      if (viewId) params.set('viewId', viewId);

      const response = await api.get(`/views/export?${params.toString()}`, {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={exporting}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
          'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
          exporting && 'opacity-50 cursor-wait',
        )}
        title="Export tasks"
      >
        <Download size={12} />
        {exporting ? 'Exporting...' : 'Export'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
