import { type Database } from '@shared/database';

import { AccountController } from './controllers';
import { AccountRepository } from './repositories';
import { createAccountRouter } from './routes';
import { AccountService } from './services';

export function createAccountModule(db: Database) {
  const accountRepository = new AccountRepository(db);
  const accountService = new AccountService(accountRepository);
  const accountController = new AccountController(accountService);
  const accountRouter = createAccountRouter(accountController);

  return {
    accountRouter,
    accountService,
    accountRepository,
  };
}
