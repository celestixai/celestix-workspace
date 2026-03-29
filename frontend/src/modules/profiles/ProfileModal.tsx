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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#161618] border border-[rgba(255,255,255,0.12)] rounded-2xl shadow-2xl w-80 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div className="flex justify-end p-2">
          <button onClick={onClose} className="p-1.5 hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[rgba(255,255,255,0.40)]" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
          </div>
        )}

        {profile && (
          <div className="px-5 pb-5 space-y-4">
            {/* Avatar + Info */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#2563EB]/15 flex items-center justify-center overflow-hidden mb-3 ring-2 ring-[rgba(255,255,255,0.08)]">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-[#2563EB]">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="text-[18px] font-semibold text-[rgba(255,255,255,0.95)]">{profile.displayName}</h3>
              <p className="text-[13px] text-[rgba(255,255,255,0.40)]">{profile.username ? `@${profile.username}` : profile.email}</p>
              {profile.workspaceMembers?.[0] && (
                <span className="mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#2563EB]/15 text-[#2563EB]">
                  {profile.workspaceMembers[0].role}
                </span>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-[14px] text-[rgba(255,255,255,0.65)] text-center leading-relaxed">{profile.bio}</p>
            )}

            {/* Team badges */}
            {profile.teamMemberships.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {profile.teamMemberships.map((tm) => (
                  <span
                    key={tm.team.id}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.65)]"
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
              <div className="bg-[#111113] rounded-xl p-3 text-center border border-[rgba(255,255,255,0.06)]">
                <div className="text-lg font-bold text-[rgba(255,255,255,0.95)]">{profile.stats.activeTasks}</div>
                <div className="text-[11px] text-[rgba(255,255,255,0.40)]">Active Tasks</div>
              </div>
              <div className="bg-[#111113] rounded-xl p-3 text-center border border-[rgba(255,255,255,0.06)]">
                <div className="text-lg font-bold text-[rgba(255,255,255,0.95)]">{profile.stats.completedTasks}</div>
                <div className="text-[11px] text-[rgba(255,255,255,0.40)]">Completed (30d)</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {onSendMessage && (
                <button
                  onClick={() => onSendMessage(userId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#2563EB]/90 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Message
                </button>
              )}
              {onViewFullProfile && (
                <button
                  onClick={() => onViewFullProfile(userId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#111113] border border-[rgba(255,255,255,0.12)] rounded-xl text-sm font-medium text-[rgba(255,255,255,0.95)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Profile
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
