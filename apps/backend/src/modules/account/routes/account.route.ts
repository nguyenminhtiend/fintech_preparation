import { z } from 'zod';

import { createRouterFromOpenApi, type OpenApiRouteMetadata } from '@shared/utils';

import { type AccountController } from '../controllers';
import {
  accountResponseSchema,
  balanceResponseSchema,
  createAccountSchema,
} from '../schemas/account.schema';

export function createAccountRouter(controller: AccountController) {
  const routes = [
    {
      method: 'post' as const,
      path: '/accounts',
      tags: ['Accounts'] as const,
      summary: 'Create a new account',
      handler: controller.createAccount,
      request: { body: createAccountSchema },
      responses: {
        201: { schema: accountResponseSchema, description: 'Account created successfully' },
        400: { description: 'Invalid request' },
      },
    },
    {
      method: 'get' as const,
      path: '/accounts/{id}/balance',
      tags: ['Accounts'] as const,
      summary: 'Get account balance',
      handler: controller.getAccountBalance,
      request: {
        params: z.object({
          id: z.uuid('Invalid account ID format'),
        }),
      },
      responses: {
        200: { schema: balanceResponseSchema, description: 'Account balance retrieved' },
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
