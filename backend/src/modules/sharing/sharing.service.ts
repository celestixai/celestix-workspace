import { SharePermission } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

// ==========================================
// Shared Items
// ==========================================

async function shareItem(
  userId: string,
  itemType: string,
  itemId: string,
  targetUserIds: string[],
  permission: SharePermission = 'VIEW',
) {
  // Create SharedItem records, skipping duplicates
  const results = [];
  for (const targetUserId of targetUserIds) {
    // Skip sharing with self
    if (targetUserId === userId) continue;

    const existing = await prisma.sharedItem.findUnique({
      where: {
        itemType_itemId_sharedWithUserId: {
          itemType,
          itemId,
          sharedWithUserId: targetUserId,
        },
      },
    });

    if (existing) continue;

    const shared = await prisma.sharedItem.create({
      data: {
        itemType,
        itemId,
        sharedWithUserId: targetUserId,
        permission,
        sharedById: userId,
      },
      include: {
        sharedWithUser: { select: userSelect },
        sharedBy: { select: userSelect },
      },
    });
    results.push(shared);
  }

  return results;
}

async function getShares(itemType: string, itemId: string) {
  const shares = await prisma.sharedItem.findMany({
    where: { itemType, itemId },
    include: {
      sharedWithUser: { select: userSelect },
      sharedBy: { select: userSelect },
    },
    orderBy: { createdAt: 'asc' },
  });

  return shares;
}

async function updateShare(shareId: string, permission: SharePermission) {
  const share = await prisma.sharedItem.findUnique({ where: { id: shareId } });
  if (!share) {
    throw new AppError(404, 'Share not found', 'NOT_FOUND');
  }

  const updated = await prisma.sharedItem.update({
    where: { id: shareId },
    data: { permission },
    include: {
      sharedWithUser: { select: userSelect },
      sharedBy: { select: userSelect },
    },
  });

  return updated;
}

async function removeShare(shareId: string) {
  const share = await prisma.sharedItem.findUnique({ where: { id: shareId } });
  if (!share) {
    throw new AppError(404, 'Share not found', 'NOT_FOUND');
  }

  await prisma.sharedItem.delete({ where: { id: shareId } });
  return { removed: true };
}

// ==========================================
// Public Links
// ==========================================

async function createPublicLink(
  userId: string,
  itemType: string,
  itemId: string,
  permission: SharePermission = 'VIEW',
  password?: string,
  expiresAt?: string,
) {
  let hashedPassword: string | undefined;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  const link = await prisma.publicLink.create({
    data: {
      itemType,
      itemId,
      permission,
      password: hashedPassword,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdById: userId,
    },
    include: {
      createdBy: { select: userSelect },
    },
  });

  return {
    ...link,
    password: undefined, // Never return the hashed password
  };
}

async function accessPublicLink(token: string, password?: string) {
  const link = await prisma.publicLink.findUnique({
    where: { token },
  });

  if (!link || !link.isActive) {
    throw new AppError(404, 'Public link not found or inactive', 'NOT_FOUND');
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new AppError(410, 'Public link has expired', 'LINK_EXPIRED');
  }

  if (link.password) {
    if (!password) {
      throw new AppError(401, 'Password required', 'PASSWORD_REQUIRED');
    }
    const valid = await bcrypt.compare(password, link.password);
    if (!valid) {
      throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');
    }
  }

  return {
    itemType: link.itemType,
    itemId: link.itemId,
    permission: link.permission,
  };
}

async function revokePublicLink(linkId: string, userId: string, isAdmin: boolean) {
  const link = await prisma.publicLink.findUnique({ where: { id: linkId } });

  if (!link) {
    throw new AppError(404, 'Public link not found', 'NOT_FOUND');
  }

  if (link.createdById !== userId && !isAdmin) {
    throw new AppError(403, 'Only the creator or an admin can revoke this link', 'FORBIDDEN');
  }

  const updated = await prisma.publicLink.update({
    where: { id: linkId },
    data: { isActive: false },
  });

  return updated;
}

async function getPublicLinks(itemType: string, itemId: string) {
  const links = await prisma.publicLink.findMany({
    where: { itemType, itemId, isActive: true },
    include: {
      createdBy: { select: userSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Strip password hashes from response
  return links.map((link) => ({
    ...link,
    password: undefined,
    hasPassword: !!link.password,
  }));
}

export const sharingService = {
  shareItem,
  getShares,
  updateShare,
  removeShare,
  createPublicLink,
  accessPublicLink,
  revokePublicLink,
  getPublicLinks,
};
