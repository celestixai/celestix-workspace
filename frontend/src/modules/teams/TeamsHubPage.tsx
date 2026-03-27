import { useState, useMemo } from 'react';
import { Users, Plus, Search, UserCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTeams, useCreateTeam } from '@/hooks/useTeams';
import type { Team } from '@/hooks/useTeams';
import { TeamCard } from './TeamCard';
import { ProfilePage } from '../profiles/ProfilePage';

interface WorkspaceMemberUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
  role: string;
}

export function TeamsHubPage() {
  // Workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId: string | undefined = workspaces?.[0]?.id;

  const { data: teams, isLoading } = useTeams(workspaceId);

  // Workspace members for people section
  const { data: members } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/${workspaceId}/members`);
      return data.data as Array<{ id: string; user: WorkspaceMemberUser; role: string }>;
    },
    enabled: !!workspaceId,
  });

  const createTeam = useCreateTeam();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#4F8EF7');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  // Build team badges map for people section
  const userTeamMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; color?: string }>>();
    if (!teams) return map;
    for (const team of teams) {
      for (const member of team.members) {
        const existing = map.get(member.userId) || [];
        existing.push({ id: team.id, name: team.name, color: team.color });
        map.set(member.userId, existing);
      }
    }
    return map;
  }, [teams]);

  const handleCreateTeam = async () => {
    if (!workspaceId || !newTeamName.trim()) return;
    await createTeam.mutateAsync({
      workspaceId,
      name: newTeamName.trim(),
      description: newTeamDesc.trim() || undefined,
      color: newTeamColor,
    });
    setNewTeamName('');
    setNewTeamDesc('');
    setShowCreateForm(false);
  };

  // Show profile page
  if (selectedProfileId) {
    return (
      <ProfilePage
        userId={selectedProfileId}
        onBack={() => setSelectedProfileId(null)}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-accent-blue" />
            <h1 className="text-xl font-bold text-text-primary">Teams</h1>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        </div>

        {/* Create Team Form */}
        {showCreateForm && (
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3">
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Color:</label>
              <input
                type="color"
                value={newTeamColor}
                onChange={(e) => setNewTeamColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || createTeam.isPending}
                className="px-4 py-1.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
              >
                {createTeam.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-secondary border border-border-primary rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
        </div>

        {/* Teams Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            {searchQuery ? 'No teams match your search' : 'No teams yet. Create your first team!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team: Team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}

        {/* People Overview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">People</h2>
            {members && (
              <span className="text-xs text-text-secondary bg-bg-tertiary px-2 py-0.5 rounded-full">
                {members.length}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {members?.map((m) => {
              const userTeams = userTeamMap.get(m.user?.id ?? m.id) ?? [];
              const user = m.user || (m as any);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedProfileId(user.id)}
                  className="flex items-start gap-3 bg-bg-secondary border border-border-primary rounded-lg p-3 hover:border-border-secondary transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-accent-blue">
                        {(user.displayName || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{user.displayName}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {userTeams.slice(0, 2).map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full border border-border-primary text-text-secondary"
                          style={t.color ? { borderColor: t.color, color: t.color } : undefined}
                        >
                          {t.name}
                        </span>
                      ))}
                      {userTeams.length > 2 && (
                        <span className="text-[10px] text-text-tertiary">+{userTeams.length - 2}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
