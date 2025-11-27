import { Router } from 'express';

import { validateBody, validateQuery } from '@shared/middleware';

import { type TransactionController } from '../controllers';
import { transactionHistoryQuerySchema, transferSchema } from '../schemas';

export function createTransactionRoutes(controller: TransactionController): Router {
  const router = Router();

  router.post('/transfer', validateBody(transferSchema), controller.transfer);
  router.get(
    '/history',
    validateQuery(transactionHistoryQuerySchema),
    controller.getTransactionHistory,
  );

  return router;
}
