import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { AppError } from './error-handler';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        isAdmin: boolean;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : cookieToken;

  if (!token) {
    throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      select: { id: true, email: true, displayName: true, isAdmin: true },
    }).then((user) => {
      if (!user) {
        next(new AppError(401, 'User not found', 'UNAUTHORIZED'));
        return;
      }
      req.user = user;
      next();
    }).catch(next);
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}
