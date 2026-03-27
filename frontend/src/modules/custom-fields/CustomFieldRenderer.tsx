import React, { useState } from 'react';
import { Star, Link, Paperclip, GitBranch, ThumbsUp, Users, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStatus } from '@/hooks/useAI';
import { useRefreshAIField } from '@/hooks/useCustomFields';
import type { FieldDefinition, FieldOption } from '@/hooks/useCustomFields';

interface CustomFieldRendererProps {
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  compact?: boolean;
  taskId?: string;
}

export function CustomFieldRenderer({ field, value, onChange, compact, taskId }: CustomFieldRendererProps) {
  const { fieldType, config } = field;

  switch (fieldType) {
    case 'TEXT':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder="Enter text..."
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        />
      );

    case 'LONG_TEXT':
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder="Enter text..."
          rows={compact ? 2 : 3}
          className="w-full bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all resize-y"
        />
      );

    case 'NUMBER':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange({ valueNumber: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="0"
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs w-20' : 'h-9 px-3 w-32'
          )}
        />
      );

    case 'MONEY':
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-tertiary">{config?.currency ?? 'USD'}</span>
          <input
            type="number"
            step="0.01"
            value={value ?? ''}
            onChange={(e) => onChange({ valueNumber: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="0.00"
            className={cn(
              'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
              'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
              compact ? 'h-7 px-2 text-xs w-20' : 'h-9 px-3 w-32'
            )}
          />
        </div>
      );

    case 'DROPDOWN':
      return <DropdownEditor options={config?.options ?? []} value={value} onChange={onChange} compact={compact} />;

    case 'MULTI_SELECT':
    case 'LABEL':
      return <MultiSelectEditor options={config?.options ?? []} value={value} onChange={onChange} compact={compact} />;

    case 'DATE':
      return (
        <input
          type="date"
          value={value ? new Date(value).toISOString().split('T')[0] : ''}
          onChange={(e) => onChange({ valueDate: e.target.value || null })}
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        />
      );

    case 'CHECKBOX':
      return (
        <button
          onClick={() => onChange({ valueBoolean: !value })}
          className={cn(
            'flex items-center justify-center rounded-md border transition-colors',
            compact ? 'w-5 h-5' : 'w-6 h-6',
            value
              ? 'bg-accent-blue border-accent-blue text-white'
              : 'bg-bg-tertiary border-border-secondary text-transparent hover:border-border-primary'
          )}
        >
          {value && (
            <svg width={compact ? 10 : 12} height={compact ? 10 : 12} viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      );

    case 'EMAIL':
      return (
        <input
          type="email"
          value={value ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder="email@example.com"
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        />
      );

    case 'PHONE':
      return (
        <input
          type="tel"
          value={value ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder="+1 (555) 000-0000"
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        />
      );

    case 'URL':
      return (
        <div className="flex items-center gap-1">
          <Link size={compact ? 12 : 14} className="text-text-tertiary flex-shrink-0" />
          <input
            type="url"
            value={value ?? ''}
            onChange={(e) => onChange({ valueText: e.target.value })}
            placeholder="https://..."
            className={cn(
              'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary flex-1',
              'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
              compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
            )}
          />
        </div>
      );

    case 'RATING':
      return <RatingEditor value={value ?? 0} max={config?.max ?? 5} onChange={onChange} compact={compact} />;

    case 'PROGRESS':
      return <ProgressEditor value={value ?? 0} onChange={onChange} compact={compact} />;

    case 'FILE':
      return (
        <button className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary px-2 py-1.5 rounded-lg border border-dashed border-border-secondary hover:border-border-primary transition-colors">
          <Paperclip size={12} />
          Attach file
        </button>
      );

    case 'RELATIONSHIP':
      return (
        <button className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary px-2 py-1.5 rounded-lg border border-dashed border-border-secondary hover:border-border-primary transition-colors">
          <GitBranch size={12} />
          Link task
        </button>
      );

    case 'FORMULA':
    case 'ROLLUP':
      return (
        <span className="text-sm text-text-tertiary italic">
          {value != null ? String(value) : 'Calculated'}
        </span>
      );

    case 'LOCATION':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder="Enter address..."
          className={cn(
            'bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary',
            'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        />
      );

    case 'VOTING':
      return (
        <button
          onClick={() => onChange({ valueNumber: (value ?? 0) + 1 })}
          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-accent-blue px-2 py-1 rounded-lg border border-border-secondary hover:border-accent-blue/40 transition-colors"
        >
          <ThumbsUp size={12} />
          <span>{value ?? 0}</span>
        </button>
      );

    case 'PEOPLE':
      return (
        <button className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary px-2 py-1.5 rounded-lg border border-dashed border-border-secondary hover:border-border-primary transition-colors">
          <Users size={12} />
          Assign people
        </button>
      );

    case 'AI_SUMMARY':
    case 'AI_CUSTOM':
      return <AITextFieldRenderer value={value} taskId={taskId} fieldId={field.id} compact={compact} />;

    case 'AI_SENTIMENT':
      return <AISentimentFieldRenderer value={value} taskId={taskId} fieldId={field.id} compact={compact} />;

    default:
      return <span className="text-xs text-text-tertiary">Unsupported field type</span>;
  }
}

// ==========================================
// Sub-components
// ==========================================

function DropdownEditor({
  options,
  value,
  onChange,
  compact,
}: {
  options: FieldOption[];
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value || o.name === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm',
          'hover:border-border-primary transition-colors text-left w-full',
          compact ? 'h-7 px-2 text-xs' : 'h-9 px-3'
        )}
      >
        {selected ? (
          <span className="flex items-center gap-1.5">
            {selected.color && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
            )}
            <span className="text-text-primary">{selected.name}</span>
          </span>
        ) : (
          <span className="text-text-tertiary">Select...</span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-bg-secondary border border-border-primary rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange({ valueJson: opt.id });
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
            >
              {opt.color && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelectEditor({
  options,
  value,
  onChange,
  compact,
}: {
  options: FieldOption[];
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds: string[] = Array.isArray(value) ? value : [];

  const toggle = (optId: string) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((id) => id !== optId)
      : [...selectedIds, optId];
    onChange({ valueJson: next });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 flex-wrap bg-bg-tertiary border border-border-secondary rounded-lg text-sm min-h-[36px]',
          'hover:border-border-primary transition-colors text-left w-full',
          compact ? 'min-h-[28px] px-2 py-0.5' : 'px-3 py-1'
        )}
      >
        {selectedIds.length > 0 ? (
          selectedIds.map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: opt.color ? `${opt.color}20` : undefined,
                  color: opt.color || undefined,
                  border: `1px solid ${opt.color || 'var(--border-secondary)'}`,
                }}
              >
                {opt.name}
              </span>
            );
          })
        ) : (
          <span className="text-text-tertiary text-xs">Select...</span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-bg-secondary border border-border-primary rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
            >
              <span
                className={cn(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] flex-shrink-0',
                  selectedIds.includes(opt.id)
                    ? 'bg-accent-blue border-accent-blue text-white'
                    : 'border-border-secondary'
                )}
              >
                {selectedIds.includes(opt.id) && '✓'}
              </span>
              {opt.color && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingEditor({
  value,
  max,
  onChange,
  compact,
}: {
  value: number;
  max: number;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange({ valueNumber: i + 1 === value ? 0 : i + 1 })}
          className="p-0 transition-colors"
        >
          <Star
            size={compact ? 14 : 18}
            className={cn(
              'transition-colors',
              i < value ? 'text-yellow-400 fill-yellow-400' : 'text-text-tertiary'
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ProgressEditor({
  value,
  onChange,
  compact,
}: {
  value: number;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden border border-border-secondary">
        <div
          className="h-full bg-accent-blue rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange({ valueNumber: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
        className={cn(
          'bg-bg-tertiary border border-border-secondary rounded text-text-primary text-center',
          'hover:border-border-primary focus:border-accent-blue focus:outline-none transition-all',
          compact ? 'w-10 h-6 text-[10px]' : 'w-14 h-7 text-xs'
        )}
      />
      <span className="text-[10px] text-text-tertiary">%</span>
    </div>
  );
}

// ==========================================
// AI Field Sub-components
// ==========================================

function AITextFieldRenderer({
  value,
  taskId,
  fieldId,
  compact,
}: {
  value: any;
  taskId?: string;
  fieldId: string;
  compact?: boolean;
}) {
  const aiStatus = useAIStatus();
  const refreshAI = useRefreshAIField();
  const isOffline = aiStatus.data && !aiStatus.data.isAvailable;
  const isPending = !value || value === 'Pending AI';

  return (
    <div className="flex items-center gap-2 w-full">
      <Sparkles size={compact ? 10 : 12} className="text-purple-400 flex-shrink-0" />
      {isOffline ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
          AI Offline
        </span>
      ) : isPending ? (
        <span className={cn('text-text-tertiary italic', compact ? 'text-[10px]' : 'text-xs')}>
          Pending AI
        </span>
      ) : (
        <span className={cn('text-text-secondary truncate', compact ? 'text-[10px] max-w-[120px]' : 'text-xs max-w-[200px]')}>
          {String(value)}
        </span>
      )}
      {taskId && (
        <button
          onClick={() => refreshAI.mutate({ taskId, fieldId })}
          disabled={refreshAI.isPending || isOffline}
          className="flex-shrink-0 p-1 text-text-tertiary hover:text-accent-blue transition-colors disabled:opacity-40"
          title="Refresh AI"
        >
          <RefreshCw size={compact ? 10 : 12} className={cn(refreshAI.isPending && 'animate-spin')} />
        </button>
      )}
    </div>
  );
}

const SENTIMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Positive: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  Neutral: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  Negative: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  Urgent: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
};

function AISentimentFieldRenderer({
  value,
  taskId,
  fieldId,
  compact,
}: {
  value: any;
  taskId?: string;
  fieldId: string;
  compact?: boolean;
}) {
  const aiStatus = useAIStatus();
  const refreshAI = useRefreshAIField();
  const isOffline = aiStatus.data && !aiStatus.data.isAvailable;
  const isPending = !value || value === 'Pending AI';
  const sentiment = String(value || 'Neutral');
  const colors = SENTIMENT_COLORS[sentiment] ?? SENTIMENT_COLORS.Neutral;

  return (
    <div className="flex items-center gap-2">
      <Sparkles size={compact ? 10 : 12} className="text-purple-400 flex-shrink-0" />
      {isOffline ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
          AI Offline
        </span>
      ) : isPending ? (
        <span className={cn('text-text-tertiary italic', compact ? 'text-[10px]' : 'text-xs')}>
          Pending AI
        </span>
      ) : (
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border',
          colors.bg, colors.text, colors.border,
        )}>
          {sentiment}
        </span>
      )}
      {taskId && (
        <button
          onClick={() => refreshAI.mutate({ taskId, fieldId })}
          disabled={refreshAI.isPending || isOffline}
          className="flex-shrink-0 p-1 text-text-tertiary hover:text-accent-blue transition-colors disabled:opacity-40"
          title="Refresh AI"
        >
          <RefreshCw size={compact ? 10 : 12} className={cn(refreshAI.isPending && 'animate-spin')} />
        </button>
      )}
    </div>
  );
}
