import { useState, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { Upload, FileText, ChevronRight, Check, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  onImportComplete?: () => void;
}

type Step = 'upload' | 'map' | 'preview' | 'import';

const TASK_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'assignee', label: 'Assignee (email)' },
  { key: 'tags', label: 'Tags' },
  { key: 'timeEstimate', label: 'Time Estimate (min)' },
];

interface PreviewData {
  columns: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
  preview: Array<Record<string, string>>;
}

interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function ImportWizard({ open, onClose, listId, onImportComplete }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setImporting(false);
    setResult(null);
    setError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data } = await api.post('/views/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const preview = data.data as PreviewData;
      setPreviewData(preview);
      setMapping(preview.suggestedMapping || {});
      setStep('map');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to parse CSV file');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
        handleFileSelect(droppedFile);
      } else {
        setError('Please drop a CSV file');
      }
    },
    [handleFileSelect],
  );

  const handleExecuteImport = useCallback(async () => {
    if (!previewData || !mapping.title) return;

    setImporting(true);
    setError(null);

    try {
      const { data } = await api.post('/views/import/execute', {
        listId,
        mapping,
        data: previewData.rows,
      });

      setResult(data.data as ImportResult);
      setStep('import');
      onImportComplete?.();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [previewData, mapping, listId, onImportComplete]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/views/import/template', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  };

  const stepIndicators: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map Columns' },
    { key: 'preview', label: 'Preview' },
    { key: 'import', label: 'Import' },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="Import Tasks" size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {stepIndicators.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-text-tertiary" />}
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                step === s.key
                  ? 'bg-accent-blue text-white'
                  : stepIndicators.findIndex((x) => x.key === step) > i
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-text-tertiary bg-bg-tertiary',
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Upload step */}
      {step === 'upload' && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-accent-blue bg-accent-blue/5'
                : 'border-border-secondary hover:border-text-tertiary',
            )}
          >
            <Upload size={32} className="mx-auto text-text-tertiary mb-3" />
            <p className="text-sm text-text-primary mb-1">
              Drop a CSV file here or click to browse
            </p>
            <p className="text-xs text-text-tertiary">Max file size: 10MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 text-xs text-accent-blue hover:underline"
            >
              <Download size={12} />
              Download CSV Template
            </button>
          </div>
        </div>
      )}

      {/* Map columns step */}
      {step === 'map' && previewData && (
        <div>
          <p className="text-xs text-text-secondary mb-4">
            Map your CSV columns to task fields. Detected {previewData.columns.length} columns
            and {previewData.rows.length} rows from <span className="font-medium">{file?.name}</span>.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {TASK_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="text-xs text-text-primary w-40 flex-shrink-0">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="flex-1 bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-xs text-text-primary"
                >
                  <option value="">-- Not mapped --</option>
                  {previewData.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-1.5 text-xs text-text-tertiary hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('preview')}
              disabled={!mapping.title}
              className={cn(
                'px-4 py-1.5 text-xs rounded-md transition-colors',
                mapping.title
                  ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                  : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed',
              )}
            >
              Next: Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && previewData && (
        <div>
          <p className="text-xs text-text-secondary mb-4">
            Preview of the first {Math.min(10, previewData.rows.length)} rows as they will be imported:
          </p>
          <div className="overflow-x-auto border border-border-secondary rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-tertiary">
                  <th className="px-3 py-2 text-left text-text-tertiary font-medium">#</th>
                  {TASK_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key} className="px-3 py-2 text-left text-text-tertiary font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-border-secondary">
                    <td className="px-3 py-1.5 text-text-tertiary">{i + 1}</td>
                    {TASK_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="px-3 py-1.5 text-text-primary max-w-[200px] truncate">
                        {row[mapping[f.key]] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.rows.length > 10 && (
            <p className="text-xs text-text-tertiary mt-2">
              ...and {previewData.rows.length - 10} more rows
            </p>
          )}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep('map')}
              className="px-4 py-1.5 text-xs text-text-tertiary hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={importing}
              className={cn(
                'px-4 py-1.5 text-xs rounded-md transition-colors',
                importing
                  ? 'bg-bg-tertiary text-text-tertiary cursor-wait'
                  : 'bg-accent-blue text-white hover:bg-accent-blue/80',
              )}
            >
              {importing ? 'Importing...' : `Import ${previewData.rows.length} Tasks`}
            </button>
          </div>
        </div>
      )}

      {/* Result step */}
      {step === 'import' && result && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Import Complete</h3>
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{result.created}</p>
              <p className="text-xs text-text-tertiary">Created</p>
            </div>
            {result.failed > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                <p className="text-xs text-text-tertiary">Failed</p>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="text-left mt-4 max-h-[200px] overflow-y-auto">
              <p className="text-xs text-text-secondary mb-2">Errors:</p>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1">
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleClose}
            className="mt-6 px-6 py-2 text-xs bg-accent-blue text-white rounded-md hover:bg-accent-blue/80 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
