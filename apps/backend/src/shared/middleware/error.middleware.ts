import { type NextFunction,type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../utils/error-handler.util.js';
import { logger } from '../utils/logger.util.js';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    logger.warn({ errors: error.issues, path: req.path }, 'Validation error');
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues
      }
    });
    return;
  }

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
