import { Router } from 'express';

import { validateBody } from '@shared/middleware';

import { type AccountController } from '../controllers';
import { createAccountSchema } from '../schemas/account.schema';

export function createAccountRouter(controller: AccountController): Router {
  const router = Router();

  router.post('/', validateBody(createAccountSchema), controller.createAccount);

  router.get('/:id/balance', controller.getAccountBalance);

  return router;
}
