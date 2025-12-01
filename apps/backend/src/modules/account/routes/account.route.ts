import { type Router } from 'express';
import { z } from 'zod';

import { createRouterFromOpenApi } from '@shared/utils';

import { type AccountController } from '../controllers';
import {
  accountResponseSchema,
  balanceResponseSchema,
  createAccountSchema,
} from '../schemas/account.schema';

// OpenAPI route definitions
export const openApiRoutes = [
  {
    method: 'post' as const,
    path: '/accounts',
    tags: ['Accounts'],
    summary: 'Create a new account',
    handler: 'createAccount',
    request: { body: createAccountSchema },
    responses: {
      201: { schema: accountResponseSchema, description: 'Account created successfully' },
      400: { description: 'Invalid request' },
    },
  },
  {
    method: 'get' as const,
    path: '/accounts/{id}/balance',
    tags: ['Accounts'],
    summary: 'Get account balance',
    handler: 'getAccountBalance',
    request: {
      params: z.object({
        id: z.string().uuid('Invalid account ID format'),
      }),
    },
    responses: {
      200: { schema: balanceResponseSchema, description: 'Account balance retrieved' },
      404: { description: 'Account not found' },
    },
  },
] as const;

export function createAccountRouter(controller: AccountController): Router {
  return createRouterFromOpenApi(openApiRoutes, controller);
}
