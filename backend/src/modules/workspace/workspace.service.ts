import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateChannelInput,
  UpdateChannelInput,
  SendMessageInput,
  EditMessageInput,
  SearchMessagesInput,
  SlashCommandInput,
  StartHuddleInput,
  CreateCanvasInput,
  UpdateCanvasInput,
  CreateAutomationInput,
  UpdateAutomationInput,
} from './workspace.schema';

// ==========================================
// Helpers
// ==========================================

const userSelect = { id: true, displayName: true, avatarUrl: true, status: true } as const;

function generateInviteCode(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

interface MentionMatch {
  userId: string;
  type: 'user' | 'channel' | 'here';
}

function parseMentions(content: string | null | undefined, channelMemberIds: string[]): MentionMatch[] {
  if (!content) return [];
  const mentions: MentionMatch[] = [];
  const seen = new Set<string>();

  // @here — notify all current channel members
  if (/@here\b/i.test(content)) {
    for (const uid of channelMemberIds) {
      if (!seen.has(`here:${uid}`)) {
        seen.add(`here:${uid}`);
        mentions.push({ userId: uid, type: 'here' });
      }
    }
  }

  // @channel — same as @here, conceptually targets the whole channel
  if (/@channel\b/i.test(content)) {
    for (const uid of channelMemberIds) {
      if (!seen.has(`channel:${uid}`)) {
        seen.add(`channel:${uid}`);
        mentions.push({ userId: uid, type: 'channel' });
      }
    }
  }

  // @<uuid> — explicit user mentions embedded by the client
  const userMentionRegex = /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  let match: RegExpExecArray | null;
  while ((match = userMentionRegex.exec(content)) !== null) {
    const userId = match[1];
    if (!seen.has(`user:${userId}`)) {
      seen.add(`user:${userId}`);
      mentions.push({ userId, type: 'user' });
    }
  }

  return mentions;
}

interface SlashCommandResult {
  command: string;
  handled: boolean;
  response: string;
  sideEffect?: Record<string, unknown>;
}

// ==========================================
// Huddle Types & In-Memory Store
// ==========================================

interface HuddleParticipant {
  userId: string;
  joinedAt: Date;
  isMuted: boolean;
}

interface Huddle {
  id: string;
  channelId: string;
  topic: string | null;
  audioOnly: boolean;
  startedBy: string;
  startedAt: Date;
  participants: Map<string, HuddleParticipant>;
}

// channelId -> Huddle
const activeHuddles = new Map<string, Huddle>();

// ==========================================
// Automation Types & In-Memory Store
// ==========================================

interface AutomationTrigger {
  type: 'message_posted' | 'member_joined' | 'reaction_added' | 'keyword' | 'scheduled';
  channelId?: string;
  keyword?: string;
  schedule?: string;
}

interface AutomationAction {
  type: 'send_message' | 'add_reaction' | 'create_channel' | 'invite_to_channel' | 'webhook';
  config: Record<string, unknown>;
}

interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// workspaceId -> Automation[]
const automationStore = new Map<string, Automation[]>();

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
}

function parseSlashCommand(rawCommand: string): { name: string; args: string } {
  const trimmed = rawCommand.trim();
  if (!trimmed.startsWith('/')) {
    return { name: '', args: '' };
  }
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { name: trimmed.substring(1).toLowerCase(), args: '' };
  }
  return {
    name: trimmed.substring(1, spaceIdx).toLowerCase(),
    args: trimmed.substring(spaceIdx + 1).trim(),
  };
}

// ==========================================
// Service
// ==========================================

export class WorkspaceService {
  // ------------------------------------------
  // Workspace CRUD
  // ------------------------------------------

