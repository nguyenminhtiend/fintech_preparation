import { type Database } from '@shared/database';

import { type IAccountRepository } from '../account/repositories';

import { TransactionController } from './controllers';
import { LedgerRepository, TransactionRepository, TransferRepository } from './repositories';
import { createTransactionRoutes } from './routes';
import { TransferService } from './services';

export function createTransactionModule(db: Database, accountRepository: IAccountRepository) {
  // Repositories
  const transferRepository = new TransferRepository(db);
  const transactionRepository = new TransactionRepository(db);
  const ledgerRepository = new LedgerRepository(db);

  // Services
  const transferService = new TransferService(
    transferRepository,
    transactionRepository,
    accountRepository,
  );

  // Controllers
  const transactionController = new TransactionController(transferService);

  // Routes
  const transactionRouter = createTransactionRoutes(transactionController);

  return {
    transactionRouter,
    transferService,
    transactionRepository,
    ledgerRepository,
  };
}
