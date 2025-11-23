import { Router } from 'express';

import { type AccountController } from '../controllers/account.controller';

export function createAccountRouter(controller: AccountController): Router {
  const router = Router();

  router.post('/', controller.createAccount);

  router.get('/:id/balance', controller.getAccountBalance);

  return router;
}
