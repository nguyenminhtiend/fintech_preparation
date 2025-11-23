// apps/backend/src/shared/middleware/error.middleware.ts
import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.util.js';
import { AppError } from '../utils/error-handler.util.js';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.warn({ errors: (error as any).errors, path: req.path }, 'Validation error');
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: (error as any).errors
      }
    });
    return;
  }

  // Custom app errors
  if (error instanceof AppError) {
    logger.warn(
      {
        message: error.message,
        code: error.code,
        path: req.path
      },
      'Application error'
    );
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code
      }
    });
    return;
  }

  // Unknown errors
  logger.error(
    {
      message: error.message,
      stack: error.stack,
      path: req.path
    },
    'Unexpected error'
  );
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
}
