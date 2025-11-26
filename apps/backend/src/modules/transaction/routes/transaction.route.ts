import { Router } from 'express';

import { validateBody } from '@shared/middleware';

import { type TransactionController } from '../controllers';
import { transferSchema } from '../schemas';

export function createTransactionRoutes(controller: TransactionController): Router {
  const router = Router();

  router.post('/transfer', validateBody(transferSchema), controller.transfer);

  return router;
}
