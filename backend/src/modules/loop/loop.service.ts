import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateComponentInput,
  UpdateComponentInput,
  CreatePageInput,
  UpdatePageInput,
  CreateEmbedInput,
} from './loop.schema';

export class LoopService {
  // ==================================
  // COMPONENT CRUD
  // ==================================

  async createComponent(userId: string, input: CreateComponentInput) {
    const component = await prisma.loopComponent.create({
      data: {
        type: input.type,
        content: input.content,
        workspaceId: input.workspaceId,
        createdBy: userId,
      },
    });

    return component;
  }

  async getComponent(componentId: string) {
    const component = await prisma.loopComponent.findUnique({
      where: { id: componentId },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });

    if (!component) {
      throw new AppError(404, 'Component not found', 'NOT_FOUND');
    }

    return component;
  }

  async updateComponent(userId: string, componentId: string, input: UpdateComponentInput) {
    const component = await prisma.loopComponent.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      throw new AppError(404, 'Component not found', 'NOT_FOUND');
    }

    if (component.createdBy !== userId) {
      throw new AppError(403, 'Not authorized to update this component', 'FORBIDDEN');
    }

    return prisma.loopComponent.update({
      where: { id: componentId },
      data: { content: input.content },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });
  }

  async deleteComponent(userId: string, componentId: string) {
    const component = await prisma.loopComponent.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      throw new AppError(404, 'Component not found', 'NOT_FOUND');
    }

    if (component.createdBy !== userId) {
      throw new AppError(403, 'Not authorized to delete this component', 'FORBIDDEN');
    }

    await prisma.loopComponent.delete({ where: { id: componentId } });
  }

  // ==================================
  // PAGE CRUD
  // ==================================

  async createPage(userId: string, input: CreatePageInput) {
    const page = await prisma.loopPage.create({
      data: {
        title: input.title,
        componentIds: input.componentIds,
        workspaceId: input.workspaceId,
        createdBy: userId,
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });

    return page;
  }

  async getPage(pageId: string) {
    const page = await prisma.loopPage.findUnique({
      where: { id: pageId },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });

    if (!page) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    return page;
  }

  async updatePage(userId: string, pageId: string, input: UpdatePageInput) {
    const page = await prisma.loopPage.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    if (page.createdBy !== userId) {
      throw new AppError(403, 'Not authorized to update this page', 'FORBIDDEN');
    }

    return prisma.loopPage.update({
      where: { id: pageId },
      data: {
        title: input.title,
        componentIds: input.componentIds,
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });
  }

  async deletePage(userId: string, pageId: string) {
    const page = await prisma.loopPage.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    if (page.createdBy !== userId) {
      throw new AppError(403, 'Not authorized to delete this page', 'FORBIDDEN');
    }

    await prisma.loopPage.delete({ where: { id: pageId } });
  }

  async getMyPages(userId: string) {
    return prisma.loopPage.findMany({
      where: { createdBy: userId },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ==================================
  // EMBEDS
  // ==================================

  async createEmbed(userId: string, input: CreateEmbedInput) {
    // Verify the component exists
    const component = await prisma.loopComponent.findUnique({
      where: { id: input.componentId },
    });

    if (!component) {
      throw new AppError(404, 'Component not found', 'NOT_FOUND');
    }

    return prisma.loopEmbed.create({
      data: {
        componentId: input.componentId,
        contextType: input.contextType,
        contextId: input.contextId,
      },
      include: {
        component: true,
      },
    });
  }

  async getEmbedsByContext(contextType: string, contextId: string) {
    return prisma.loopEmbed.findMany({
      where: { contextType, contextId },
      include: {
        component: {
          include: {
            creator: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }
}

export const loopService = new LoopService();
