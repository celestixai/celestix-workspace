import { Star, CheckCircle, Circle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDefinition, FieldOption } from '@/hooks/useCustomFields';

interface CustomFieldValueProps {
  field: FieldDefinition;
  value: any;
}

export function CustomFieldValue({ field, value }: CustomFieldValueProps) {
  const { fieldType, config } = field;

  if (value == null && fieldType !== 'CHECKBOX') {
    return <span className="text-[10px] text-text-tertiary">--</span>;
  }

  switch (fieldType) {
    case 'DROPDOWN': {
      const options: FieldOption[] = config?.options ?? [];
      const selected = options.find((o) => o.id === value || o.name === value);
      if (!selected) return <span className="text-[10px] text-text-tertiary">--</span>;
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: selected.color ? `${selected.color}20` : undefined,
            color: selected.color || undefined,
            border: `1px solid ${selected.color || 'var(--border-secondary)'}`,
          }}
        >
          {selected.color && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selected.color }} />
          )}
          {selected.name}
        </span>
      );
    }

    case 'MULTI_SELECT':
    case 'LABEL': {
      const options: FieldOption[] = config?.options ?? [];
      const selectedIds: string[] = Array.isArray(value) ? value : [];
      if (selectedIds.length === 0) return <span className="text-[10px] text-text-tertiary">--</span>;
      return (
        <div className="flex items-center gap-0.5 flex-wrap">
          {selectedIds.slice(0, 3).map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: opt.color ? `${opt.color}20` : undefined,
                  color: opt.color || undefined,
                  border: `1px solid ${opt.color || 'var(--border-secondary)'}`,
                }}
              >
                {opt.name}
              </span>
            );
          })}
          {selectedIds.length > 3 && (
            <span className="text-[10px] text-text-tertiary">+{selectedIds.length - 3}</span>
          )}
        </div>
      );
    }

    case 'PROGRESS': {
      const pct = typeof value === 'number' ? Math.min(100, Math.max(0, value)) : 0;
      return (
        <div className="flex items-center gap-1.5 min-w-[60px]">
          <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-text-tertiary">{pct}%</span>
        </div>
      );
    }

    case 'RATING': {
      const max = config?.max ?? 5;
      const rating = typeof value === 'number' ? value : 0;
      return (
        <div className="flex items-center gap-px">
          {Array.from({ length: max }, (_, i) => (
            <Star
              key={i}
              size={10}
              className={cn(
                i < rating ? 'text-cx-warning fill-yellow-400' : 'text-text-tertiary'
              )}
            />
          ))}
        </div>
      );
    }

    case 'CHECKBOX':
      return value ? (
        <CheckCircle size={14} className="text-accent-blue" />
      ) : (
        <Circle size={14} className="text-text-tertiary" />
      );

    case 'DATE': {
      if (!value) return <span className="text-[10px] text-text-tertiary">--</span>;
      try {
        const d = new Date(value);
        return (
          <span className="text-[10px] text-text-secondary">
            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        );
      } catch {
        return <span className="text-[10px] text-text-secondary">{String(value)}</span>;
      }
    }

    case 'MONEY': {
      const currency = config?.currency ?? 'USD';
      const symbols: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5' };
      const sym = symbols[currency] ?? currency + ' ';
      const num = typeof value === 'number' ? value : 0;
      return (
        <span className="text-[10px] text-text-secondary font-mono">
          {sym}{num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }

    case 'NUMBER':
      return (
        <span className="text-[10px] text-text-secondary font-mono">
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      );

    case 'PEOPLE':
      return (
        <div className="flex items-center -space-x-1">
          {(Array.isArray(value) ? value.slice(0, 3) : []).map((p: any, i: number) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full bg-accent-blue/20 border border-bg-primary flex items-center justify-center text-[8px] text-accent-blue font-medium"
            >
              {typeof p === 'string' ? p.charAt(0).toUpperCase() : '?'}
            </div>
          ))}
        </div>
      );

    case 'AI_SUMMARY':
    case 'AI_CUSTOM': {
      const isPending = !value || value === 'Pending AI';
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary truncate max-w-[120px]">
          <Sparkles size={8} className="text-purple-400 flex-shrink-0" />
          <span className={cn(isPending && 'text-text-tertiary italic')}>
            {isPending ? 'Pending AI' : String(value)}
          </span>
        </span>
      );
    }

    case 'AI_SENTIMENT': {
      const sentimentVal = String(value || 'Neutral');
      const isPendingSentiment = !value || value === 'Pending AI';
      const sentColors: Record<string, string> = {
        Positive: 'bg-cx-success/10 text-cx-success border-cx-success/20',
        Neutral: 'bg-[var(--cx-text-3)]/10 text-[var(--cx-text-2)] border-[var(--cx-text-3)]/20',
        Negative: 'bg-cx-danger/10 text-cx-danger border-cx-danger/20',
        Urgent: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      };
      if (isPendingSentiment) {
        return <span className="text-[10px] text-text-tertiary italic">Pending AI</span>;
      }
      return (
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border',
          sentColors[sentimentVal] ?? sentColors.Neutral,
        )}>
          {sentimentVal}
        </span>
      );
    }

    case 'EMAIL':
    case 'URL':
    case 'PHONE':
    case 'TEXT':
    case 'LONG_TEXT':
    case 'LOCATION':
    default:
      return (
        <span className="text-[10px] text-text-secondary truncate max-w-[120px] inline-block">
          {String(value)}
        </span>
      );
  }
}
