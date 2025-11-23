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

  app.use(helmet());
  app.use(cors(serverConfig.cors));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestIdMiddleware);

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND'
      }
    });
  });

  app.use(errorMiddleware);

  logger.info('Express app initialized');

  return app;
}
