import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { createAccountModule } from './modules/account/account.module';
import { createTransactionModule } from './modules/transaction/transaction.module';
import { getServerConfig } from './shared/config';
import { createDatabase } from './shared/database';
import { errorMiddleware } from './shared/middleware';
import { healthRoute, notFoundRoute } from './shared/routes';
import { logger } from './shared/utils';

export function createApp(): Express {
  const app = express();
  const serverConfig = getServerConfig();
  const db = createDatabase();

  app.use(helmet());
  app.use(cors(serverConfig.cors));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  healthRoute(app);

  // Modules
  const { accountRouter, accountRepository } = createAccountModule(db);
  const { transactionRouter } = createTransactionModule(db, accountRepository);

  app.use('/accounts', accountRouter);
  app.use('/transactions', transactionRouter);

  app.use(notFoundRoute);

  app.use(errorMiddleware);

  logger.info('Express app initialized');

  return app;
}
