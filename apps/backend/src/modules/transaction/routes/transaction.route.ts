import { type Router } from 'express';

import { createRouterFromOpenApi } from '@shared/utils';

import { type TransactionController } from '../controllers';
import {
  transactionHistoryQuerySchema,
  transactionHistoryResponseSchema,
} from '../schemas/transaction-history.schema';
import { transferResponseSchema, transferSchema } from '../schemas/transfer.schema';

// OpenAPI route definitions
export const openApiRoutes = [
  {
    method: 'post' as const,
    path: '/transfer',
    tags: ['Transactions'],
    summary: 'Transfer funds between accounts',
    handler: 'transfer',
    request: { body: transferSchema },
    responses: {
      200: { schema: transferResponseSchema, description: 'Transfer completed successfully' },
      400: { description: 'Invalid request' },
      409: { description: 'Conflict - insufficient funds or duplicate request' },
    },
  },
  {
    method: 'get' as const,
    path: '/history',
    tags: ['Transactions'],
    summary: 'Get transaction history for an account',
    handler: 'getTransactionHistory',
    request: { query: transactionHistoryQuerySchema },
    responses: {
      200: {
        schema: transactionHistoryResponseSchema,
        description: 'Transaction history retrieved successfully',
      },
      400: { description: 'Invalid request' },
      404: { description: 'Account not found' },
    },
  },
] as const;

export function createTransactionRoutes(controller: TransactionController): Router {
  return createRouterFromOpenApi(openApiRoutes, controller);
}
