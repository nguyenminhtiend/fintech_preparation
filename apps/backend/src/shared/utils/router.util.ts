import { type RequestHandler, Router } from 'express';
import { type ZodSchema } from 'zod';

import { validateBody, validateParams, validateQuery } from '@shared/middleware';

export interface OpenApiRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tags: readonly string[];
  summary: string;
  handler: RequestHandler;
  request?: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
  };
  responses: Record<number, { schema?: ZodSchema; description: string }>;
}

// Type for exporting route metadata (without handler function) for OpenAPI generation
export type OpenApiRouteMetadata = Omit<OpenApiRoute, 'handler'>;

export function createRouterFromOpenApi(routes: readonly OpenApiRoute[]): Router {
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

    router[route.method](expressPath, ...middlewares, route.handler);
  });

  return router;
}
