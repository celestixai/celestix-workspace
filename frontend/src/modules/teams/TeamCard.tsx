import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Team } from '@/hooks/useTeams';

interface TeamCardProps {
  team: Team;
}

export function TeamCard({ team }: TeamCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayMembers = team.members.slice(0, 5);
  const overflow = team._count.members - 5;

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 hover:border-border-secondary transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: team.color ? `${team.color}20` : 'rgba(79,142,247,0.2)' }}
        >
          {team.icon || team.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{team.name}</h3>
          {team.description && (
            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{team.description}</p>
          )}
        </div>
      </div>

      {/* Member avatars + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {displayMembers.map((m) => (
              <div
                key={m.id}
                className="w-7 h-7 rounded-full bg-accent-blue/20 border-2 border-bg-secondary flex items-center justify-center overflow-hidden"
                title={m.user.displayName}
              >
                {m.user.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-accent-blue">{m.user.displayName.charAt(0)}</span>
                )}
              </div>
            ))}
            {overflow > 0 && (
              <div className="w-7 h-7 rounded-full bg-bg-tertiary border-2 border-bg-secondary flex items-center justify-center">
                <span className="text-[10px] font-medium text-text-secondary">+{overflow}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-text-secondary ml-2">{team._count.members} member{team._count.members !== 1 ? 's' : ''}</span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </button>
      </div>

      {/* Expanded member list */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-primary space-y-2">
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {m.user.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-accent-blue">{m.user.displayName.charAt(0)}</span>
                )}
              </div>
              <span className="text-sm text-text-primary flex-1 truncate">{m.user.displayName}</span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                m.role === 'lead' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-tertiary text-text-secondary'
              )}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