  async createWorkspace(userId: string, input: CreateWorkspaceInput) {
    const existing = await prisma.workspace.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new AppError(409, 'A workspace with this slug already exists', 'SLUG_TAKEN');
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        iconUrl: input.iconUrl,
        inviteCode: generateInviteCode(),
        members: {
          create: { userId, role: 'OWNER' },
        },
        channels: {
          create: {
            name: 'general',
            description: 'General discussion',
            type: 'PUBLIC',
            createdById: userId,
            members: {
              create: { userId, role: 'OWNER' },
            },
          },
        },
      },
      include: {
        members: { include: { user: { select: userSelect } } },
        channels: true,
      },
    });

    return workspace;
  }

  async getWorkspaces(userId: string) {
    return prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true, channels: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getWorkspace(userId: string, workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { ...userSelect, email: true, lastSeenAt: true } } } },
        channels: {
          where: {
            OR: [
              { type: 'PUBLIC' },
              { members: { some: { userId } } },
            ],
          },
          include: { _count: { select: { members: true, messages: true } } },
          orderBy: { name: 'asc' },
        },
        customEmojis: true,
      },
    });

    if (!workspace) {
      throw new AppError(404, 'Workspace not found', 'NOT_FOUND');
    }

    return workspace;
  }

  async updateWorkspace(userId: string, workspaceId: string, input: UpdateWorkspaceInput) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Only workspace owners or admins can update workspace settings', 'FORBIDDEN');
    }

    return prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: input.name,
        description: input.description,
        iconUrl: input.iconUrl,
      },
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new AppError(403, 'Only the workspace owner can delete a workspace', 'FORBIDDEN');
    }

    await prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async regenerateInviteCode(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Not authorized', 'FORBIDDEN');
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { inviteCode: generateInviteCode() },
      select: { inviteCode: true },
    });

    return workspace.inviteCode;
  }

  async joinViaInvite(userId: string, inviteCode: string) {
    const workspace = await prisma.workspace.findUnique({ where: { inviteCode } });
    if (!workspace) {
      throw new AppError(404, 'Invalid invite code', 'NOT_FOUND');
    }

    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      create: { workspaceId: workspace.id, userId, role: 'MEMBER' },
      update: {},
      include: { workspace: true },
    });

    // Auto-join all public channels
    const publicChannels = await prisma.wsChannel.findMany({
      where: { workspaceId: workspace.id, type: 'PUBLIC', isArchived: false },
      select: { id: true },
    });

    if (publicChannels.length > 0) {
      await prisma.wsChannelMember.createMany({
        data: publicChannels.map((ch) => ({ channelId: ch.id, userId })),
        skipDuplicates: true,
      });
    }

    return member;
  }

  // ------------------------------------------
  // Workspace Members
  // ------------------------------------------

  async inviteMembers(userId: string, workspaceId: string, userIds: string[], role: 'ADMIN' | 'MEMBER' | 'GUEST') {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Not authorized to invite members', 'FORBIDDEN');
    }

    const members = await Promise.all(
      userIds.map((uid) =>
        prisma.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId, userId: uid } },
          create: { workspaceId, userId: uid, role },
          update: {},
          include: { user: { select: userSelect } },
        })
      )
    );

    // Auto-join public channels for new members
    const publicChannels = await prisma.wsChannel.findMany({
      where: { workspaceId, type: 'PUBLIC', isArchived: false },
      select: { id: true },
    });

    if (publicChannels.length > 0) {
      const channelMemberData = userIds.flatMap((uid) =>
        publicChannels.map((ch) => ({ channelId: ch.id, userId: uid }))
      );
      await prisma.wsChannelMember.createMany({
        data: channelMemberData,
        skipDuplicates: true,
      });
    }

    return members;
  }

  async updateMemberRole(userId: string, workspaceId: string, targetUserId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new AppError(403, 'Only the owner can change member roles', 'FORBIDDEN');
    }

    if (targetUserId === userId) {
      throw new AppError(400, 'Cannot change your own role', 'INVALID_INPUT');
    }

    return prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role },
      include: { user: { select: userSelect } },
    });
  }

  async removeMember(userId: string, workspaceId: string, targetUserId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Not authorized to remove members', 'FORBIDDEN');
    }

    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) {
      throw new AppError(404, 'Member not found', 'NOT_FOUND');
    }
    if (target.role === 'OWNER') {
      throw new AppError(400, 'Cannot remove the workspace owner', 'INVALID_INPUT');
    }

    // Remove from all channels in this workspace
    const workspaceChannels = await prisma.wsChannel.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const channelIds = workspaceChannels.map((ch) => ch.id);

    await prisma.wsChannelMember.deleteMany({
      where: { channelId: { in: channelIds }, userId: targetUserId },
    });

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new AppError(404, 'Not a member of this workspace', 'NOT_FOUND');
    }
    if (membership.role === 'OWNER') {
      throw new AppError(400, 'Owner cannot leave the workspace. Transfer ownership first.', 'OWNER_LEAVE');
    }

    const workspaceChannels = await prisma.wsChannel.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const channelIds = workspaceChannels.map((ch) => ch.id);

    await prisma.wsChannelMember.deleteMany({
      where: { channelId: { in: channelIds }, userId },
    });

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  // ------------------------------------------
  // Channels
  // ------------------------------------------

  async createChannel(userId: string, workspaceId: string, input: CreateChannelInput) {
    // Verify workspace membership
    const wsMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!wsMembership) {
      throw new AppError(403, 'Not a member of this workspace', 'FORBIDDEN');
    }
    if (wsMembership.role === 'GUEST' && input.type !== 'DM') {
      throw new AppError(403, 'Guests cannot create channels', 'FORBIDDEN');
    }

    const channel = await prisma.wsChannel.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        topic: input.topic,
        type: input.type,
        createdById: userId,
        members: {
          create: [
            { userId, role: 'OWNER' },
            ...(input.memberIds || []).map((uid) => ({ userId: uid, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        members: true,
        _count: { select: { messages: true } },
      },
    });

    return channel;
  }

  async getChannels(userId: string, workspaceId: string) {
    // All public channels + private channels where user is a member
    const channels = await prisma.wsChannel.findMany({
      where: {
        workspaceId,
        isArchived: false,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          where: { userId },
          select: { isStarred: true, isMuted: true, notificationPref: true, lastReadAt: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    // Compute unread counts
    const channelsWithUnread = await Promise.all(
      channels.map(async (channel) => {
        const myMembership = channel.members[0];
        let unreadCount = 0;
        if (myMembership) {
          const where: Record<string, unknown> = {
            channelId: channel.id,
            isDeleted: false,
            senderId: { not: userId },
          };
          if (myMembership.lastReadAt) {
            where.createdAt = { gt: myMembership.lastReadAt };
          }
          unreadCount = await prisma.wsMessage.count({ where });
        }
        return {
          ...channel,
          unreadCount,
          isStarred: myMembership?.isStarred ?? false,
          isMuted: myMembership?.isMuted ?? false,
          notificationPref: myMembership?.notificationPref ?? 'all',
          isMember: !!myMembership,
        };
      })
    );

    return channelsWithUnread;
  }

  async getChannel(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
        bookmarks: { orderBy: { createdAt: 'desc' } },
        _count: { select: { members: true, messages: true } },
      },
    });

    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    // Private / DM channels require membership
    if (channel.type !== 'PUBLIC') {
      const isMember = channel.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    return channel;
  }

  async updateChannel(userId: string, channelId: string, input: UpdateChannelInput) {
    const membership = await prisma.wsChannelMember.findFirst({
      where: { channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) {
      throw new AppError(403, 'Only channel owners or admins can update channels', 'FORBIDDEN');
    }

    return prisma.wsChannel.update({
      where: { id: channelId },
      data: {
        name: input.name,
        description: input.description,
        topic: input.topic,
      },
    });
  }

  async archiveChannel(userId: string, channelId: string, archive: boolean) {
    const membership = await prisma.wsChannelMember.findFirst({
      where: { channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) {
      throw new AppError(403, 'Only channel owners or admins can archive channels', 'FORBIDDEN');
    }

    return prisma.wsChannel.update({
      where: { id: channelId },
      data: { isArchived: archive },
    });
  }

  async deleteChannel(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    // Only workspace owner/admin or channel owner can delete
    const chMembership = await prisma.wsChannelMember.findFirst({
      where: { channelId, userId, role: 'OWNER' },
    });
    const wsMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: channel.workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });

    if (!chMembership && !wsMembership) {
      throw new AppError(403, 'Not authorized to delete this channel', 'FORBIDDEN');
    }

    await prisma.wsChannel.delete({ where: { id: channelId } });
  }

  // ------------------------------------------
  // Channel Members
  // ------------------------------------------

  async addChannelMembers(userId: string, channelId: string, userIds: string[]) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    // Verify the acting user is a channel member
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    // Private channels: only admin/owner can add members
    if (channel.type === 'PRIVATE' && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new AppError(403, 'Only admins can add members to private channels', 'FORBIDDEN');
    }

    // All added users must be workspace members
    const wsMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: channel.workspaceId, userId: { in: userIds } },
      select: { userId: true },
    });
    const wsMemberIds = new Set(wsMembers.map((m) => m.userId));
    const nonMembers = userIds.filter((uid) => !wsMemberIds.has(uid));
    if (nonMembers.length > 0) {
      throw new AppError(400, `Users are not workspace members: ${nonMembers.join(', ')}`, 'INVALID_INPUT');
    }

    await prisma.wsChannelMember.createMany({
      data: userIds.map((uid) => ({ channelId, userId: uid })),
      skipDuplicates: true,
    });

    return prisma.wsChannelMember.findMany({
      where: { channelId, userId: { in: userIds } },
    });
  }

  async removeChannelMember(userId: string, channelId: string, targetUserId: string) {
    const membership = await prisma.wsChannelMember.findFirst({
      where: { channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) {
      throw new AppError(403, 'Only channel owners or admins can remove members', 'FORBIDDEN');
    }

    const target = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: targetUserId } },
    });
    if (!target) {
      throw new AppError(404, 'Member not found in channel', 'NOT_FOUND');
    }
    if (target.role === 'OWNER') {
      throw new AppError(400, 'Cannot remove the channel owner', 'INVALID_INPUT');
    }

    await prisma.wsChannelMember.delete({
      where: { channelId_userId: { channelId, userId: targetUserId } },
    });
  }

  async updateChannelMemberRole(userId: string, channelId: string, targetUserId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST') {
    const membership = await prisma.wsChannelMember.findFirst({
      where: { channelId, userId, role: 'OWNER' },
    });
    if (!membership) {
      throw new AppError(403, 'Only the channel owner can change member roles', 'FORBIDDEN');
    }

    return prisma.wsChannelMember.update({
      where: { channelId_userId: { channelId, userId: targetUserId } },
      data: { role },
    });
  }

  async updateChannelMemberPrefs(userId: string, channelId: string, prefs: { isStarred?: boolean; isMuted?: boolean; notificationPref?: string }) {
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(404, 'Not a member of this channel', 'NOT_FOUND');
    }

    return prisma.wsChannelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: {
        isStarred: prefs.isStarred,
        isMuted: prefs.isMuted,
        notificationPref: prefs.notificationPref,
      },
    });
  }

  async leaveChannel(userId: string, channelId: string) {
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(404, 'Not a member of this channel', 'NOT_FOUND');
    }
    if (membership.role === 'OWNER') {
      // Count other members to see if ownership needs to transfer
      const otherMembers = await prisma.wsChannelMember.count({
        where: { channelId, userId: { not: userId } },
      });
      if (otherMembers > 0) {
        throw new AppError(400, 'Transfer channel ownership before leaving', 'OWNER_LEAVE');
      }
      // If no other members, delete the channel
      await prisma.wsChannel.delete({ where: { id: channelId } });
      return;
    }

    await prisma.wsChannelMember.delete({
      where: { channelId_userId: { channelId, userId } },
    });
  }

  async joinChannel(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }
    if (channel.type !== 'PUBLIC') {
      throw new AppError(403, 'Can only self-join public channels', 'FORBIDDEN');
    }
    if (channel.isArchived) {
      throw new AppError(400, 'Cannot join an archived channel', 'CHANNEL_ARCHIVED');
    }

    // Verify workspace membership
    const wsMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
    });
    if (!wsMembership) {
      throw new AppError(403, 'Must be a workspace member to join channels', 'FORBIDDEN');
    }

    return prisma.wsChannelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId },
      update: {},
    });
  }

  // ------------------------------------------
  // DMs
  // ------------------------------------------

  async createDm(userId: string, workspaceId: string, targetUserIds: string[]) {
    // Verify all participants are workspace members
    const allUserIds = [userId, ...targetUserIds];
    const wsMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: allUserIds } },
    });
    if (wsMembers.length !== allUserIds.length) {
      throw new AppError(400, 'All participants must be workspace members', 'INVALID_INPUT');
    }

    // For 1:1 DMs, check if one already exists
    if (targetUserIds.length === 1) {
      const existing = await prisma.wsChannel.findFirst({
        where: {
          workspaceId,
          type: 'DM',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: targetUserIds[0] } } },
          ],
          members: { every: { userId: { in: allUserIds } } },
        },
        include: {
          members: true,
          _count: { select: { messages: true } },
        },
      });
      if (existing) return existing;
    }

    const dmName = `dm-${allUserIds.sort().join('-').substring(0, 60)}`;

    const channel = await prisma.wsChannel.create({
      data: {
        workspaceId,
        name: dmName,
        type: 'DM',
        createdById: userId,
        members: {
          create: allUserIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        members: true,
        _count: { select: { messages: true } },
      },
    });

    return channel;
  }

  // ------------------------------------------
  // Messages
  // ------------------------------------------

  async getMessages(userId: string, channelId: string, cursor?: string, limit = 50) {
    // Verify membership or public channel
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new AppError(404, 'Channel not found', 'NOT_FOUND');

    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    const where: Record<string, unknown> = {
      channelId,
      isDeleted: false,
      parentMessageId: null, // top-level only
    };

    if (cursor) {
      const cursorMsg = await prisma.wsMessage.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (cursorMsg) {
        where.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    const messages = await prisma.wsMessage.findMany({
      where,
      include: {
        sender: { select: userSelect },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        mentions: true,
        _count: { select: { threadReplies: true } },
        threadReplies: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    return {
      messages: messages.reverse(),
      hasMore,
      cursor: messages.length > 0 ? messages[0].id : undefined,
    };
  }

  async getThreadReplies(userId: string, parentMessageId: string, cursor?: string, limit = 50) {
    const parent = await prisma.wsMessage.findUnique({
      where: { id: parentMessageId },
      include: {
        channel: true,
        sender: { select: userSelect },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        mentions: true,
      },
    });
    if (!parent) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    if (parent.channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId: parent.channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    const where: Record<string, unknown> = {
      parentMessageId,
      isDeleted: false,
    };

    if (cursor) {
      const cursorMsg = await prisma.wsMessage.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (cursorMsg) {
        where.createdAt = { gt: cursorMsg.createdAt };
      }
    }

    const replies = await prisma.wsMessage.findMany({
      where,
      include: {
        sender: { select: userSelect },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        mentions: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    const hasMore = replies.length > limit;
    if (hasMore) replies.pop();

    return {
      parentMessage: parent,
      replies,
      hasMore,
      cursor: replies.length > 0 ? replies[replies.length - 1].id : undefined,
    };
  }

  async sendMessage(userId: string, channelId: string, input: SendMessageInput) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    if (channel.isArchived) throw new AppError(400, 'Cannot send messages to an archived channel', 'CHANNEL_ARCHIVED');

    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    if (!input.content && !input.attachments?.length) {
      throw new AppError(400, 'Message must have content or attachments', 'INVALID_INPUT');
    }

    // Validate parent message if threaded reply
    if (input.parentMessageId) {
      const parent = await prisma.wsMessage.findUnique({ where: { id: input.parentMessageId } });
      if (!parent || parent.channelId !== channelId) {
        throw new AppError(400, 'Invalid parent message', 'INVALID_INPUT');
      }
      // Do not allow nested threads (replies to replies)
      if (parent.parentMessageId) {
        throw new AppError(400, 'Cannot reply to a thread reply; reply to the parent message instead', 'INVALID_INPUT');
      }
    }

    // Parse mentions from content
    const channelMembers = await prisma.wsChannelMember.findMany({
      where: { channelId },
      select: { userId: true },
    });
    const channelMemberIds = channelMembers.map((m) => m.userId).filter((id) => id !== userId);
    const mentionMatches = parseMentions(input.content, channelMemberIds);

    const message = await prisma.wsMessage.create({
      data: {
        channelId,
        senderId: userId,
        parentMessageId: input.parentMessageId,
        content: input.content,
        contentHtml: input.contentHtml,
        attachments: input.attachments as unknown as undefined,
        metadata: input.metadata as unknown as undefined,
        mentions: mentionMatches.length > 0
          ? { create: mentionMatches.map((m) => ({ userId: m.userId, type: m.type })) }
          : undefined,
      },
      include: {
        sender: { select: userSelect },
        reactions: true,
        mentions: true,
        _count: { select: { threadReplies: true } },
      },
    });

    // Update the sender's last read timestamp
    await prisma.wsChannelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });

    return message;
  }

  async editMessage(userId: string, messageId: string, input: EditMessageInput) {
    const message = await prisma.wsMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');
    if (message.senderId !== userId) throw new AppError(403, 'Cannot edit others\' messages', 'FORBIDDEN');
    if (message.isDeleted) throw new AppError(400, 'Cannot edit a deleted message', 'INVALID_INPUT');

    // Re-parse mentions from updated content
    const channelMembers = await prisma.wsChannelMember.findMany({
      where: { channelId: message.channelId },
      select: { userId: true },
    });
    const channelMemberIds = channelMembers.map((m) => m.userId).filter((id) => id !== userId);
    const mentionMatches = parseMentions(input.content, channelMemberIds);

    // Replace old mentions
    await prisma.wsMention.deleteMany({ where: { messageId } });
    if (mentionMatches.length > 0) {
      await prisma.wsMention.createMany({
        data: mentionMatches.map((m) => ({ messageId, userId: m.userId, type: m.type })),
      });
    }

    return prisma.wsMessage.update({
      where: { id: messageId },
      data: {
        content: input.content,
        contentHtml: input.contentHtml,
        isEdited: true,
      },
      include: {
        sender: { select: userSelect },
        reactions: true,
        mentions: true,
      },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await prisma.wsMessage.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    const isAuthor = message.senderId === userId;

    // Channel admin/owner can also delete
    const chanMembership = await prisma.wsChannelMember.findFirst({
      where: { channelId: message.channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    // Workspace admin/owner can also delete
    const wsMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: message.channel.workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });

    if (!isAuthor && !chanMembership && !wsMembership) {
      throw new AppError(403, 'Not authorized to delete this message', 'FORBIDDEN');
    }

    return prisma.wsMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: null,
        contentHtml: null,
        attachments: Prisma.JsonNull,
      },
    });
  }

  // ------------------------------------------
  // Reactions
  // ------------------------------------------

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const message = await prisma.wsMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    const existing = await prisma.wsMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.wsMessageReaction.delete({ where: { id: existing.id } });
      return { action: 'removed' as const, emoji, messageId };
    }

    await prisma.wsMessageReaction.create({ data: { messageId, userId, emoji } });
    return { action: 'added' as const, emoji, messageId };
  }

  // ------------------------------------------
  // Bookmarks
  // ------------------------------------------

  async addChannelBookmark(userId: string, channelId: string, title: string, url: string) {
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    return prisma.wsChannelBookmark.create({
      data: { channelId, title, url, addedById: userId },
    });
  }

  async removeChannelBookmark(userId: string, bookmarkId: string) {
    const bookmark = await prisma.wsChannelBookmark.findUnique({ where: { id: bookmarkId } });
    if (!bookmark) throw new AppError(404, 'Bookmark not found', 'NOT_FOUND');

    // Only the bookmark creator or a channel admin can remove
    if (bookmark.addedById !== userId) {
      const membership = await prisma.wsChannelMember.findFirst({
        where: { channelId: bookmark.channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!membership) {
        throw new AppError(403, 'Not authorized to remove this bookmark', 'FORBIDDEN');
      }
    }

    await prisma.wsChannelBookmark.delete({ where: { id: bookmarkId } });
  }

  async getChannelBookmarks(userId: string, channelId: string) {
    // Verify at least read access
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new AppError(404, 'Channel not found', 'NOT_FOUND');

    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    return prisma.wsChannelBookmark.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleMessageBookmark(userId: string, messageId: string) {
    const message = await prisma.wsMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    const existing = await prisma.wsMessageBookmark.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing) {
      await prisma.wsMessageBookmark.delete({ where: { id: existing.id } });
      return { action: 'removed' as const, messageId };
    }

    await prisma.wsMessageBookmark.create({ data: { messageId, userId } });
    return { action: 'saved' as const, messageId };
  }

  async getSavedMessages(userId: string, workspaceId: string) {
    // Get all channels in workspace that user is a member of
    const channels = await prisma.wsChannel.findMany({
      where: { workspaceId, members: { some: { userId } } },
      select: { id: true },
    });
    const channelIds = channels.map((ch) => ch.id);

    return prisma.wsMessageBookmark.findMany({
      where: {
        userId,
        message: { channelId: { in: channelIds }, isDeleted: false },
      },
      include: {
        message: {
          include: {
            sender: { select: userSelect },
            channel: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ------------------------------------------
  // Unread / Read
  // ------------------------------------------

  async markChannelRead(userId: string, channelId: string) {
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(404, 'Not a member of this channel', 'NOT_FOUND');
    }

    await prisma.wsChannelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async getUnreadCounts(userId: string, workspaceId: string) {
    const memberships = await prisma.wsChannelMember.findMany({
      where: {
        userId,
        channel: { workspaceId },
      },
      include: {
        channel: { select: { id: true, name: true, type: true } },
      },
    });

    const counts = await Promise.all(
      memberships.map(async (m) => {
        const where: Record<string, unknown> = {
          channelId: m.channelId,
          isDeleted: false,
          senderId: { not: userId },
        };
        if (m.lastReadAt) {
          where.createdAt = { gt: m.lastReadAt };
        }
        const unread = await prisma.wsMessage.count({ where });

        // Count mentions specifically
        let mentionCount = 0;
        if (m.lastReadAt) {
          mentionCount = await prisma.wsMention.count({
            where: {
              userId,
              message: {
                channelId: m.channelId,
                isDeleted: false,
                createdAt: { gt: m.lastReadAt },
              },
            },
          });
        } else {
          mentionCount = await prisma.wsMention.count({
            where: {
              userId,
              message: {
                channelId: m.channelId,
                isDeleted: false,
              },
            },
          });
        }

        return {
          channelId: m.channelId,
          channelName: m.channel.name,
          channelType: m.channel.type,
          unread,
          mentions: mentionCount,
          isStarred: m.isStarred,
          isMuted: m.isMuted,
        };
      })
    );

    return counts.filter((c) => c.unread > 0 || c.mentions > 0);
  }

  // ------------------------------------------
  // Search
  // ------------------------------------------

  async searchMessages(userId: string, workspaceId: string, input: SearchMessagesInput) {
    // Determine which channels the user can access
    const accessibleChannels = await prisma.wsChannel.findMany({
      where: {
        workspaceId,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    const accessibleChannelIds = accessibleChannels.map((ch) => ch.id);

    if (accessibleChannelIds.length === 0) {
      return { messages: [], hasMore: false, cursor: undefined };
    }

    // Build query filters
    const where: Record<string, unknown> = {
      channelId: input.channelId
        ? { in: accessibleChannelIds.includes(input.channelId) ? [input.channelId] : [] }
        : { in: accessibleChannelIds },
      isDeleted: false,
      content: { contains: input.query, mode: 'insensitive' },
    };

    if (input.fromUserId) {
      where.senderId = input.fromUserId;
    }

    const dateFilter: Record<string, Date> = {};
    if (input.after) dateFilter.gte = input.after;
    if (input.before) dateFilter.lte = input.before;
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    if (input.hasLink) {
      // Messages containing URLs
      where.content = { contains: input.query, mode: 'insensitive' };
      where.OR = [
        { content: { contains: 'http://', mode: 'insensitive' } },
        { content: { contains: 'https://', mode: 'insensitive' } },
      ];
      // We need both the query and the link presence, restructure:
      where.AND = [
        { content: { contains: input.query, mode: 'insensitive' } },
        {
          OR: [
            { content: { contains: 'http://', mode: 'insensitive' } },
            { content: { contains: 'https://', mode: 'insensitive' } },
          ],
        },
      ];
      delete where.content;
      delete where.OR;
    }

    if (input.hasFile) {
      where.NOT = { ...((where.NOT as object) || {}), attachments: null };
    }

    if (input.hasReaction) {
      where.reactions = { some: {} };
    }

    if (input.hasThread) {
      where.threadReplies = { some: {} };
    }

    if (input.cursor) {
      const cursorMsg = await prisma.wsMessage.findUnique({ where: { id: input.cursor }, select: { createdAt: true } });
      if (cursorMsg) {
        if (where.createdAt && typeof where.createdAt === 'object') {
          (where.createdAt as Record<string, unknown>).lt = cursorMsg.createdAt;
        } else {
          where.createdAt = { lt: cursorMsg.createdAt };
        }
      }
    }

    const messages = await prisma.wsMessage.findMany({
      where,
      include: {
        sender: { select: userSelect },
        channel: { select: { id: true, name: true } },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        _count: { select: { threadReplies: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit + 1,
    });

    const hasMore = messages.length > input.limit;
    if (hasMore) messages.pop();

    return {
      messages,
      hasMore,
      cursor: messages.length > 0 ? messages[messages.length - 1].id : undefined,
    };
  }

  // ------------------------------------------
  // Custom Emoji
  // ------------------------------------------

  async addCustomEmoji(userId: string, workspaceId: string, name: string, imageUrl: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a workspace member', 'FORBIDDEN');
    }

    const existing = await prisma.wsCustomEmoji.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    if (existing) {
      throw new AppError(409, 'An emoji with this name already exists', 'EMOJI_EXISTS');
    }

    return prisma.wsCustomEmoji.create({
      data: { workspaceId, name, imageUrl, addedById: userId },
    });
  }

  async removeCustomEmoji(userId: string, emojiId: string) {
    const emoji = await prisma.wsCustomEmoji.findUnique({ where: { id: emojiId } });
    if (!emoji) throw new AppError(404, 'Custom emoji not found', 'NOT_FOUND');

    // Only the creator or a workspace admin can delete
    if (emoji.addedById !== userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: emoji.workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!membership) {
        throw new AppError(403, 'Not authorized to remove this emoji', 'FORBIDDEN');
      }
    }

    await prisma.wsCustomEmoji.delete({ where: { id: emojiId } });
  }

  async getCustomEmojis(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a workspace member', 'FORBIDDEN');
    }

    return prisma.wsCustomEmoji.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  // ------------------------------------------
  // Slash Commands
  // ------------------------------------------

  async handleSlashCommand(userId: string, workspaceId: string, input: SlashCommandInput): Promise<SlashCommandResult> {
    const { name, args } = parseSlashCommand(input.command);

    // Verify membership
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId: input.channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    switch (name) {
      case 'remind': {
        // /remind [@user|me] [what] [when]
        // Simplified: store as a system message with metadata
        if (!args) {
          return { command: name, handled: true, response: 'Usage: /remind [me|@user] [reminder text] [in X minutes/hours]' };
        }

        const reminderMatch = args.match(/^(me|@\S+)\s+(.+?)\s+in\s+(\d+)\s*(minutes?|hours?|days?)$/i);
        if (!reminderMatch) {
          return { command: name, handled: true, response: 'Usage: /remind me "buy groceries" in 30 minutes' };
        }

        const target = reminderMatch[1];
        const text = reminderMatch[2];
        const amount = parseInt(reminderMatch[3], 10);
        const unit = reminderMatch[4].toLowerCase().replace(/s$/, '');

        let ms = amount * 60 * 1000; // default minutes
        if (unit === 'hour') ms = amount * 60 * 60 * 1000;
        if (unit === 'day') ms = amount * 24 * 60 * 60 * 1000;

        const remindAt = new Date(Date.now() + ms);

        // Post an ephemeral-style system message
        await prisma.wsMessage.create({
          data: {
            channelId: input.channelId,
            senderId: userId,
            content: `Reminder set: "${text}" — ${remindAt.toISOString()}`,
            metadata: {
              type: 'slash_command',
              command: 'remind',
              target,
              text,
              remindAt: remindAt.toISOString(),
            } as unknown as undefined,
          },
        });

        return {
          command: name,
          handled: true,
          response: `Got it! I'll remind ${target === 'me' ? 'you' : target} "${text}" at ${remindAt.toLocaleString()}.`,
          sideEffect: { remindAt: remindAt.toISOString(), target, text },
        };
      }

      case 'poll': {
        // /poll "Question" "Option1" "Option2" ...
        if (!args) {
          return { command: name, handled: true, response: 'Usage: /poll "Question" "Option 1" "Option 2" ...' };
        }

        const parts: string[] = [];
        const pollRegex = /"([^"]+)"/g;
        let pollMatch: RegExpExecArray | null;
        while ((pollMatch = pollRegex.exec(args)) !== null) {
          parts.push(pollMatch[1]);
        }

        if (parts.length < 3) {
          return { command: name, handled: true, response: 'Poll needs a question and at least 2 options. Wrap each in quotes.' };
        }

        const question = parts[0];
        const options = parts.slice(1);
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        const pollText = `📊 **Poll: ${question}**\n\n${options.map((opt, i) => `${numberEmojis[i] || `${i + 1}.`} ${opt}`).join('\n')}\n\nReact to vote!`;

        const pollMessage = await prisma.wsMessage.create({
          data: {
            channelId: input.channelId,
            senderId: userId,
            content: pollText,
            metadata: {
              type: 'slash_command',
              command: 'poll',
              question,
              options,
            } as unknown as undefined,
          },
          include: {
            sender: { select: userSelect },
          },
        });

        return {
          command: name,
          handled: true,
          response: `Poll created in channel.`,
          sideEffect: { messageId: pollMessage.id, question, options },
        };
      }

      case 'status': {
        // /status :emoji: Status text
        if (!args) {
          // Clear status
          await prisma.user.update({
            where: { id: userId },
            data: { customStatus: null, customStatusEmoji: null },
          });
          return { command: name, handled: true, response: 'Status cleared.' };
        }

        const statusEmojiMatch = args.match(/^:([^:]+):\s*(.*)/);
        let emoji: string | null = null;
        let statusText = args;

        if (statusEmojiMatch) {
          emoji = statusEmojiMatch[1];
          statusText = statusEmojiMatch[2] || '';
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            customStatus: statusText || null,
            customStatusEmoji: emoji,
          },
        });

        return {
          command: name,
          handled: true,
          response: `Status updated: ${emoji ? `:${emoji}: ` : ''}${statusText}`,
        };
      }

      case 'topic': {
        // /topic New channel topic
        if (!args) {
          const channel = await prisma.wsChannel.findUnique({
            where: { id: input.channelId },
            select: { topic: true },
          });
          return {
            command: name,
            handled: true,
            response: channel?.topic ? `Current topic: ${channel.topic}` : 'No topic set. Use /topic <text> to set one.',
          };
        }

        const chMembership = await prisma.wsChannelMember.findFirst({
          where: { channelId: input.channelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
        });
        if (!chMembership) {
          return { command: name, handled: true, response: 'Only channel admins can change the topic.' };
        }

        await prisma.wsChannel.update({
          where: { id: input.channelId },
          data: { topic: args },
        });

        // Post a system message about the topic change
        await prisma.wsMessage.create({
          data: {
            channelId: input.channelId,
            senderId: userId,
            content: `set the channel topic: ${args}`,
            metadata: { type: 'system', action: 'topic_changed', topic: args } as unknown as undefined,
          },
        });

        return {
          command: name,
          handled: true,
          response: `Topic updated to: ${args}`,
        };
      }

      default:
        return {
          command: name || input.command,
          handled: false,
          response: `Unknown command: /${name || input.command}`,
        };
    }
  }

  // ------------------------------------------
  // Mentions
  // ------------------------------------------

  async getMentions(userId: string, workspaceId: string) {
    const channels = await prisma.wsChannel.findMany({
      where: { workspaceId, members: { some: { userId } } },
      select: { id: true },
    });
    const channelIds = channels.map((ch) => ch.id);

    return prisma.wsMention.findMany({
      where: {
        userId,
        message: {
          channelId: { in: channelIds },
          isDeleted: false,
        },
      },
      include: {
        message: {
          include: {
            sender: { select: userSelect },
            channel: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { message: { createdAt: 'desc' } },
      take: 50,
    });
  }

  // ------------------------------------------
  // Huddles (audio/video in channels)
  // ------------------------------------------

  async startHuddle(userId: string, channelId: string, input: StartHuddleInput) {
    // Verify channel exists and user is a member
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    // Check if a huddle is already active in this channel
    if (activeHuddles.has(channelId)) {
      throw new AppError(409, 'A huddle is already active in this channel', 'HUDDLE_ACTIVE');
    }

    const huddle: Huddle = {
      id: generateId(),
      channelId,
      topic: input.topic ?? null,
      audioOnly: input.audioOnly ?? true,
      startedBy: userId,
      startedAt: new Date(),
      participants: new Map([[userId, { userId, joinedAt: new Date(), isMuted: false }]]),
    };

    activeHuddles.set(channelId, huddle);

    return {
      id: huddle.id,
      channelId: huddle.channelId,
      topic: huddle.topic,
      audioOnly: huddle.audioOnly,
      startedBy: huddle.startedBy,
      startedAt: huddle.startedAt,
      participants: Array.from(huddle.participants.values()),
    };
  }

  async joinHuddle(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    const huddle = activeHuddles.get(channelId);
    if (!huddle) {
      throw new AppError(404, 'No active huddle in this channel', 'NO_HUDDLE');
    }

    if (huddle.participants.has(userId)) {
      throw new AppError(409, 'Already in the huddle', 'ALREADY_JOINED');
    }

    huddle.participants.set(userId, { userId, joinedAt: new Date(), isMuted: false });

    return {
      id: huddle.id,
      channelId: huddle.channelId,
      topic: huddle.topic,
      audioOnly: huddle.audioOnly,
      startedBy: huddle.startedBy,
      startedAt: huddle.startedAt,
      participants: Array.from(huddle.participants.values()),
    };
  }

  async leaveHuddle(userId: string, channelId: string) {
    const huddle = activeHuddles.get(channelId);
    if (!huddle) {
      throw new AppError(404, 'No active huddle in this channel', 'NO_HUDDLE');
    }

    if (!huddle.participants.has(userId)) {
      throw new AppError(404, 'Not in this huddle', 'NOT_IN_HUDDLE');
    }

    huddle.participants.delete(userId);

    // If no participants left, end the huddle
    if (huddle.participants.size === 0) {
      activeHuddles.delete(channelId);
      return { ended: true, huddle: null };
    }

    return {
      ended: false,
      huddle: {
        id: huddle.id,
        channelId: huddle.channelId,
        topic: huddle.topic,
        audioOnly: huddle.audioOnly,
        startedBy: huddle.startedBy,
        startedAt: huddle.startedAt,
        participants: Array.from(huddle.participants.values()),
      },
    };
  }

  async getHuddle(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    const huddle = activeHuddles.get(channelId);
    if (!huddle) {
      return null;
    }

    return {
      id: huddle.id,
      channelId: huddle.channelId,
      topic: huddle.topic,
      audioOnly: huddle.audioOnly,
      startedBy: huddle.startedBy,
      startedAt: huddle.startedAt,
      participants: Array.from(huddle.participants.values()),
    };
  }

  // ------------------------------------------
  // Canvas (collaborative docs in channels)
  // ------------------------------------------

  async createCanvas(userId: string, channelId: string, input: CreateCanvasInput) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    // Use the Note model to store canvas documents, linking via metadata
    const canvas = await prisma.note.create({
      data: {
        userId,
        title: input.title,
        contentJson: (input.contentJson ?? {}) as Prisma.InputJsonValue,
        contentText: input.contentText ?? '',
        // Store channel association in a way we can query — use a tag-like approach
        // We use a convention: notes with metadata stored in contentJson.channelId
        // Since Note doesn't have a channelId field, we embed it in contentJson
      },
    });

    // Update contentJson to include the channel reference
    const updatedCanvas = await prisma.note.update({
      where: { id: canvas.id },
      data: {
        contentJson: {
          ...(typeof input.contentJson === 'object' && input.contentJson !== null ? input.contentJson : {}),
          _channelId: channelId,
          _workspaceId: channel.workspaceId,
        },
      },
    });

    return updatedCanvas;
  }

  async listCanvases(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    // Query notes that have _channelId matching in their contentJson
    // Prisma supports JSON path filtering on PostgreSQL
    const canvases = await prisma.note.findMany({
      where: {
        deletedAt: null,
        contentJson: {
          path: ['_channelId'],
          equals: channelId,
        },
      },
      select: {
        id: true,
        title: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: userSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return canvases;
  }

  async getCanvas(userId: string, canvasId: string) {
    const canvas = await prisma.note.findUnique({
      where: { id: canvasId },
      include: {
        user: { select: userSelect },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        shares: true,
      },
    });

    if (!canvas || canvas.deletedAt) {
      throw new AppError(404, 'Canvas not found', 'NOT_FOUND');
    }

    // Verify access: either the owner, or a member of the linked channel
    const contentJson = canvas.contentJson as Record<string, unknown> | null;
    const linkedChannelId = contentJson?._channelId as string | undefined;

    if (canvas.userId !== userId && linkedChannelId) {
      const channel = await prisma.wsChannel.findUnique({ where: { id: linkedChannelId } });
      if (channel && channel.type !== 'PUBLIC') {
        const membership = await prisma.wsChannelMember.findUnique({
          where: { channelId_userId: { channelId: linkedChannelId, userId } },
        });
        if (!membership) {
          throw new AppError(403, 'Not authorized to view this canvas', 'FORBIDDEN');
        }
      }
    }

    return canvas;
  }

  async updateCanvas(userId: string, canvasId: string, input: UpdateCanvasInput) {
    const canvas = await prisma.note.findUnique({ where: { id: canvasId } });

    if (!canvas || canvas.deletedAt) {
      throw new AppError(404, 'Canvas not found', 'NOT_FOUND');
    }

    // Verify access: owner or channel member
    const contentJson = canvas.contentJson as Record<string, unknown> | null;
    const linkedChannelId = contentJson?._channelId as string | undefined;

    if (canvas.userId !== userId && linkedChannelId) {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId: linkedChannelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not authorized to edit this canvas', 'FORBIDDEN');
      }
    }

    // Save current version before updating
    if (canvas.contentJson) {
      await prisma.noteVersion.create({
        data: {
          noteId: canvasId,
          contentJson: canvas.contentJson,
        },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.contentText !== undefined) updateData.contentText = input.contentText;
    if (input.contentJson !== undefined) {
      // Preserve the channel link metadata
      updateData.contentJson = {
        ...input.contentJson,
        _channelId: contentJson?._channelId,
        _workspaceId: contentJson?._workspaceId,
      };
    }

    return prisma.note.update({
      where: { id: canvasId },
      data: updateData,
      include: {
        user: { select: userSelect },
      },
    });
  }

  async deleteCanvas(userId: string, canvasId: string) {
    const canvas = await prisma.note.findUnique({ where: { id: canvasId } });

    if (!canvas || canvas.deletedAt) {
      throw new AppError(404, 'Canvas not found', 'NOT_FOUND');
    }

    // Only the creator or a channel admin can delete
    const contentJson = canvas.contentJson as Record<string, unknown> | null;
    const linkedChannelId = contentJson?._channelId as string | undefined;

    if (canvas.userId !== userId) {
      if (!linkedChannelId) {
        throw new AppError(403, 'Only the canvas creator can delete it', 'FORBIDDEN');
      }
      const channelMembership = await prisma.wsChannelMember.findFirst({
        where: { channelId: linkedChannelId, userId, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!channelMembership) {
        throw new AppError(403, 'Only the creator or channel admins can delete a canvas', 'FORBIDDEN');
      }
    }

    // Soft-delete
    await prisma.note.update({
      where: { id: canvasId },
      data: { deletedAt: new Date() },
    });
  }

  // ------------------------------------------
  // Channel Analytics
  // ------------------------------------------

  async getChannelAnalytics(userId: string, channelId: string, days: number = 30) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    // Verify membership or public channel
    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Total message count in the period
    const totalMessages = await prisma.wsMessage.count({
      where: { channelId, isDeleted: false, createdAt: { gte: since } },
    });

    // Total thread replies
    const threadReplies = await prisma.wsMessage.count({
      where: { channelId, isDeleted: false, createdAt: { gte: since }, parentMessageId: { not: null } },
    });

    // Active users (distinct senders)
    const activeUsersResult = await prisma.wsMessage.groupBy({
      by: ['senderId'],
      where: { channelId, isDeleted: false, createdAt: { gte: since } },
    });
    const activeUserCount = activeUsersResult.length;

    // Top contributors (top 10 by message count)
    const topContributors = await prisma.wsMessage.groupBy({
      by: ['senderId'],
      where: { channelId, isDeleted: false, createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Fetch user details for top contributors
    const topContributorIds = topContributors.map((c) => c.senderId);
    const users = await prisma.user.findMany({
      where: { id: { in: topContributorIds } },
      select: userSelect,
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const topContributorsWithUsers = topContributors.map((c) => ({
      user: userMap.get(c.senderId) ?? { id: c.senderId },
      messageCount: c._count.id,
    }));

    // Messages with reactions
    const messagesWithReactions = await prisma.wsMessageReaction.groupBy({
      by: ['messageId'],
      where: {
        message: { channelId, isDeleted: false, createdAt: { gte: since } },
      },
    });

    // Total reactions
    const totalReactions = await prisma.wsMessageReaction.count({
      where: {
        message: { channelId, isDeleted: false, createdAt: { gte: since } },
      },
    });

    // Member count
    const memberCount = await prisma.wsChannelMember.count({ where: { channelId } });

    // Daily message counts for the period (using raw SQL for date grouping)
    const dailyMessages = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE(created_at) as day, COUNT(*)::bigint as count
      FROM ws_messages
      WHERE channel_id = ${channelId}::uuid
        AND is_deleted = false
        AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;

    // Peak hours (0-23)
    const hourlyMessages = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::bigint as count
      FROM ws_messages
      WHERE channel_id = ${channelId}::uuid
        AND is_deleted = false
        AND created_at >= ${since}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY count DESC
    `;

    return {
      channelId,
      period: { days, since: since.toISOString() },
      totalMessages,
      threadReplies,
      activeUserCount,
      memberCount,
      totalReactions,
      messagesWithReactionsCount: messagesWithReactions.length,
      topContributors: topContributorsWithUsers,
      dailyMessages: dailyMessages.map((d) => ({
        day: d.day,
        count: Number(d.count),
      })),
      peakHours: hourlyMessages.map((h) => ({
        hour: h.hour,
        count: Number(h.count),
      })),
    };
  }

  // ------------------------------------------
  // Workflow Automations
  // ------------------------------------------

  async createAutomation(userId: string, workspaceId: string, input: CreateAutomationInput) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Only workspace owners or admins can create automations', 'FORBIDDEN');
    }

    // If a channel is referenced in the trigger, verify it exists in this workspace
    if (input.trigger.channelId) {
      const channel = await prisma.wsChannel.findFirst({
        where: { id: input.trigger.channelId, workspaceId },
      });
      if (!channel) {
        throw new AppError(404, 'Referenced channel not found in this workspace', 'NOT_FOUND');
      }
    }

    const automation: Automation = {
      id: generateId(),
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      trigger: input.trigger as AutomationTrigger,
      actions: input.actions as AutomationAction[],
      enabled: input.enabled ?? true,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = automationStore.get(workspaceId) ?? [];
    existing.push(automation);
    automationStore.set(workspaceId, existing);

    return automation;
  }

  async listAutomations(userId: string, workspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this workspace', 'FORBIDDEN');
    }

    return automationStore.get(workspaceId) ?? [];
  }

  async updateAutomation(userId: string, automationId: string, input: UpdateAutomationInput) {
    // Find the automation across all workspaces
    let foundAutomation: Automation | null = null;
    let foundWorkspaceId: string | null = null;

    for (const [wsId, automations] of automationStore) {
      const automation = automations.find((a) => a.id === automationId);
      if (automation) {
        foundAutomation = automation;
        foundWorkspaceId = wsId;
        break;
      }
    }

    if (!foundAutomation || !foundWorkspaceId) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    // Verify workspace admin/owner
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: foundWorkspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Only workspace owners or admins can update automations', 'FORBIDDEN');
    }

    // Apply updates
    if (input.name !== undefined) foundAutomation.name = input.name;
    if (input.description !== undefined) foundAutomation.description = input.description ?? null;
    if (input.trigger !== undefined) foundAutomation.trigger = input.trigger as AutomationTrigger;
    if (input.actions !== undefined) foundAutomation.actions = input.actions as AutomationAction[];
    if (input.enabled !== undefined) foundAutomation.enabled = input.enabled;
    foundAutomation.updatedAt = new Date();

    return foundAutomation;
  }

  async deleteAutomation(userId: string, automationId: string) {
    let foundWorkspaceId: string | null = null;
    let foundIndex = -1;

    for (const [wsId, automations] of automationStore) {
      const idx = automations.findIndex((a) => a.id === automationId);
      if (idx !== -1) {
        foundWorkspaceId = wsId;
        foundIndex = idx;
        break;
      }
    }

    if (!foundWorkspaceId || foundIndex === -1) {
      throw new AppError(404, 'Automation not found', 'NOT_FOUND');
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: foundWorkspaceId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError(403, 'Only workspace owners or admins can delete automations', 'FORBIDDEN');
    }

    const automations = automationStore.get(foundWorkspaceId)!;
    automations.splice(foundIndex, 1);
  }

  // ------------------------------------------
  // Pinned Messages
  // ------------------------------------------

  async togglePinMessage(userId: string, messageId: string) {
    const message = await prisma.wsMessage.findUnique({
      where: { id: messageId },
      include: { channel: { select: { id: true, type: true } } },
    });

    if (!message || message.isDeleted) {
      throw new AppError(404, 'Message not found', 'NOT_FOUND');
    }

    // Verify user is a channel member
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId: message.channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
    }

    // Toggle pin status via the metadata JSON field
    const currentMetadata = (message.metadata as Record<string, unknown>) ?? {};
    const isPinned = currentMetadata._pinned === true;

    const updatedMetadata = {
      ...currentMetadata,
      _pinned: !isPinned,
      _pinnedBy: !isPinned ? userId : null,
      _pinnedAt: !isPinned ? new Date().toISOString() : null,
    };

    const updatedMessage = await prisma.wsMessage.update({
      where: { id: messageId },
      data: { metadata: updatedMetadata },
      include: {
        sender: { select: userSelect },
      },
    });

    return {
      pinned: !isPinned,
      message: updatedMessage,
    };
  }

  async getPinnedMessages(userId: string, channelId: string) {
    const channel = await prisma.wsChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    if (channel.type !== 'PUBLIC') {
      const membership = await prisma.wsChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new AppError(403, 'Not a member of this channel', 'FORBIDDEN');
      }
    }

    // Query messages where metadata contains _pinned: true
    const pinnedMessages = await prisma.wsMessage.findMany({
      where: {
        channelId,
        isDeleted: false,
        metadata: {
          path: ['_pinned'],
          equals: true,
        },
      },
      include: {
        sender: { select: userSelect },
        reactions: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        _count: { select: { threadReplies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pinnedMessages;
  }
}

export const workspaceService = new WorkspaceService();
