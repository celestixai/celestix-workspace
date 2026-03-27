import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: errors,
    });
    return;
  }

  // Handle Prisma errors with proper HTTP responses
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ err, code: err.code }, 'Prisma known error');
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        res.status(409).json({ success: false, error: 'Resource already exists', code: 'CONFLICT' });
        return;
      case 'P2003': // Foreign key constraint violation
        res.status(400).json({ success: false, error: 'Referenced resource not found', code: 'INVALID_REFERENCE' });
        return;
      case 'P2025': // Record not found
        res.status(404).json({ success: false, error: 'Resource not found', code: 'NOT_FOUND' });
        return;
      default:
        res.status(500).json({ success: false, error: 'Database error', code: 'DB_ERROR' });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ err }, 'Prisma validation error');
    res.status(400).json({ success: false, error: 'Invalid data provided', code: 'VALIDATION_ERROR' });
    return;
  }

  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
  });
}
