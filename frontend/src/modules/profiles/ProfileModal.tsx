import { X, ExternalLink, MessageCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfiles';
import { cn } from '@/lib/utils';

interface ProfileModalProps {
  userId: string;
  onClose: () => void;
  onViewFullProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export function ProfileModal({ userId, onClose, onViewFullProfile, onSendMessage }: ProfileModalProps) {
  const { data: profile, isLoading } = useProfile(userId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border-primary rounded-xl shadow-xl w-80 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div className="flex justify-end p-2">
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded transition-colors">
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        )}

        {profile && (
          <div className="px-5 pb-5 space-y-4">
            {/* Avatar + Info */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-blue/20 flex items-center justify-center overflow-hidden mb-3">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-accent-blue">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{profile.displayName}</h3>
              <p className="text-sm text-text-secondary">{profile.email}</p>
              {profile.workspaceMembers?.[0] && (
                <span className="mt-1 px-2 py-0.5 rounded text-xs font-medium bg-accent-blue/20 text-accent-blue">
                  {profile.workspaceMembers[0].role}
                </span>
              )}
            </div>

            {/* Team badges */}
            {profile.teamMemberships.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {profile.teamMemberships.map((tm) => (
                  <span
                    key={tm.team.id}
                    className="px-2 py-0.5 rounded-full text-xs border border-border-primary text-text-secondary"
                    style={tm.team.color ? { borderColor: tm.team.color, color: tm.team.color } : undefined}
                  >
                    {tm.team.icon && <span className="mr-1">{tm.team.icon}</span>}
                    {tm.team.name}
                  </span>
                ))}
              </div>
            )}

            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-primary rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-text-primary">{profile.stats.activeTasks}</div>
                <div className="text-xs text-text-secondary">Active Tasks</div>
              </div>
              <div className="bg-bg-primary rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-text-primary">{profile.stats.completedTasks}</div>
                <div className="text-xs text-text-secondary">Completed (30d)</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {onViewFullProfile && (
                <button
                  onClick={() => onViewFullProfile(userId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Full Profile
                </button>
              )}
              {onSendMessage && (
                <button
                  onClick={() => onSendMessage(userId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Message
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
