import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateAnnotationInput,
  UpdateAnnotationInput,
  MergeFilesInput,
  SplitFileInput,
  RotatePagesInput,
  AddWatermarkInput,
  CompressInput,
  ProtectInput,
} from './pdf.schema';

export class PdfService {
  // ==============================
  // ANNOTATIONS
  // ==============================

  async createAnnotation(userId: string, input: CreateAnnotationInput) {
    return prisma.pdfAnnotation.create({
      data: {
        fileId: input.fileId,
        userId,
        pageNumber: input.pageNumber,
        type: input.type,
        data: input.data as Prisma.InputJsonValue,
      },
    });
  }

  async getAnnotations(userId: string, fileId: string) {
    return prisma.pdfAnnotation.findMany({
      where: { fileId, userId },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getAnnotationsByPage(userId: string, fileId: string, pageNumber: number) {
    return prisma.pdfAnnotation.findMany({
      where: { fileId, userId, pageNumber },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateAnnotation(userId: string, annotationId: string, input: UpdateAnnotationInput) {
    const annotation = await prisma.pdfAnnotation.findFirst({
      where: { id: annotationId, userId },
    });

    if (!annotation) {
      throw new AppError(404, 'Annotation not found', 'NOT_FOUND');
    }

    return prisma.pdfAnnotation.update({
      where: { id: annotationId },
      data: {
        type: input.type,
        data: (input.data as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async deleteAnnotation(userId: string, annotationId: string) {
    const annotation = await prisma.pdfAnnotation.findFirst({
      where: { id: annotationId, userId },
    });

    if (!annotation) {
      throw new AppError(404, 'Annotation not found', 'NOT_FOUND');
    }

    await prisma.pdfAnnotation.delete({ where: { id: annotationId } });
  }

  // ==============================
  // PDF OPERATIONS (queued)
  // ==============================

  async merge(userId: string, input: MergeFilesInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'merge',
      params: {
        fileIds: input.fileIds,
        outputName: input.outputName,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  async split(userId: string, input: SplitFileInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'split',
      params: {
        fileId: input.fileId,
        ranges: input.ranges,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  async rotate(userId: string, input: RotatePagesInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'rotate',
      params: {
        fileId: input.fileId,
        pages: input.pages,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  async addWatermark(userId: string, input: AddWatermarkInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'watermark',
      params: {
        fileId: input.fileId,
        type: input.type,
        text: input.text,
        imageFileId: input.imageFileId,
        position: input.position,
        opacity: input.opacity,
        fontSize: input.fontSize,
        rotation: input.rotation,
        pages: input.pages,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  async compress(userId: string, input: CompressInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'compress',
      params: {
        fileId: input.fileId,
        quality: input.quality,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  async protect(userId: string, input: ProtectInput) {
    const operationId = uuidv4();

    return {
      status: 'queued' as const,
      operationId,
      operation: 'protect',
      params: {
        fileId: input.fileId,
        permissions: input.permissions,
      },
      userId,
      createdAt: new Date().toISOString(),
    };
  }
}

export const pdfService = new PdfService();
