import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreatePresentationInput,
  UpdatePresentationInput,
  AddSlideInput,
  UpdateSlideInput,
  ReorderSlidesInput,
} from './presentations.schema';

export class PresentationService {
  async create(userId: string, input: CreatePresentationInput) {
    return prisma.presentation.create({
      data: {
        userId,
        title: input.title,
        theme: input.theme,
        slideSize: input.slideSize,
        slides: [] as Prisma.InputJsonValue,
      },
    });
  }

  async getAll(userId: string) {
    return prisma.presentation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        theme: true,
        slideSize: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getById(userId: string, presentationId: string) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    return presentation;
  }

  async update(userId: string, presentationId: string, input: UpdatePresentationInput) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    return prisma.presentation.update({
      where: { id: presentationId },
      data: {
        title: input.title,
        theme: input.theme,
        slides: (input.slides as Prisma.InputJsonValue) ?? undefined,
        isPublic: input.isPublic,
      },
    });
  }

  async delete(userId: string, presentationId: string) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    await prisma.presentation.delete({ where: { id: presentationId } });
  }

  async addSlide(userId: string, presentationId: string, input: AddSlideInput) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    const slides = (presentation.slides as unknown[]) || [];
    const position = input.position !== undefined ? input.position : slides.length;

    if (position < 0 || position > slides.length) {
      throw new AppError(400, 'Invalid slide position', 'INVALID_POSITION');
    }

    slides.splice(position, 0, input.slide);

    return prisma.presentation.update({
      where: { id: presentationId },
      data: { slides: slides as Prisma.InputJsonValue },
    });
  }

  async updateSlide(userId: string, presentationId: string, slideIndex: number, input: UpdateSlideInput) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    const slides = (presentation.slides as Record<string, unknown>[]) || [];

    if (slideIndex < 0 || slideIndex >= slides.length) {
      throw new AppError(400, 'Slide index out of bounds', 'INVALID_INDEX');
    }

    slides[slideIndex] = { ...slides[slideIndex], ...input.slide };

    return prisma.presentation.update({
      where: { id: presentationId },
      data: { slides: slides as Prisma.InputJsonValue },
    });
  }

  async deleteSlide(userId: string, presentationId: string, slideIndex: number) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    const slides = (presentation.slides as unknown[]) || [];

    if (slideIndex < 0 || slideIndex >= slides.length) {
      throw new AppError(400, 'Slide index out of bounds', 'INVALID_INDEX');
    }

    slides.splice(slideIndex, 1);

    return prisma.presentation.update({
      where: { id: presentationId },
      data: { slides: slides as Prisma.InputJsonValue },
    });
  }

  async reorderSlides(userId: string, presentationId: string, input: ReorderSlidesInput) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    const slides = (presentation.slides as unknown[]) || [];

    if (input.order.length !== slides.length) {
      throw new AppError(400, 'Order array must match the number of slides', 'INVALID_ORDER');
    }

    const indices = new Set(input.order);
    if (indices.size !== slides.length || input.order.some((i) => i < 0 || i >= slides.length)) {
      throw new AppError(400, 'Order array must contain each index exactly once', 'INVALID_ORDER');
    }

    const reordered = input.order.map((i) => slides[i]);

    return prisma.presentation.update({
      where: { id: presentationId },
      data: { slides: reordered as Prisma.InputJsonValue },
    });
  }

  async duplicateSlide(userId: string, presentationId: string, slideIndex: number) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    const slides = (presentation.slides as unknown[]) || [];

    if (slideIndex < 0 || slideIndex >= slides.length) {
      throw new AppError(400, 'Slide index out of bounds', 'INVALID_INDEX');
    }

    const clonedSlide = JSON.parse(JSON.stringify(slides[slideIndex]));
    slides.splice(slideIndex + 1, 0, clonedSlide);

    return prisma.presentation.update({
      where: { id: presentationId },
      data: { slides: slides as Prisma.InputJsonValue },
    });
  }

  async duplicate(userId: string, presentationId: string) {
    const presentation = await prisma.presentation.findFirst({
      where: { id: presentationId, userId },
    });

    if (!presentation) {
      throw new AppError(404, 'Presentation not found', 'NOT_FOUND');
    }

    return prisma.presentation.create({
      data: {
        userId,
        title: `${presentation.title} (copy)`,
        theme: presentation.theme,
        slideSize: presentation.slideSize,
        slides: (presentation.slides ?? []) as Prisma.InputJsonValue,
        isPublic: false,
      },
    });
  }
}

export const presentationService = new PresentationService();
