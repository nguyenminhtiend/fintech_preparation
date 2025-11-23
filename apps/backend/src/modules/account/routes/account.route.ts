import { validateBody } from '@shared/middleware';
import { Router } from 'express';

import { type AccountController } from '../controllers';
import { createAccountSchema } from '../dto/account.dto';

export function createAccountRouter(controller: AccountController): Router {
  const router = Router();

  router.post('/', validateBody(createAccountSchema), controller.createAccount);

  router.get('/:id/balance', controller.getAccountBalance);

  return router;
}
