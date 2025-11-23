import { env, getServerConfig } from './shared/config';
import { createDatabase, disconnectDatabase } from './shared/database';
import { logger } from './shared/utils';
import { createApp } from './app.js';

async function startServer(): Promise<void> {
  try {
    const db = createDatabase();
    logger.info('Database connection initialized');

    await db.$connect();
    logger.info('Database connection verified');

    const app = createApp();
    const config = getServerConfig();

    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port} in ${env.NODE_ENV} mode`);
      logger.info(`📊 Health check available at http://localhost:${config.port}/health`);
    });

    const shutdown = (): void => {
      logger.info('Shutting down gracefully...');

      server.close(() => {
        logger.info('HTTP server closed');

        void disconnectDatabase().then(() => {
          logger.info('Database connection closed');
          process.exit(0);
        });
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

void startServer();
