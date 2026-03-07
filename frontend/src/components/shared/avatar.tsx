import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { usePresenceStore } from '@/stores/presence.store';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  userId?: string;
  showStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusSizes = {
  xs: 'h-2 w-2 border',
  sm: 'h-2.5 w-2.5 border-[1.5px]',
  md: 'h-3 w-3 border-2',
  lg: 'h-3.5 w-3.5 border-2',
  xl: 'h-4 w-4 border-2',
};

const statusColors: Record<string, string> = {
  ONLINE: 'bg-accent-emerald',
  AWAY: 'bg-accent-amber',
  DND: 'bg-accent-red',
  OFFLINE: 'bg-text-tertiary',
  INVISIBLE: 'bg-text-tertiary',
};

export function Avatar({ src, name: rawName, size = 'md', userId, showStatus = false, className }: AvatarProps) {
  const name = rawName || '?';
  const status = usePresenceStore((s) => userId ? s.getUserStatus(userId) : 'OFFLINE');

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
          className={cn('rounded-full object-cover', sizeClasses[size])}
        />
      ) : null}
      {src ? (
        <div
          className={cn('rounded-full flex items-center justify-center font-semibold text-white hidden', sizeClasses[size])}
          style={{ backgroundColor: getAvatarColor(name) }}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div
          className={cn('rounded-full flex items-center justify-center font-semibold text-white', sizeClasses[size])}
          style={{ backgroundColor: getAvatarColor(name) }}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && userId && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-bg-secondary',
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}
