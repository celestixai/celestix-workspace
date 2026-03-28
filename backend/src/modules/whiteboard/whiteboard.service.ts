import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateWhiteboardInput,
  UpdateWhiteboardInput,
  AddCollaboratorInput,
} from './whiteboard.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

export class WhiteboardService {
  async create(userId: string, input: CreateWhiteboardInput) {
    const whiteboard = await prisma.whiteboard.create({
      data: {
        name: input.name,
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        userId,
        collaborators: {
          create: [{ userId, permission: 'EDIT' }],
        },
      },
      include: {
        user: { select: userSelect },
        collaborators: true,
      },
    });

    return whiteboard;
  }

  async getAll(userId: string) {
    return prisma.whiteboard.findMany({
      where: {
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: {
        user: { select: userSelect },
        collaborators: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(userId: string, whiteboardId: string) {
    const whiteboard = await prisma.whiteboard.findFirst({
      where: {
        id: whiteboardId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: {
        user: { select: userSelect },
        collaborators: true,
      },
    });

    if (!whiteboard) {
      throw new AppError(404, 'Whiteboard not found', 'NOT_FOUND');
    }

    return whiteboard;
  }

  async update(userId: string, whiteboardId: string, input: UpdateWhiteboardInput) {
    await this.requireCollaboratorPermission(userId, whiteboardId, 'EDIT');

    return prisma.whiteboard.update({
      where: { id: whiteboardId },
      data: {
        name: input.name,
        canvasData: input.canvasData ?? undefined,
      },
      include: {
        user: { select: userSelect },
        collaborators: true,
      },
    });
  }

  async delete(userId: string, whiteboardId: string) {
    const whiteboard = await prisma.whiteboard.findFirst({
      where: { id: whiteboardId },
    });

    if (!whiteboard) {
      throw new AppError(404, 'Whiteboard not found', 'NOT_FOUND');
    }

    if (whiteboard.userId !== userId) {
      throw new AppError(403, 'Only the owner can delete this whiteboard', 'FORBIDDEN');
    }

    await prisma.whiteboard.delete({
      where: { id: whiteboardId },
    });
  }

  async addCollaborator(userId: string, whiteboardId: string, input: AddCollaboratorInput) {
    const whiteboard = await prisma.whiteboard.findFirst({
      where: { id: whiteboardId },
    });

    if (!whiteboard) {
      throw new AppError(404, 'Whiteboard not found', 'NOT_FOUND');
    }

    if (whiteboard.userId !== userId) {
      throw new AppError(403, 'Only the owner can manage collaborators', 'FORBIDDEN');
    }

    // Check if already a collaborator
    const existing = await prisma.whiteboardCollaborator.findFirst({
      where: { whiteboardId, userId: input.userId },
    });

    if (existing) {
      // Update permission if already exists
      return prisma.whiteboardCollaborator.update({
        where: { id: existing.id },
        data: { permission: input.permission },
      });
    }

    return prisma.whiteboardCollaborator.create({
      data: {
        whiteboardId,
        userId: input.userId,
        permission: input.permission,
      },
    });
  }

  async removeCollaborator(userId: string, whiteboardId: string, targetUserId: string) {
    const whiteboard = await prisma.whiteboard.findFirst({
      where: { id: whiteboardId },
    });

    if (!whiteboard) {
      throw new AppError(404, 'Whiteboard not found', 'NOT_FOUND');
    }

    if (whiteboard.userId !== userId) {
      throw new AppError(403, 'Only the owner can manage collaborators', 'FORBIDDEN');
    }

    if (targetUserId === whiteboard.userId) {
      throw new AppError(400, 'Cannot remove the whiteboard owner', 'CANNOT_REMOVE_OWNER');
    }

    const collaborator = await prisma.whiteboardCollaborator.findFirst({
      where: { whiteboardId, userId: targetUserId },
    });

    if (!collaborator) {
      throw new AppError(404, 'Collaborator not found', 'NOT_FOUND');
    }

    await prisma.whiteboardCollaborator.delete({ where: { id: collaborator.id } });
  }

  async getCollaborators(userId: string, whiteboardId: string) {
    // Verify access
    await this.getById(userId, whiteboardId);

    return prisma.whiteboardCollaborator.findMany({
      where: { whiteboardId },
    });
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireCollaboratorPermission(userId: string, whiteboardId: string, permission: 'VIEW' | 'EDIT') {
    const whiteboard = await prisma.whiteboard.findFirst({
      where: { id: whiteboardId },
    });

    if (!whiteboard) {
      throw new AppError(404, 'Whiteboard not found', 'NOT_FOUND');
    }

    // Owner always has full access
    if (whiteboard.userId === userId) return;

    const collaborator = await prisma.whiteboardCollaborator.findFirst({
      where: { whiteboardId, userId },
    });

    if (!collaborator) {
      throw new AppError(403, 'Not a collaborator on this whiteboard', 'FORBIDDEN');
    }

    if (permission === 'EDIT' && collaborator.permission !== 'EDIT') {
      throw new AppError(403, 'Edit permission required', 'FORBIDDEN');
    }
  }
}

export const whiteboardService = new WhiteboardService();
