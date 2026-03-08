import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateDesignInput,
  UpdateDesignInput,
  DuplicateDesignInput,
} from './designer.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

// Static list of built-in template configurations
const TEMPLATES = [
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    category: 'social',
    canvasSize: { width: 1080, height: 1080 },
    thumbnail: '/templates/instagram-post.png',
    elements: [],
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    category: 'social',
    canvasSize: { width: 1080, height: 1920 },
    thumbnail: '/templates/instagram-story.png',
    elements: [],
  },
  {
    id: 'facebook-cover',
    name: 'Facebook Cover',
    category: 'social',
    canvasSize: { width: 820, height: 312 },
    thumbnail: '/templates/facebook-cover.png',
    elements: [],
  },
  {
    id: 'presentation-slide',
    name: 'Presentation Slide',
    category: 'presentation',
    canvasSize: { width: 1920, height: 1080 },
    thumbnail: '/templates/presentation-slide.png',
    elements: [],
  },
  {
    id: 'a4-document',
    name: 'A4 Document',
    category: 'print',
    canvasSize: { width: 2480, height: 3508 },
    thumbnail: '/templates/a4-document.png',
    elements: [],
  },
  {
    id: 'business-card',
    name: 'Business Card',
    category: 'print',
    canvasSize: { width: 1050, height: 600 },
    thumbnail: '/templates/business-card.png',
    elements: [],
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube Thumbnail',
    category: 'social',
    canvasSize: { width: 1280, height: 720 },
    thumbnail: '/templates/youtube-thumbnail.png',
    elements: [],
  },
  {
    id: 'email-header',
    name: 'Email Header',
    category: 'marketing',
    canvasSize: { width: 600, height: 200 },
    thumbnail: '/templates/email-header.png',
    elements: [],
  },
  {
    id: 'poster',
    name: 'Poster',
    category: 'print',
    canvasSize: { width: 2400, height: 3600 },
    thumbnail: '/templates/poster.png',
    elements: [],
  },
  {
    id: 'logo',
    name: 'Logo',
    category: 'branding',
    canvasSize: { width: 500, height: 500 },
    thumbnail: '/templates/logo.png',
    elements: [],
  },
];

export class DesignService {
  // ==================================
  // DESIGN CRUD
  // ==================================

  async createDesign(userId: string, input: CreateDesignInput) {
    let canvasSize = input.canvasSize ?? { width: 1080, height: 1080 };
    let elements: unknown[] = [];

    // If a templateId is provided, apply the template's canvas size and elements
    if (input.templateId) {
      const template = TEMPLATES.find((t) => t.id === input.templateId);
      if (template) {
        canvasSize = template.canvasSize;
        elements = template.elements;
      }
    }

    const design = await prisma.design.create({
      data: {
        userId,
        title: input.title,
        canvasSize,
        elements,
        templateId: input.templateId,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return design;
  }

  async getDesigns(userId: string) {
    const designs = await prisma.design.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return designs;
  }

  async getDesignById(userId: string, designId: string) {
    const design = await prisma.design.findFirst({
      where: { id: designId, userId },
      include: {
        user: { select: userSelect },
      },
    });

    if (!design) {
      throw new AppError(404, 'Design not found', 'NOT_FOUND');
    }

    return design;
  }

  async updateDesign(userId: string, designId: string, input: UpdateDesignInput) {
    const existing = await prisma.design.findFirst({
      where: { id: designId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Design not found', 'NOT_FOUND');
    }

    const design = await prisma.design.update({
      where: { id: designId },
      data: {
        title: input.title,
        elements: input.elements,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return design;
  }

  async deleteDesign(userId: string, designId: string) {
    const existing = await prisma.design.findFirst({
      where: { id: designId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Design not found', 'NOT_FOUND');
    }

    await prisma.design.delete({ where: { id: designId } });
  }

  // ==================================
  // DUPLICATE
  // ==================================

  async duplicateDesign(userId: string, designId: string, input?: DuplicateDesignInput) {
    const original = await prisma.design.findFirst({
      where: { id: designId, userId },
    });
    if (!original) {
      throw new AppError(404, 'Design not found', 'NOT_FOUND');
    }

    const design = await prisma.design.create({
      data: {
        userId,
        title: input?.title ?? `${original.title} (copy)`,
        canvasSize: original.canvasSize as object,
        elements: original.elements as object,
        templateId: original.templateId,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return design;
  }

  // ==================================
  // TEMPLATES
  // ==================================

  getTemplates() {
    return TEMPLATES;
  }
}

export const designService = new DesignService();
