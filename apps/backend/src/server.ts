// apps/backend/src/server.ts
import { createApp } from './app.js';
import { createDatabase, disconnectDatabase } from './shared/database/index.js';
import { getServerConfig } from './shared/config/server.config.js';
import { logger } from './shared/utils/logger.util.js';
import { env } from './shared/config/environment.config.js';

async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    const db = createDatabase();
    logger.info('Database connection initialized');

    // Test database connection
    await db.$connect();
    logger.info('Database connection verified');

    // Create Express app
    const app = createApp();
    const config = getServerConfig();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port} in ${env.NODE_ENV} mode`);
      logger.info(`📊 Health check available at http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down gracefully...');

      server.close(async () => {
        logger.info('HTTP server closed');

        await disconnectDatabase();
        logger.info('Database connection closed');

        process.exit(0);
      });

      // Force shutdown after 10 seconds
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

// Start the server
startServer();
