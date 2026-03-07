import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { config } from '../../config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import type { CreateFolderInput, FilesQuery } from './files.schema';

export class FilesService {
  private getStorageDir(userId: string): string {
    return path.resolve(config.storage.path, 'users', userId);
  }

  async createFolder(userId: string, input: CreateFolderInput) {
    if (input.parentFolderId) {
      const parent = await prisma.file.findFirst({
        where: { id: input.parentFolderId, userId, type: 'FOLDER', isTrashed: false },
      });
      if (!parent) throw new AppError(404, 'Parent folder not found', 'NOT_FOUND');
    }

    return prisma.file.create({
      data: {
        userId,
        name: input.name,
        type: 'FOLDER',
        parentFolderId: input.parentFolderId,
      },
    });
  }

  async uploadFile(
    userId: string,
    file: { originalname: string; mimetype: string; size: number; path: string; filename: string },
    parentFolderId?: string | null
  ) {
    // Check storage quota
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    if (Number(user.storageUsed) + file.size > Number(user.storageQuota)) {
      throw new AppError(400, 'Storage quota exceeded', 'QUOTA_EXCEEDED');
    }

    if (parentFolderId) {
      const parent = await prisma.file.findFirst({
        where: { id: parentFolderId, userId, type: 'FOLDER', isTrashed: false },
      });
      if (!parent) throw new AppError(404, 'Parent folder not found', 'NOT_FOUND');
    }

    const storagePath = `/users/${userId}/${file.filename}`;

    const dbFile = await prisma.file.create({
      data: {
        userId,
        name: file.originalname,
        type: 'FILE',
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        storagePath,
        parentFolderId,
      },
    });

    // Create initial version
    await prisma.fileVersion.create({
      data: {
        fileId: dbFile.id,
        versionNumber: 1,
        storagePath,
        sizeBytes: BigInt(file.size),
        uploadedById: userId,
      },
    });

    // Update user storage used
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: BigInt(file.size) } },
    });

    return { ...dbFile, sizeBytes: Number(dbFile.sizeBytes) };
  }

  async getFiles(userId: string, query: FilesQuery) {
    const where: Record<string, unknown> = { userId };

    if (query.trashed) {
      where.isTrashed = true;
    } else if (query.starred) {
      where.isStarred = true;
      where.isTrashed = false;
    } else if (query.recent) {
      where.isTrashed = false;
      where.type = 'FILE';
    } else {
      where.isTrashed = false;
      where.parentFolderId = query.parentFolderId || null;
    }

    if (query.type) where.type = query.type;

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          shares: { select: { id: true, sharedWithUserId: true, permission: true } },
        },
      }),
      prisma.file.count({ where }),
    ]);

    return {
      files: files.map((f) => ({ ...f, sizeBytes: f.sizeBytes ? Number(f.sizeBytes) : null })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        hasMore: query.page * query.limit < total,
      },
    };
  }

  async getFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [
          { userId },
          { shares: { some: { sharedWithUserId: userId } } },
        ],
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        shares: {
          include: { file: { select: { name: true } } },
        },
      },
    });

    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');
    return { ...file, sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null };
  }

  async renameFile(userId: string, fileId: string, name: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    return prisma.file.update({ where: { id: fileId }, data: { name } });
  }

  async moveFile(userId: string, fileId: string, parentFolderId: string | null) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    if (parentFolderId) {
      const parent = await prisma.file.findFirst({
        where: { id: parentFolderId, userId, type: 'FOLDER' },
      });
      if (!parent) throw new AppError(404, 'Target folder not found', 'NOT_FOUND');

      // Prevent moving folder into itself or its children
      if (file.type === 'FOLDER') {
        let current = parentFolderId;
        while (current) {
          if (current === fileId) {
            throw new AppError(400, 'Cannot move folder into itself', 'CIRCULAR_MOVE');
          }
          const folder = await prisma.file.findUnique({
            where: { id: current },
            select: { parentFolderId: true },
          });
          current = folder?.parentFolderId || '';
          if (!folder?.parentFolderId) break;
        }
      }
    }

    return prisma.file.update({ where: { id: fileId }, data: { parentFolderId } });
  }

  async toggleStar(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    return prisma.file.update({
      where: { id: fileId },
      data: { isStarred: !file.isStarred },
    });
  }

  async trashFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    return prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: true, trashedAt: new Date() },
    });
  }

  async restoreFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isTrashed: true } });
    if (!file) throw new AppError(404, 'File not found in trash', 'NOT_FOUND');

    return prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: false, trashedAt: null },
    });
  }

  async permanentDelete(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    // Delete physical file
    if (file.storagePath) {
      const fullPath = path.resolve(config.storage.path, file.storagePath.replace(/^\//, ''));
      try {
        await fs.unlink(fullPath);
      } catch {
        // File might already be deleted
      }
    }

    // Delete versions' physical files
    const versions = await prisma.fileVersion.findMany({ where: { fileId } });
    for (const version of versions) {
      const fullPath = path.resolve(config.storage.path, version.storagePath.replace(/^\//, ''));
      try {
        await fs.unlink(fullPath);
      } catch {
        // Continue
      }
    }

    // Update storage used
    if (file.sizeBytes) {
      await prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { decrement: file.sizeBytes } },
      });
    }

    await prisma.file.delete({ where: { id: fileId } });
  }

  async shareFile(
    userId: string,
    fileId: string,
    input: { sharedWithUserId?: string; permission: 'VIEW' | 'EDIT'; password?: string; expiresAt?: string; generateLink?: boolean }
  ) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    const data: Record<string, unknown> = {
      fileId,
      permission: input.permission,
    };

    if (input.sharedWithUserId) {
      data.sharedWithUserId = input.sharedWithUserId;
    }

    if (input.generateLink) {
      data.shareLinkToken = uuidv4();
    }

    if (input.password) {
      const bcrypt = await import('bcrypt');
      data.passwordHash = await bcrypt.hash(input.password, 12);
    }

    if (input.expiresAt) {
      data.expiresAt = new Date(input.expiresAt);
    }

    return prisma.fileShare.create({ data: data as never });
  }

  async getSharedFile(token: string, password?: string) {
    const share = await prisma.fileShare.findUnique({
      where: { shareLinkToken: token },
      include: { file: true },
    });

    if (!share) throw new AppError(404, 'Share not found', 'NOT_FOUND');

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new AppError(410, 'Share link has expired', 'LINK_EXPIRED');
    }

    if (share.passwordHash) {
      if (!password) throw new AppError(401, 'Password required', 'PASSWORD_REQUIRED');
      const bcrypt = await import('bcrypt');
      const valid = await bcrypt.compare(password, share.passwordHash);
      if (!valid) throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');
    }

    return { ...share.file, sizeBytes: share.file.sizeBytes ? Number(share.file.sizeBytes) : null };
  }

  async uploadNewVersion(userId: string, fileId: string, file: { mimetype: string; size: number; filename: string }) {
    const existing = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!existing) throw new AppError(404, 'File not found', 'NOT_FOUND');

    const lastVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    const storagePath = `/users/${userId}/${file.filename}`;
    const newVersion = (lastVersion?.versionNumber || 0) + 1;

    await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: newVersion,
        storagePath,
        sizeBytes: BigInt(file.size),
        uploadedById: userId,
      },
    });

    // Update file record
    const oldSize = existing.sizeBytes || BigInt(0);
    await prisma.file.update({
      where: { id: fileId },
      data: {
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        storagePath,
      },
    });

    // Update storage usage
    const sizeDiff = BigInt(file.size) - oldSize;
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: sizeDiff } },
    });

    return { versionNumber: newVersion };
  }

  async getVersions(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND');

    return prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async getBreadcrumbs(userId: string, folderId: string | null) {
    const crumbs: Array<{ id: string; name: string }> = [];
    let currentId = folderId;

    while (currentId) {
      const folder = await prisma.file.findFirst({
        where: { id: currentId, userId, type: 'FOLDER' },
        select: { id: true, name: true, parentFolderId: true },
      });
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentFolderId;
    }

    return crumbs;
  }

  async bulkOperation(
    userId: string,
    fileIds: string[],
    action: string,
    targetFolderId?: string | null
  ) {
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, userId },
    });

    if (files.length !== fileIds.length) {
      throw new AppError(400, 'Some files not found', 'NOT_FOUND');
    }

    switch (action) {
      case 'delete':
        await prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { isTrashed: true, trashedAt: new Date() },
        });
        break;
      case 'restore':
        await prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { isTrashed: false, trashedAt: null },
        });
        break;
      case 'permanentDelete':
        for (const id of fileIds) {
          await this.permanentDelete(userId, id);
        }
        break;
      case 'star':
        await prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { isStarred: true },
        });
        break;
      case 'unstar':
        await prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { isStarred: false },
        });
        break;
      case 'move':
        await prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { parentFolderId: targetFolderId || null },
        });
        break;
    }

    return { affected: files.length };
  }

  async getStorageUsage(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    return {
      used: Number(user.storageUsed),
      quota: Number(user.storageQuota),
      percentage: Math.round((Number(user.storageUsed) / Number(user.storageQuota)) * 100),
    };
  }
}

export const filesService = new FilesService();
