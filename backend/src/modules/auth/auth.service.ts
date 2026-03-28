import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import type { RegisterInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from './auth.schema';
import type { JwtPayload } from '../../middleware/auth';

const SALT_ROUNDS = 12;

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
    if (existingUsername) {
      throw new AppError(409, 'Username already taken', 'USERNAME_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        displayName: input.displayName,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Create default calendar
    await prisma.calendar.create({
      data: {
        userId: user.id,
        name: 'Personal',
        color: '#4F8EF7',
        isDefault: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return { user, ...tokens };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email, deletedAt: null },
    });

    if (!user) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.is2FAEnabled && user.totpSecret) {
      if (!input.totpCode) {
        throw new AppError(403, '2FA code required', 'TOTP_REQUIRED');
      }
      const valid = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: input.totpCode,
        window: 1,
      });
      if (!valid) {
        throw new AppError(401, 'Invalid 2FA code', 'INVALID_TOTP');
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, input.rememberMe);

    const { passwordHash: _, totpSecret: __, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async generateTokens(userId: string, email: string, rememberMe = false) {
    const payload: JwtPayload = { userId, email };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, {
      expiresIn: (rememberMe ? config.jwt.refreshExpiresIn : '7d') as jwt.SignOptions['expiresIn'],
    });

    // Store session
    const sessionId = uuidv4();
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.userId, deletedAt: null },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new AppError(401, 'User not found', 'UNAUTHORIZED');
      }

      return this.generateTokens(user.id, user.email);
    } catch {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_TOKEN');
    }
  }

  async logout(userId: string, token: string) {
    await prisma.session.deleteMany({ where: { userId, token } });
    await redis.del(`presence:${userId}`);
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        timezone: true,
        language: true,
        status: true,
        customStatus: true,
        customStatusEmoji: true,
        isAdmin: true,
        is2FAEnabled: true,
        theme: true,
        accentColor: true,
        fontSize: true,
        compactMode: true,
        showOnlineStatus: true,
        showReadReceipts: true,
        showLastSeen: true,
        storageUsed: true,
        storageQuota: true,
        navOrder: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'NOT_FOUND');
    }

    return {
      ...user,
      storageUsed: Number(user.storageUsed),
      storageQuota: Number(user.storageQuota),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        timezone: true,
        language: true,
        theme: true,
        accentColor: true,
        fontSize: true,
        compactMode: true,
        showOnlineStatus: true,
        showReadReceipts: true,
        showLastSeen: true,
        customStatus: true,
        customStatusEmoji: true,
        navOrder: true,
      },
    });
    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'User not found', 'NOT_FOUND');
    }

    const validPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Current password is incorrect', 'INVALID_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { userId } });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // Don't reveal if email exists

    const resetToken = uuidv4();
    await redis.set(`password-reset:${resetToken}`, user.id, 'EX', 3600);

    // In production, send email with reset link
    // For now, log the token
    return { resetToken };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await redis.get(`password-reset:${token}`);
    if (!userId) {
      throw new AppError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await redis.del(`password-reset:${token}`);
    await prisma.session.deleteMany({ where: { userId } });
  }

  async setup2FA(userId: string) {
    const secret = speakeasy.generateSecret({
      name: `${config.totp.issuer}`,
      issuer: config.totp.issuer,
    });

    // Store secret temporarily until verified
    await redis.set(`totp-setup:${userId}`, secret.base32, 'EX', 600);

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
    };
  }

  async verify2FA(userId: string, totpCode: string) {
    const secret = await redis.get(`totp-setup:${userId}`);
    if (!secret) {
      throw new AppError(400, '2FA setup expired, please start again', 'TOTP_EXPIRED');
    }

    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!valid) {
      throw new AppError(400, 'Invalid 2FA code', 'INVALID_TOTP');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { is2FAEnabled: true, totpSecret: secret },
    });

    await redis.del(`totp-setup:${userId}`);
    return { enabled: true };
  }

  async disable2FA(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new AppError(400, '2FA is not enabled', 'TOTP_NOT_ENABLED');
    }

    const valid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!valid) {
      throw new AppError(400, 'Invalid 2FA code', 'INVALID_TOTP');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { is2FAEnabled: false, totpSecret: null },
    });

    return { enabled: false };
  }

  async getSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  async getUsers(search?: string) {
    const where = search
      ? {
          deletedAt: null,
          OR: [
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : { deletedAt: null };

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        customStatus: true,
        customStatusEmoji: true,
        lastSeenAt: true,
      },
      take: 50,
      orderBy: { displayName: 'asc' },
    });
  }
}

export const authService = new AuthService();
