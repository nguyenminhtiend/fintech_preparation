import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { globSync } from 'glob';
import { z, type ZodSchema } from 'zod';

import { logger } from '@shared/utils';
import { type OpenApiRouteMetadata } from '@shared/utils';

import { openapiConfig } from './config';

// Extend Zod with OpenAPI methods (only needed for generation, not runtime)
extendZodWithOpenApi(z);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ResponseConfig {
  description: string;
  schema?: ZodSchema;
}

interface OpenApiResponse {
  description: string;
  content?: {
    'application/json': {
      schema: ZodSchema;
    };
  };
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
  responses: Record<number, ResponseConfig>;
}

interface RouterModule {
  createRouter?: (controller: unknown) => {
    metadata?: OpenApiRouteMetadata[];
  };
}

/**
 * Creates a mock controller proxy that returns no-op functions for any property access.
 * Used during route metadata extraction to avoid actual controller instantiation.
 */
function createMockController(): Record<string, () => void> {
  return new Proxy(
    {},
    {
      get: () => () => {
        // No-op function placeholder
      },
    },
  );
}

/**
 * Scans all route files in the modules directory and extracts OpenAPI metadata.
 */
async function scanRoutes(): Promise<RouteDefinition[]> {
  const routeFiles = globSync('src/modules/**/routes/*.route.ts', {
    cwd: path.join(__dirname, '../../..'),
    absolute: true,
  });

  const allRoutes: OpenApiRouteMetadata[] = [];
  const mockController = createMockController();

  for (const file of routeFiles) {
    try {
      const module = (await import(file)) as RouterModule;

      if (typeof module.createRouter === 'function') {
        const routerConfig = module.createRouter(mockController);

        if (routerConfig?.metadata && Array.isArray(routerConfig.metadata)) {
          allRoutes.push(...routerConfig.metadata);
        }
      }
    } catch (error) {
      logger.warn({ file, error }, 'Failed to import route file');
    }
  }

  return allRoutes as RouteDefinition[];
}

/**
 * Generates a schema name from route metadata.
 * Example: /accounts -> AccountsResponse
 */
function generateSchemaName(path: string): string {
  const pathParts = path.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] || 'response';

  // Remove parameter placeholders like :id
  const cleanPart = lastPart.replace(/^:/, '');

  // Capitalize first letter
  const baseName = cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1);

  return `${baseName}Response`;
}

/**
 * Manages schema registration to avoid duplicates and ensure proper naming.
 */
class SchemaRegistry {
  private registeredSchemas = new Map<ZodSchema, ZodSchema>();

  /**
   * Wraps a Zod schema with .openapi() to register it as a named component.
   * Returns existing wrapped schema if already registered.
   */
  register(schema: ZodSchema, name: string): ZodSchema {
    const existing = this.registeredSchemas.get(schema);
    if (existing) {
      return existing;
    }

    // Type assertion needed due to Zod extension
    const wrapped = (schema as ZodSchema & { openapi: (name: string) => ZodSchema }).openapi(name);
    this.registeredSchemas.set(schema, wrapped);

    return wrapped;
  }
}

/**
 * Builds OpenAPI response configuration from route metadata.
 */
function buildResponseConfig(
  route: RouteDefinition,
  schemaRegistry: SchemaRegistry,
): Record<string, OpenApiResponse> {
  const responses: Record<string, OpenApiResponse> = {};

  Object.entries(route.responses).forEach(([status, config]) => {
    if (config.schema) {
      const schemaName = generateSchemaName(route.path);
      const wrappedSchema = schemaRegistry.register(config.schema, schemaName);

      responses[status] = {
        description: config.description,
        content: {
          'application/json': {
            schema: wrappedSchema,
          },
        },
      };
    } else {
      responses[status] = {
        description: config.description,
      };
    }
  });

  return responses;
}

/**
 * Builds OpenAPI request configuration from route metadata.
 */
function buildRequestConfig(
  route: RouteDefinition,
): { body: { content: Record<string, { schema: ZodSchema }> } } | undefined {
  if (!route.request?.body) {
    return undefined;
  }

  return {
    body: {
      content: {
        'application/json': {
          schema: route.request.body,
        },
      },
    },
  };
}

/**
 * Registers all routes with the OpenAPI registry.
 */
function registerRoutes(routes: RouteDefinition[], registry: OpenAPIRegistry): void {
  const schemaRegistry = new SchemaRegistry();

  routes.forEach((route) => {
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: route.tags,
      summary: route.summary,
      request: buildRequestConfig(route),
      responses: buildResponseConfig(route, schemaRegistry),
    });
  });
}

/**
 * Writes the OpenAPI specification to a file.
 */
function writeSpecification(docs: unknown, routeCount: number): void {
  const outputPath = path.join(__dirname, '../../../openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));

  logger.info({ outputPath, routeCount }, 'OpenAPI spec generated successfully');
}

/**
 * Main generation function that orchestrates the OpenAPI spec generation.
 */
async function generate(): Promise<void> {
  const routes = await scanRoutes();
  logger.info({ count: routes.length }, 'Found routes to register');

  const registry = new OpenAPIRegistry();
  registerRoutes(routes, registry);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const docs = generator.generateDocument(openapiConfig);

  writeSpecification(docs, routes.length);
}

// Execute generation
generate().catch((error: unknown) => {
  logger.error({ error }, 'Failed to generate OpenAPI spec');

  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(error.stack);
  }

  process.exit(1);
});
