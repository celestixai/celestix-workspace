import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStatus } from '@/hooks/useAI';

interface AIStatusBadgeProps {
  onClick: () => void;
}

export function AIStatusBadge({ onClick }: AIStatusBadgeProps) {
  const { data: status } = useAIStatus();
  const isAvailable = status?.isAvailable ?? false;

  return (
    <button
      onClick={onClick}
      aria-label={isAvailable ? 'AI Assistant' : 'AI Offline'}
      title={isAvailable ? 'AI Assistant' : 'AI Offline'}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
        isAvailable
          ? 'text-accent-purple hover:bg-bg-hover'
          : 'text-text-quaternary hover:bg-bg-hover',
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          isAvailable ? 'bg-accent-emerald' : 'bg-text-quaternary',
        )}
      />
      <Sparkles size={14} />
      <span className="hidden sm:inline font-medium">Brain</span>
    </button>
  );
}
