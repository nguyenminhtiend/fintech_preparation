import { type Database } from '@shared/database';

import { AccountController } from './controllers/account.controller';
import { AccountRepository } from './repositories/account.repository';
import { createAccountRouter } from './routes/account.route';
import { AccountService } from './services/account.service';

export function createAccountModule(db: Database) {
  // Build dependency chain (bottom-up)
  const accountRepository = new AccountRepository(db);
  const accountService = new AccountService(accountRepository);
  const accountController = new AccountController(accountService);
  const accountRouter = createAccountRouter(accountController);

  return {
    accountRouter,
    accountService, // Export for other modules if needed
  };
}
