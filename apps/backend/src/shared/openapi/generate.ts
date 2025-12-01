import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { globSync } from 'glob';
import { type ZodSchema } from 'zod';

import { logger } from '@shared/utils';
import { type OpenApiRouteMetadata } from '@shared/utils';

import { openapiConfig } from './config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ResponseConfig {
  schema?: ZodSchema;
  description: string;
}

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  tags: string[];
  summary: string;
  request?: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
  };
  responses: Record<number, ResponseConfig | { description: string }>;
}

async function scanRoutes(): Promise<OpenApiRouteMetadata[]> {
  const routeFiles = globSync('src/modules/**/routes/*.route.ts', {
    cwd: path.join(__dirname, '../../..'),
    absolute: true,
  });

  const allRoutes: OpenApiRouteMetadata[] = [];

  for (const file of routeFiles) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import(file);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof module.createRouter === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const routerConfig = module.createRouter({});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (routerConfig?.metadata && Array.isArray(routerConfig.metadata)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          allRoutes.push(...routerConfig.metadata);
        }
      }
    } catch (error) {
      logger.warn({ file, error }, 'Failed to import route file');
    }
  }

  return allRoutes;
}

async function generate(): Promise<void> {
  const registry = new OpenAPIRegistry();

  // Auto-scan all route files
  const routes = (await scanRoutes()) as RouteDefinition[];

  logger.info({ count: routes.length }, 'Found routes to register');

  // Register each route with proper request/response schemas
  routes.forEach((route) => {
    const responses: Record<string, ResponseConfig | { description: string }> = {};

    // Build responses object
    Object.entries(route.responses).forEach(([status, config]) => {
      responses[status] = config;
    });

    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: route.tags,
      summary: route.summary,
      request: route.request?.body
        ? {
            body: {
              content: {
                'application/json': {
                  schema: route.request.body,
                },
              },
            },
          }
        : undefined,
      responses,
    });
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const docs = generator.generateDocument(openapiConfig);

  const outputPath = path.join(__dirname, '../../../openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));

  logger.info({ outputPath, routeCount: routes.length }, 'OpenAPI spec generated successfully');
}

generate().catch((error: unknown) => {
  logger.error({ error }, 'Failed to generate OpenAPI spec');
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(error.stack);
  }
  process.exit(1);
});
