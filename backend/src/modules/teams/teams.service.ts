import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateTeamInput, UpdateTeamInput } from './teams.validation';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true };

class TeamsService {
  async getTeams(workspaceId: string) {
    return prisma.team.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: userSelect },
        members: {
          include: { user: { select: userSelect } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async createTeam(workspaceId: string, userId: string, data: CreateTeamInput) {
    return prisma.team.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        members: {
          create: { userId, role: 'lead' },
        },
      },
      include: {
        createdBy: { select: userSelect },
        members: {
          include: { user: { select: userSelect } },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async getTeam(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        createdBy: { select: userSelect },
        members: {
          include: { user: { select: userSelect } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });
    if (!team) {
      throw new AppError(404, 'Team not found', 'NOT_FOUND');
    }
    return team;
  }

  async updateTeam(teamId: string, data: UpdateTeamInput) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new AppError(404, 'Team not found', 'NOT_FOUND');
    }

    return prisma.team.update({
      where: { id: teamId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
      },
      include: {
        createdBy: { select: userSelect },
        members: {
          include: { user: { select: userSelect } },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async deleteTeam(teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new AppError(404, 'Team not found', 'NOT_FOUND');
    }
    await prisma.team.delete({ where: { id: teamId } });
  }

  async addMember(teamId: string, userId: string, role: string = 'member') {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new AppError(404, 'Team not found', 'NOT_FOUND');
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) {
      throw new AppError(409, 'User is already a member of this team', 'CONFLICT');
    }

    return prisma.teamMember.create({
      data: { teamId, userId, role },
      include: { user: { select: userSelect } },
    });
  }

  async removeMember(teamId: string, userId: string) {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new AppError(404, 'Team member not found', 'NOT_FOUND');
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
  }

  async updateMemberRole(teamId: string, userId: string, role: string) {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new AppError(404, 'Team member not found', 'NOT_FOUND');
    }

    return prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
      include: { user: { select: userSelect } },
    });
  }
}

export const teamsService = new TeamsService();
