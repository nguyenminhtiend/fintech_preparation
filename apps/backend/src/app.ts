// apps/backend/src/app.ts
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './shared/middleware/error.middleware.js';
import { requestIdMiddleware } from './shared/middleware/request-id.middleware.js';
import { getServerConfig } from './shared/config/server.config.js';
import { logger } from './shared/utils/logger.util.js';

export function createApp(): Express {
  const app = express();
  const serverConfig = getServerConfig();

  // Security middleware
  app.use(helmet());
  app.use(cors(serverConfig.cors));

  // Request parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom middleware
  app.use(requestIdMiddleware);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API routes will be registered here
  // Example: app.use('/api/accounts', accountRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND'
      }
    });
  });

  // Global error handler (must be last)
  app.use(errorMiddleware);

  logger.info('Express app initialized');

  return app;
}
