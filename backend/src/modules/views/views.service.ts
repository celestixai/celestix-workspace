import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateViewInput, UpdateViewInput } from './views.validation';

export class ViewsService {
  async getViewsAtLocation(locationType: string, locationId: string | null, userId: string) {
    const views = await prisma.savedView.findMany({
      where: {
        locationType: locationType as any,
        locationId: locationId ?? undefined,
        OR: [
          { isPrivate: false },
          { isPrivate: true, createdById: userId },
        ],
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { position: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return views;
  }

  async getAllUserViews(workspaceId: string, userId: string) {
    const views = await prisma.savedView.findMany({
      where: {
        workspaceId,
        OR: [
          { isPrivate: false },
          { isPrivate: true, createdById: userId },
        ],
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { position: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return views;
  }

  async createView(userId: string, input: CreateViewInput) {
    // Get the max position at this location
    const maxPos = await prisma.savedView.aggregate({
      where: {
        locationType: input.locationType as any,
        locationId: input.locationId ?? null,
        workspaceId: input.workspaceId,
      },
      _max: { position: true },
    });

    const view = await prisma.savedView.create({
      data: {
        workspaceId: input.workspaceId,
        locationType: input.locationType as any,
        locationId: input.locationId ?? null,
        name: input.name,
        viewType: input.viewType as any,
        icon: input.icon,
        isPrivate: input.isPrivate ?? false,
        position: (maxPos._max.position ?? -1) + 1,
        config: input.config ?? undefined,
        filters: input.filters ?? undefined,
        sorts: input.sorts ?? undefined,
        groupBy: input.groupBy,
        subGroupBy: input.subGroupBy,
        showSubtasks: input.showSubtasks ?? true,
        showClosedTasks: input.showClosedTasks ?? false,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return view;
  }

  async getView(viewId: string) {
    const view = await prisma.savedView.findUnique({
      where: { id: viewId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    return view;
  }

  async updateView(viewId: string, userId: string, data: UpdateViewInput) {
    const view = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    // Only creator can update private views
    if (view.isPrivate && view.createdById !== userId) {
      throw new AppError(403, 'Cannot update another user\'s private view', 'FORBIDDEN');
    }

    const updated = await prisma.savedView.update({
      where: { id: viewId },
      data: {
        name: data.name,
        viewType: data.viewType as any,
        icon: data.icon,
        isPrivate: data.isPrivate,
        config: data.config ?? undefined,
        filters: data.filters ?? undefined,
        sorts: data.sorts ?? undefined,
        groupBy: data.groupBy,
        subGroupBy: data.subGroupBy,
        showSubtasks: data.showSubtasks,
        showClosedTasks: data.showClosedTasks,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return updated;
  }

  async deleteView(viewId: string, userId: string) {
    const view = await prisma.savedView.findUnique({
      where: { id: viewId },
      include: { workspace: { include: { members: true } } },
    });

    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    // Only creator or workspace admin/owner can delete
    const isCreator = view.createdById === userId;
    const member = view.workspace.members.find((m) => m.userId === userId);
    const isAdmin = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    if (!isCreator && !isAdmin) {
      throw new AppError(403, 'Only the creator or workspace admin can delete this view', 'FORBIDDEN');
    }

    await prisma.savedView.delete({ where: { id: viewId } });
  }

  async updatePosition(viewId: string, position: number) {
    const view = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    const updated = await prisma.savedView.update({
      where: { id: viewId },
      data: { position },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return updated;
  }

  async duplicateView(viewId: string, userId: string, name?: string) {
    const source = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!source) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    // Get the max position at this location
    const maxPos = await prisma.savedView.aggregate({
      where: {
        locationType: source.locationType,
        locationId: source.locationId,
        workspaceId: source.workspaceId,
      },
      _max: { position: true },
    });

    const duplicate = await prisma.savedView.create({
      data: {
        workspaceId: source.workspaceId,
        locationType: source.locationType,
        locationId: source.locationId,
        name: name ?? `${source.name} (copy)`,
        viewType: source.viewType,
        icon: source.icon,
        isPrivate: source.isPrivate,
        isPinned: false,
        isDefault: false,
        position: (maxPos._max.position ?? -1) + 1,
        config: source.config ?? undefined,
        filters: source.filters ?? undefined,
        sorts: source.sorts ?? undefined,
        groupBy: source.groupBy,
        subGroupBy: source.subGroupBy,
        showSubtasks: source.showSubtasks,
        showClosedTasks: source.showClosedTasks,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return duplicate;
  }

  async togglePin(viewId: string) {
    const view = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }

    const updated = await prisma.savedView.update({
      where: { id: viewId },
      data: { isPinned: !view.isPinned },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return updated;
  }
}

export const viewsService = new ViewsService();
