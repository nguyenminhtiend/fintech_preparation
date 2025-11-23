import { Router } from 'express';

import { type AccountController } from '../controllers/account.controller';

export function createAccountRouter(controller: AccountController): Router {
  const router = Router();

  // POST /accounts - Create new account
  router.post('/', controller.createAccount);

  // GET /accounts/:id/balance - Get account balance
  router.get('/:id/balance', controller.getAccountBalance);

  return router;
}
