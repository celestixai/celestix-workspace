import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateExportJobInput,
} from './video-editor.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

export class VideoEditorService {
  // ==================================
  // PROJECT CRUD
  // ==================================

  async createProject(userId: string, input: CreateProjectInput) {
    const project = await prisma.videoProject.create({
      data: {
        userId,
        title: input.title,
        aspectRatio: input.aspectRatio ?? '16:9',
        timeline: input.timeline ?? { tracks: [], duration: 0 },
      },
      include: {
        user: { select: userSelect },
        _count: { select: { exportJobs: true } },
      },
    });

    return project;
  }

  async getProjects(userId: string) {
    const projects = await prisma.videoProject.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
        _count: { select: { exportJobs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects;
  }

  async getProjectById(userId: string, projectId: string) {
    const project = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
      include: {
        user: { select: userSelect },
        exportJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!project) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    return project;
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
    const existing = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    const project = await prisma.videoProject.update({
      where: { id: projectId },
      data: {
        title: input.title,
        aspectRatio: input.aspectRatio,
        timeline: input.timeline,
      },
      include: {
        user: { select: userSelect },
        _count: { select: { exportJobs: true } },
      },
    });

    return project;
  }

  async deleteProject(userId: string, projectId: string) {
    const existing = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    await prisma.videoProject.delete({ where: { id: projectId } });
  }

  // ==================================
  // EXPORT JOBS
  // ==================================

  async createExportJob(userId: string, projectId: string, input: CreateExportJobInput) {
    const project = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    const exportJob = await prisma.exportJob.create({
      data: {
        projectId,
        status: 'queued',
        resolution: input.resolution ?? '1080p',
        format: input.format ?? 'mp4',
      },
      include: {
        project: { select: { id: true, title: true } },
      },
    });

    return exportJob;
  }

  async getExportJobs(userId: string, projectId: string) {
    const project = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    const exportJobs = await prisma.exportJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return exportJobs;
  }

  async getExportJob(userId: string, projectId: string, jobId: string) {
    const project = await prisma.videoProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new AppError(404, 'Video project not found', 'NOT_FOUND');
    }

    const exportJob = await prisma.exportJob.findFirst({
      where: { id: jobId, projectId },
      include: {
        project: { select: { id: true, title: true } },
      },
    });

    if (!exportJob) {
      throw new AppError(404, 'Export job not found', 'NOT_FOUND');
    }

    return exportJob;
  }
}

export const videoEditorService = new VideoEditorService();
