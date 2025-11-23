import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware, requestIdMiddleware } from './shared/middleware';
import { getServerConfig } from './shared/config';
import { logger } from './shared/utils';
import { healthRoute, notFoundRoute } from './shared/routes';

export function createApp(): Express {
  const app = express();
  const serverConfig = getServerConfig();

  app.use(helmet());
  app.use(cors(serverConfig.cors));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestIdMiddleware);

  healthRoute(app);

  app.use(notFoundRoute);

  app.use(errorMiddleware);

  logger.info('Express app initialized');

  return app;
}
