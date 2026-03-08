import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateDiagramInput,
  UpdateDiagramInput,
  UpdateCanvasDataInput,
} from './diagrams.schema';

export class DiagramService {
  async create(userId: string, input: CreateDiagramInput) {
    return prisma.diagram.create({
      data: {
        userId,
        title: input.title,
        type: input.type,
        templateId: input.templateId,
        canvasData: {
          shapes: [],
          connectors: [],
          layers: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    });
  }

  async getAll(userId: string) {
    return prisma.diagram.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        isPublic: true,
        templateId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getById(userId: string, diagramId: string) {
    const diagram = await prisma.diagram.findFirst({
      where: { id: diagramId, userId },
    });

    if (!diagram) {
      throw new AppError(404, 'Diagram not found', 'NOT_FOUND');
    }

    return diagram;
  }

  async update(userId: string, diagramId: string, input: UpdateDiagramInput) {
    const diagram = await prisma.diagram.findFirst({
      where: { id: diagramId, userId },
    });

    if (!diagram) {
      throw new AppError(404, 'Diagram not found', 'NOT_FOUND');
    }

    return prisma.diagram.update({
      where: { id: diagramId },
      data: {
        title: input.title,
        canvasData: input.canvasData ?? undefined,
        isPublic: input.isPublic,
      },
    });
  }

  async delete(userId: string, diagramId: string) {
    const diagram = await prisma.diagram.findFirst({
      where: { id: diagramId, userId },
    });

    if (!diagram) {
      throw new AppError(404, 'Diagram not found', 'NOT_FOUND');
    }

    await prisma.diagram.delete({ where: { id: diagramId } });
  }

  async getByType(userId: string, type: string) {
    return prisma.diagram.findMany({
      where: { userId, type: type as never },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        isPublic: true,
        templateId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateCanvasData(userId: string, diagramId: string, input: UpdateCanvasDataInput) {
    const diagram = await prisma.diagram.findFirst({
      where: { id: diagramId, userId },
    });

    if (!diagram) {
      throw new AppError(404, 'Diagram not found', 'NOT_FOUND');
    }

    const currentCanvas = (diagram.canvasData as Record<string, unknown>) || {
      shapes: [],
      connectors: [],
      layers: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const mergedCanvas = {
      ...currentCanvas,
      ...(input.shapes !== undefined && { shapes: input.shapes }),
      ...(input.connectors !== undefined && { connectors: input.connectors }),
      ...(input.layers !== undefined && { layers: input.layers }),
      ...(input.viewport !== undefined && { viewport: input.viewport }),
    };

    return prisma.diagram.update({
      where: { id: diagramId },
      data: { canvasData: mergedCanvas },
    });
  }

  async duplicate(userId: string, diagramId: string) {
    const diagram = await prisma.diagram.findFirst({
      where: { id: diagramId, userId },
    });

    if (!diagram) {
      throw new AppError(404, 'Diagram not found', 'NOT_FOUND');
    }

    return prisma.diagram.create({
      data: {
        userId,
        title: `${diagram.title} (copy)`,
        type: diagram.type,
        canvasData: diagram.canvasData ?? {
          shapes: [],
          connectors: [],
          layers: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        templateId: diagram.templateId,
        isPublic: false,
      },
    });
  }
}

export const diagramService = new DiagramService();
