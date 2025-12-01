import { type RequestHandler, Router } from 'express';
import { type ZodSchema } from 'zod';

import { validateBody, validateParams, validateQuery } from '@shared/middleware';

interface OpenApiRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tags: readonly string[];
  summary: string;
  handler: string;
  request?: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
  };
  responses: Record<number, { schema?: ZodSchema; description: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRouterFromOpenApi<T extends Record<string, any>>(
  routes: readonly OpenApiRoute[],
  controller: T,
): Router {
  const router = Router();

  routes.forEach((route) => {
    const middlewares = [];

    if (route.request?.body) {
      middlewares.push(validateBody(route.request.body));
    }
    if (route.request?.params) {
      middlewares.push(validateParams(route.request.params));
    }
    if (route.request?.query) {
      middlewares.push(validateQuery(route.request.query));
    }

    // Convert OpenAPI format {id} to Express format :id
    const expressPath = route.path.replace(/\{(\w+)\}/g, ':$1');

    const handler = controller[route.handler as keyof T];
    if (!handler || typeof handler !== 'function') {
      throw new Error(
        `Handler '${route.handler}' not found on controller for route ${route.method.toUpperCase()} ${route.path}`,
      );
    }

    router[route.method](expressPath, ...middlewares, handler as RequestHandler);
  });

  return router;
}
