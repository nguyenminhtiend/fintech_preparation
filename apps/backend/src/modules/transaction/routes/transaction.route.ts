import { createRouterFromOpenApi, type OpenApiRouteMetadata } from '@shared/utils';

import { type TransactionController } from '../controllers';
import {
  transactionHistoryQuerySchema,
  transactionHistoryResponseSchema,
} from '../schemas/transaction-history.schema';
import { transferResponseSchema, transferSchema } from '../schemas/transfer.schema';

export const BASE_PATH = '/transactions';

export function createRouter(controller: TransactionController) {
  const routes = [
    {
      method: 'post' as const,
      path: `${BASE_PATH}/transfer`,
      tags: ['Transactions'] as const,
      summary: 'Transfer funds between accounts',
      handler: controller.transfer,
      request: { body: transferSchema },
      responses: {
        200: { schema: transferResponseSchema, description: 'Transfer completed successfully' },
        400: { description: 'Invalid request' },
        409: { description: 'Conflict - insufficient funds or duplicate request' },
      },
    },
    {
      method: 'get' as const,
      path: `${BASE_PATH}/history`,
      tags: ['Transactions'] as const,
      summary: 'Get transaction history for an account',
      handler: controller.getTransactionHistory,
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

  const router = createRouterFromOpenApi(routes);

  const metadata: readonly OpenApiRouteMetadata[] = routes.map(
    ({ handler: _handler, ...route }) => route,
  );

  return { router, metadata };
}
