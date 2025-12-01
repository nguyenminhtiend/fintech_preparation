# OpenAPI Integration Plan

> Plan for integrating `openapi-fetch` and `openapi-react-query` to share type-safe APIs between backend and dashboard

**Status:** Planning
**Created:** 2025-12-01
**Last Updated:** 2025-12-01

---

## Table of Contents

- [Current Architecture Analysis](#current-architecture-analysis)
- [High-Level Strategy](#high-level-strategy)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Backend OpenAPI Specification Generation](#phase-1-backend-openapi-specification-generation)
  - [Phase 2: Shared API Client Package Setup](#phase-2-shared-api-client-package-setup)
  - [Phase 3: Dashboard Integration](#phase-3-dashboard-integration-with-openapi-react-query)
  - [Phase 4: Development Workflow & Automation](#phase-4-development-workflow--automation)
  - [Phase 5: Migration Strategy](#phase-5-migration-strategy)
- [Key Benefits](#key-benefits)
- [Potential Challenges & Solutions](#potential-challenges--solutions)
- [Recommended Libraries](#recommended-libraries)
- [File Structure Summary](#file-structure-summary)
- [Next Steps](#next-steps-when-ready-to-implement)

---

## Current Architecture Analysis

### Backend (`apps/backend`)

- **Framework:** Express.js + TypeScript
- **Architecture:** Modular (account, transaction modules)
- **API Structure:** Route-based (`/accounts`, `/transactions`)
- **Validation:** Zod schema validation
- **Runtime:** Node v22, ES2022 target
- **Package Manager:** pnpm

### Dashboard (`apps/dashboard`)

- **Framework:** React Router v7 + React 19
- **State Management:** TanStack Query (React Query) already installed
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Type System:** TypeScript

### Monorepo Structure

- **Tool:** pnpm workspace
- **Packages:** Shared packages structure exists (`packages/api-client`, `packages/shared`)
- **Apps:** `apps/backend`, `apps/dashboard`

---

## High-Level Strategy

1. **Generate OpenAPI spec from backend** (Express routes + Zod schemas)
2. **Create shared API client package** using `openapi-fetch` and `openapi-typescript`
3. **Integrate in dashboard** using `openapi-react-query`
4. **Type safety end-to-end** from backend schemas → OpenAPI → generated TypeScript types → frontend

**Flow:**

```
Backend Zod Schemas → OpenAPI Spec → TypeScript Types → React Hooks → Type-Safe API Calls
```

---

## Implementation Phases

### Phase 1: Backend OpenAPI Specification Generation

**Goal:** Generate OpenAPI spec as a **standalone build step** with **minimal code changes** when adding new APIs

> **Key Principles:**
>
> - ✅ Generate `openapi.json` **offline** (not at runtime)
> - ✅ **No Swagger UI** in the running server (no runtime overhead)
> - ✅ **Minimal boilerplate** - leverage existing Zod schemas
> - ✅ **Convention over configuration** - automatic route detection where possible

#### 1.1 Install Dependencies

```bash
cd apps/backend
pnpm add -D @asteasolutions/zod-to-openapi
```

**Why this approach:**

- **Single library** (`zod-to-openapi`) - minimal dependencies
- **Dev dependency only** - no runtime impact
- **Build-time generation** - runs via npm script, not during server start

#### 1.2 Simplified Directory Structure

**Location:** `apps/backend/src/shared/openapi/`

**Files to Create:**

```
src/shared/openapi/
├── config.ts          # Basic metadata (title, version, servers)
├── scanner.ts         # Auto-discovers route files
└── generate.ts        # Generation script (uses scanner)
```

**That's it!** OpenAPI metadata lives in each route file, not a central registry.

#### 1.3 Minimal Schema Extensions

**Option A: No Changes to Schemas (Recommended for minimal code)**

Keep your existing Zod schemas **exactly as they are**. Descriptions will be inferred from Zod error messages.

```typescript
// apps/backend/src/modules/account/schemas/account.schema.ts
// NO CHANGES NEEDED - keep as-is!
export const createAccountSchema = z.object({
  customerId: z.uuid('Invalid customer ID format'),
  currency: z.string().length(3).toUpperCase(),
});
```

**Option B: Add Descriptions Only When Needed**

Only extend schemas where you want better documentation:

```typescript
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createAccountSchema = z.object({
  customerId: z.uuid().openapi({ description: 'Customer UUID' }), // Optional
  currency: z.string().length(3),
});
```

#### 1.4 Define Response Schemas

**Create response DTOs alongside request schemas:**

```typescript
// apps/backend/src/modules/account/schemas/account.schema.ts
import { z } from 'zod';

// Request schema (already exists)
export const createAccountSchema = z.object({
  customerId: z.uuid('Invalid customer ID format'),
  currency: z.string().length(3).toUpperCase(),
});

// Response schema (add this)
export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  accountNumber: z.string(),
  customerId: z.string().uuid(),
  currency: z.string(),
  balance: z.number(),
  availableBalance: z.number(),
  createdAt: z.string().datetime(),
});

// Export response type for controllers
export type AccountResponse = z.infer<typeof accountResponseSchema>;
```

**Reuse these in your controllers** to ensure consistency:

```typescript
// apps/backend/src/modules/account/controllers/account.controller.ts
import { type AccountResponse } from '../schemas/account.schema';

createAccount = async (req: Request, res: Response): Promise<void> => {
  const account = await this.accountService.createAccount(...);
  const response: AccountResponse = { /* map from entity */ };
  res.status(201).json(response);
};
```

#### 1.5 Shared Router Utility (Auto-Generate Routes)

**Create a shared utility to automatically generate Express routes from OpenAPI definitions:**

```typescript
// apps/backend/src/shared/utils/router.util.ts
import { type Router } from 'express';
import { validateBody, validateParams, validateQuery } from '@shared/middleware';
import { type ZodSchema } from 'zod';

interface OpenApiRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tags: string[];
  summary: string;
  handler: string; // Controller method name (e.g., 'createAccount')
  request?: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
  };
  responses: Record<number, { schema?: ZodSchema; description: string }>;
}

export function createRouterFromOpenApi(
  router: Router,
  routes: readonly OpenApiRoute[],
  controller: any,
): Router {
  routes.forEach((route) => {
    const middlewares = [];

    // Auto-add validation middleware based on request schemas
    if (route.request?.body) {
      middlewares.push(validateBody(route.request.body));
    }
    if (route.request?.params) {
      middlewares.push(validateParams(route.request.params));
    }
    if (route.request?.query) {
      middlewares.push(validateQuery(route.request.query));
    }

    // Convert OpenAPI path params to Express format: /accounts/{id} → /accounts/:id
    const expressPath = route.path.replace(/\{(\w+)\}/g, ':$1');

    // Get the controller method handler
    const handler = controller[route.handler];
    if (!handler) {
      throw new Error(
        `Handler '${route.handler}' not found on controller for route ${route.method.toUpperCase()} ${route.path}`,
      );
    }

    // Register route with Express router
    router[route.method](expressPath, ...middlewares, handler);
  });

  return router;
}
```

**Export from shared utils:**

```typescript
// apps/backend/src/shared/utils/index.ts
export { createRouterFromOpenApi } from './router.util';
```

#### 1.6 Auto-Scan Route Files (Convention over Configuration)

**Instead of manually maintaining a routes array, export metadata from each route file!**

**Update existing route files to export OpenAPI metadata:**

```typescript
// apps/backend/src/modules/account/routes/account.route.ts
import { Router } from 'express';
import { createRouterFromOpenApi } from '@shared/utils';
import { type AccountController } from '../controllers';
import { createAccountSchema, accountResponseSchema } from '../schemas/account.schema';

// ✨ NEW: Export OpenAPI route definitions with handler names
export const openApiRoutes = [
  {
    method: 'post' as const,
    path: '/accounts',
    tags: ['Accounts'],
    summary: 'Create a new account',
    handler: 'createAccount', // Maps to controller.createAccount
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
    handler: 'getAccountBalance', // Maps to controller.getAccountBalance
    responses: {
      200: {
        schema: z.object({
          balance: z.number(),
          availableBalance: z.number(),
        }),
        description: 'Account balance retrieved',
      },
      404: { description: 'Account not found' },
    },
  },
] as const;

// ✨ SIMPLIFIED: Auto-generate routes from definitions
export function createAccountRouter(controller: AccountController): Router {
  const router = Router();
  return createRouterFromOpenApi(router, openApiRoutes, controller);
}
```

**Auto-discovery generator scans all route files:**

```typescript
// apps/backend/src/shared/openapi/scanner.ts
import { globSync } from 'glob';
import path from 'node:path';

export async function scanRoutes() {
  const routeFiles = globSync('src/modules/**/routes/*.route.ts', {
    cwd: path.join(__dirname, '../../..'),
    absolute: true,
  });

  const allRoutes = [];

  for (const file of routeFiles) {
    const module = await import(file);
    if (module.openApiRoutes) {
      allRoutes.push(...module.openApiRoutes);
    }
  }

  return allRoutes;
}
```

**Note:** The `handler` field in route definitions is used by `createRouterFromOpenApi` for automatic Express route generation but is not included in the OpenAPI spec output (it's internal metadata only).

#### 1.7 Updated Generation Script

**Generator uses the auto-scanner and properly handles responses:**

```typescript
// apps/backend/src/shared/openapi/generate.ts
import fs from 'node:fs';
import path from 'node:path';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { scanRoutes } from './scanner';
import { openapiConfig } from './config';

async function generate() {
  const registry = new OpenAPIRegistry();

  // Auto-scan all route files
  const routes = await scanRoutes();

  console.log(`📋 Found ${routes.length} routes to register`);

  // Register each route with proper request/response schemas
  routes.forEach((route) => {
    const responses: Record<string, any> = {};

    // Build responses object
    Object.entries(route.responses).forEach(([status, config]) => {
      if (typeof config === 'object' && 'schema' in config) {
        responses[status] = {
          description: config.description,
          content: {
            'application/json': {
              schema: config.schema,
            },
          },
        };
      } else {
        responses[status] = {
          description: config.description,
        };
      }
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

  console.log('✅ OpenAPI spec generated:', outputPath);
  console.log(`   ${routes.length} routes registered`);
}

generate().catch(console.error);
```

**Install glob dependency:**

```bash
cd apps/backend
pnpm add -D glob
```

**Basic config (unchanged):**

```typescript
// apps/backend/src/shared/openapi/config.ts
export const openapiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Fintech API',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Development' }],
};
```

#### 1.8 Add Generation Script

**Update `apps/backend/package.json`:**

```json
{
  "scripts": {
    "openapi:generate": "tsx src/shared/openapi/generate.ts"
  }
}
```

**Usage:**

```bash
# Auto-scans all *.route.ts files and generates openapi.json
pnpm openapi:generate
```

**No runtime impact** - server starts normally without any OpenAPI overhead.

#### 1.9 Adding New APIs - Zero-Config Workflow

**When you add a new endpoint, the metadata lives RIGHT in your route file:**

**Example: Adding a new Customer module**

1. **Create your schemas** (as you normally would):

   ```typescript
   // apps/backend/src/modules/customer/schemas/customer.schema.ts
   import { z } from 'zod';

   export const createCustomerSchema = z.object({
     name: z.string(),
     email: z.string().email(),
   });

   export const customerResponseSchema = z.object({
     id: z.string().uuid(),
     name: z.string(),
     email: z.string(),
     createdAt: z.string().datetime(),
   });
   ```

2. **Create route file with OpenAPI metadata export**:

   ```typescript
   // apps/backend/src/modules/customer/routes/customer.route.ts
   import { Router } from 'express';
   import { createRouterFromOpenApi } from '@shared/utils';
   import { createCustomerSchema, customerResponseSchema } from '../schemas/customer.schema';
   import { type CustomerController } from '../controllers';

   // ✨ Export this array - scanner will auto-discover it
   export const openApiRoutes = [
     {
       method: 'post' as const,
       path: '/customers',
       tags: ['Customers'],
       summary: 'Create a new customer',
       handler: 'createCustomer', // Maps to controller.createCustomer
       request: { body: createCustomerSchema },
       responses: {
         201: { schema: customerResponseSchema, description: 'Customer created' },
         400: { description: 'Invalid request' },
       },
     },
   ] as const;

   // ✨ SIMPLIFIED: Auto-generate routes from definitions
   export function createCustomerRouter(controller: CustomerController): Router {
     const router = Router();
     return createRouterFromOpenApi(router, openApiRoutes, controller);
   }
   ```

3. **Regenerate**:
   ```bash
   pnpm openapi:generate
   ```

**That's it!** The scanner automatically finds your new route file.

**Benefits:**

- ✅ **Co-located** - OpenAPI metadata lives with route definition
- ✅ **Auto-discovered** - No central file to maintain
- ✅ **Type-safe** - Reuses your existing Zod schemas
- ✅ **DRY** - Response types used in both OpenAPI and controllers
- ✅ **Zero config** - Just export `openApiRoutes` and it's found
- ✅ **No manual route registration** - Routes auto-generated from `openApiRoutes` using `createRouterFromOpenApi`
- ✅ **Auto-validation** - Middleware automatically added based on request schemas
- ✅ **Single source of truth** - Route definitions serve both OpenAPI generation and Express routing

**What you DON'T need to do:**

- ❌ Import into a central routes file
- ❌ Register manually in a registry
- ❌ Duplicate type definitions
- ❌ Change server startup code
- ❌ Manually write `router.post()` / `router.get()` for each route
- ❌ Manually add validation middleware (auto-applied from schemas)

---

### Phase 2: Shared API Client Package Setup

**Goal:** Create a shared package with type-safe API client

#### 2.1 Package Structure

```
packages/api-client/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Main exports
│   ├── client.ts             # Configure openapi-fetch client
│   └── types/
│       └── api.d.ts          # Generated types (gitignored)
├── scripts/
│   └── generate-types.ts     # Type generation script
└── .gitignore
```

#### 2.2 Initialize Package

**Create `packages/api-client/package.json`:**

```json
{
  "name": "@repo/api-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "tsx scripts/generate-types.ts",
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "openapi-fetch": "^0.13.7"
  },
  "devDependencies": {
    "openapi-typescript": "^7.4.3",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

#### 2.3 Type Generation Script

**Create `packages/api-client/scripts/generate-types.ts`:**

```typescript
import { execSync } from 'node:child_process';
import path from 'node:path';

const openapiPath = path.join(__dirname, '../../apps/backend/openapi.json');
const outputPath = path.join(__dirname, '../src/types/api.d.ts');

console.log('🔄 Generating types from OpenAPI spec...');

execSync(`npx openapi-typescript ${openapiPath} -o ${outputPath}`, { stdio: 'inherit' });

console.log('✅ Types generated successfully!');
```

#### 2.4 Create Base Client

**Create `packages/api-client/src/client.ts`:**

```typescript
import createClient from 'openapi-fetch';
import type { paths } from './types/api';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
}

export function createApiClient(config: ClientConfig) {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
  });

  // Add auth interceptor
  client.use({
    onRequest(req) {
      if (config.token) {
        req.headers.set('Authorization', `Bearer ${config.token}`);
      }
      return req;
    },
    onResponse(res) {
      // Handle global errors
      if (res.status === 401) {
        // Trigger logout or token refresh
        console.error('Unauthorized');
      }
      return res;
    },
  });

  return client;
}
```

**Create `packages/api-client/src/index.ts`:**

```typescript
export { createApiClient } from './client';
export type { ClientConfig } from './client';
export type { paths, components } from './types/api';
```

#### 2.5 Configure TypeScript

**Create `packages/api-client/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2.6 Add to Dashboard Dependencies

**Update `apps/dashboard/package.json`:**

```json
{
  "dependencies": {
    "@repo/api-client": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

---

### Phase 3: Dashboard Integration with openapi-react-query

**Goal:** Use type-safe React hooks for API calls

#### 3.1 Install Dashboard Dependencies

```bash
cd apps/dashboard
# TanStack Query already installed
# Just need to add the API client
pnpm install
```

#### 3.2 Create Query Client Configuration

**Create `apps/dashboard/app/lib/api/query-client.ts`:**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

#### 3.3 Create API Client Instance

**Create `apps/dashboard/app/lib/api/client.ts`:**

```typescript
import { createApiClient } from '@repo/api-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  // Token will be added dynamically
});

// Helper to set auth token
export function setAuthToken(token: string | null) {
  apiClient.use({
    onRequest(req) {
      if (token) {
        req.headers.set('Authorization', `Bearer ${token}`);
      }
      return req;
    },
  });
}
```

#### 3.4 Create React Query Hooks

**Create `apps/dashboard/app/lib/api/hooks/use-accounts.ts`:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { paths } from '@repo/api-client';

type CreateAccountBody = paths['/accounts']['post']['requestBody']['content']['application/json'];
type AccountResponse = paths['/accounts']['post']['responses'][201]['content']['application/json'];

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateAccountBody) => {
      const { data, error } = await apiClient.POST('/accounts', {
        body,
      });

      if (error) {
        throw new Error('Failed to create account');
      }

      return data as AccountResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useAccountBalance(accountId: string) {
  return useQuery({
    queryKey: ['accounts', accountId, 'balance'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/accounts/{id}/balance', {
        params: {
          path: { id: accountId },
        },
      });

      if (error) {
        throw new Error('Failed to fetch account balance');
      }

      return data;
    },
    enabled: !!accountId,
  });
}
```

#### 3.5 Setup Query Provider

**Update `apps/dashboard/app/root.tsx`:**

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/api/query-client';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* ... */}
        </head>
        <body>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </body>
      </html>
    </QueryClientProvider>
  );
}
```

#### 3.6 Usage in Components

**Example Component:**

```typescript
import { useCreateAccount, useAccountBalance } from '~/lib/api/hooks/use-accounts';

export function AccountForm() {
  const createAccount = useCreateAccount();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await createAccount.mutateAsync({
      customerId: formData.get('customerId') as string,
      currency: formData.get('currency') as string,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields with full type safety */}
    </form>
  );
}
```

---

### Phase 4: Development Workflow & Automation

**Goal:** Streamline the process when backend APIs change

#### 4.1 Root Scripts

**Update root `package.json`:**

```json
{
  "scripts": {
    "openapi:generate": "pnpm --filter backend openapi:generate",
    "api:types": "pnpm --filter @repo/api-client generate",
    "api:sync": "pnpm openapi:generate && pnpm api:types",
    "dev": "pnpm --parallel --filter backend --filter dashboard dev"
  }
}
```

#### 4.2 Watch Mode (Optional)

**Create `scripts/watch-openapi.ts`:**

```typescript
import chokidar from 'chokidar';
import { execSync } from 'node:child_process';

const watcher = chokidar.watch('apps/backend/src/**/*.schema.ts', {
  persistent: true,
});

console.log('👀 Watching for schema changes...');

watcher.on('change', (path) => {
  console.log(`📝 Schema changed: ${path}`);
  console.log('🔄 Regenerating OpenAPI spec and types...');

  try {
    execSync('pnpm api:sync', { stdio: 'inherit' });
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
});
```

#### 4.3 Pre-commit Hook

**Update `.lintstagedrc.json`:**

```json
{
  "apps/backend/src/**/*.schema.ts": ["pnpm api:sync"]
}
```

#### 4.4 CI/CD Integration

**Add to CI workflow:**

```yaml
- name: Generate OpenAPI types
  run: pnpm api:sync

- name: Type check
  run: pnpm --recursive typecheck

- name: Verify no uncommitted changes
  run: git diff --exit-code
```

---

### Phase 5: Migration Strategy

**Goal:** Gradually migrate existing API calls to type-safe hooks

#### 5.1 Audit Current API Calls

1. Search for all `fetch()` calls in dashboard
2. Search for axios/other HTTP client usage
3. Document endpoints and their usage

#### 5.2 Create Migration Checklist

**Modules to Migrate:**

- [ ] Authentication endpoints
- [ ] Account endpoints
- [ ] Transaction endpoints
- [ ] Additional modules

#### 5.3 Migration Pattern

**Before (Unsafe):**

```typescript
const response = await fetch('/accounts', {
  method: 'POST',
  body: JSON.stringify({ customerId, currency }),
});
const data = await response.json(); // No type safety
```

**After (Type-Safe):**

```typescript
const { mutateAsync } = useCreateAccount();
await mutateAsync({ customerId, currency }); // Fully typed
```

#### 5.4 Testing Strategy

1. Run old and new implementations in parallel
2. Compare responses
3. Verify error handling
4. Check loading states

#### 5.5 Cleanup

1. Remove old API call implementations
2. Remove unused dependencies
3. Update error handling patterns
4. Update tests

---

## Key Benefits

### ✅ End-to-End Type Safety

- Backend Zod schemas → OpenAPI spec → TypeScript types → React hooks
- Catch API contract mismatches at compile time
- Refactor with confidence

### ✅ Single Source of Truth

- Backend schemas drive frontend types
- No manual DTO duplication
- Automatic sync when schemas change

### ✅ Developer Experience

- **Autocomplete** for endpoints, parameters, and responses
- **Inline documentation** from OpenAPI descriptions
- **Refactoring safety** - rename endpoint = compile error in frontend
- **IntelliSense** shows available fields

### ✅ Maintainability

- Automated type generation
- Self-documenting API via Swagger UI
- Easier onboarding for new developers
- Reduced bugs from type mismatches

### ✅ Performance

- `openapi-fetch` is lightweight (tree-shakeable)
- No runtime validation overhead
- Native `fetch` API under the hood

---

## Potential Challenges & Solutions

### Challenge 1: Express → OpenAPI Mapping

**Problem:** Express doesn't have built-in OpenAPI support like tRPC or FastAPI

**Solutions:**

- Use `@asteasolutions/zod-to-openapi` for schema conversion
- Create route registry pattern manually
- Document routes alongside implementation
- **Alternative:** Consider migrating to tRPC for end-to-end type safety without OpenAPI

### Challenge 2: File Upload / Binary Data

**Problem:** OpenAPI handles multipart/form-data differently

**Solutions:**

- Use OpenAPI 3.x `multipart/form-data` specification
- Create custom fetch wrapper for file uploads
- Document binary response types carefully
- Use `Blob` or `ArrayBuffer` types in TypeScript

### Challenge 3: Keeping Spec in Sync

**Problem:** Developers may forget to regenerate OpenAPI spec after schema changes

**Solutions:**

- Add to pre-commit hooks (`lint-staged`)
- Fail CI if spec is out of date
- Add script to check staleness (compare timestamps)
- Use watch mode during development

### Challenge 4: Complex Response Types

**Problem:** Zod unions, discriminated unions, intersections

**Solutions:**

- Use `zod-to-openapi` discriminator support
- Test generated types thoroughly
- Add manual type assertions where needed
- Document complex types with examples

### Challenge 5: Authentication & Interceptors

**Problem:** Need to inject JWT tokens dynamically

**Solutions:**

- Use `openapi-fetch` middleware/interceptors
- Store token in React Context or state management
- Refresh token logic in interceptor
- Handle 401 responses globally

### Challenge 6: Error Handling

**Problem:** OpenAPI error responses need proper typing

**Solutions:**

- Define error schemas in OpenAPI spec
- Create typed error classes
- Use discriminated unions for different error types
- Global error handler in React Query

---

## Recommended Libraries

### Core (Required)

| Library                          | Purpose                                | Version |
| -------------------------------- | -------------------------------------- | ------- |
| `openapi-typescript`             | Generate TypeScript types from OpenAPI | ^7.4.3  |
| `openapi-fetch`                  | Lightweight type-safe fetch client     | ^0.13.7 |
| `@asteasolutions/zod-to-openapi` | Convert Zod schemas to OpenAPI         | ^7.3.0  |

### React Integration

| Library                 | Purpose                         | Notes                |
| ----------------------- | ------------------------------- | -------------------- |
| `@tanstack/react-query` | Data fetching & caching         | Already installed    |
| `@openapi-qraft/react`  | Auto-generate React Query hooks | Optional alternative |

### Development Tools

| Library    | Purpose              | Notes             |
| ---------- | -------------------- | ----------------- |
| `chokidar` | File watching        | For watch mode    |
| `tsx`      | TypeScript execution | Already installed |

---

## File Structure Summary

```
fintech-preparation/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── account/
│   │   │   │   │   └── schemas/
│   │   │   │   │       └── account.schema.ts        # Extended with OpenAPI
│   │   │   │   └── transaction/
│   │   │   │       └── schemas/
│   │   │   │           └── transaction.schema.ts    # Extended with OpenAPI
│   │   │   └── shared/
│   │   │       ├── utils/
│   │   │       │   └── router.util.ts               # [NEW] Router factory from OpenAPI
│   │   │       └── openapi/
│   │   │           ├── config.ts                    # [NEW] OpenAPI metadata
│   │   │           ├── scanner.ts                   # [NEW] Auto-scan route files
│   │   │           └── generate.ts                  # [NEW] Generation script
│   │   ├── openapi.json                             # [GENERATED] OpenAPI spec
│   │   └── package.json                             # Updated scripts
│   │
│   └── dashboard/
│       ├── app/
│       │   ├── lib/
│       │   │   └── api/
│       │   │       ├── client.ts                    # [NEW] API client instance
│       │   │       ├── query-client.ts              # [NEW] React Query config
│       │   │       └── hooks/
│       │   │           ├── use-accounts.ts          # [NEW] Account hooks
│       │   │           └── use-transactions.ts      # [NEW] Transaction hooks
│       │   └── root.tsx                             # [MODIFIED] Add QueryProvider
│       └── package.json                             # Add @repo/api-client
│
├── packages/
│   └── api-client/                                  # [NEW PACKAGE]
│       ├── src/
│       │   ├── index.ts                             # Main exports
│       │   ├── client.ts                            # Base client factory
│       │   └── types/
│       │       └── api.d.ts                         # [GENERATED] TypeScript types
│       ├── scripts/
│       │   └── generate-types.ts                    # Type generation script
│       ├── package.json                             # Package config
│       ├── tsconfig.json                            # TypeScript config
│       └── .gitignore                               # Ignore generated files
│
├── scripts/
│   └── watch-openapi.ts                             # [NEW] Watch mode script
│
├── package.json                                     # [MODIFIED] Add root scripts
└── pnpm-workspace.yaml                              # Already configured
```

### Legend

- `[NEW]` - File/directory to be created
- `[MODIFIED]` - Existing file to be updated
- `[GENERATED]` - Auto-generated file (should be in `.gitignore`)

---

## Next Steps (When Ready to Implement)

### Immediate Actions

1. **Review this plan** with the team
2. **Decide on libraries** (confirm choices above)
3. **Set timeline** for each phase

### Phase-by-Phase Implementation

#### Week 1: Backend OpenAPI Generation

- [ ] Install dependencies in backend
- [ ] Create OpenAPI generator module
- [ ] Extend existing Zod schemas with OpenAPI metadata
- [ ] Create route registry
- [ ] Generate first version of `openapi.json`
- [ ] Verify spec with Swagger UI

#### Week 2: API Client Package

- [ ] Create `packages/api-client` structure
- [ ] Set up type generation script
- [ ] Generate types from OpenAPI spec
- [ ] Create base client with `openapi-fetch`
- [ ] Add to dashboard dependencies
- [ ] Test basic type safety

#### Week 3: Dashboard Integration

- [ ] Set up React Query configuration
- [ ] Create API client instance in dashboard
- [ ] Build first React Query hook (e.g., accounts)
- [ ] Test in a simple component
- [ ] Verify type safety end-to-end

#### Week 4: Automation & Migration

- [ ] Add root scripts for regeneration
- [ ] Set up pre-commit hooks
- [ ] Create migration checklist
- [ ] Migrate one module completely
- [ ] Document patterns for team

### Success Criteria

- ✅ OpenAPI spec accurately reflects all backend endpoints
- ✅ Types generate without errors
- ✅ Frontend gets autocomplete for API calls
- ✅ Breaking changes in backend cause TypeScript errors in frontend
- ✅ Documentation (Swagger UI) is accessible
- ✅ Team is comfortable with new workflow

---

## Questions to Consider

Before starting implementation, discuss:

1. **Should generated types be committed?** (vs generated on install)
   - Recommended: Commit them for faster CI and better diffs
2. **Auto-regenerate on schema changes?** (watch mode during dev)
   - Optional: Add file watcher to auto-run `pnpm openapi:generate`
3. **Error handling strategy?** (global vs per-hook)
   - Recommend global error boundary + per-hook overrides
4. **Authentication flow?** (token storage, refresh logic)
   - localStorage vs httpOnly cookies vs memory
5. **Versioning strategy?** (if we need API v2 in future)
   - Could use `/v1/accounts`, `/v2/accounts` pattern
6. **Response schemas?** (Do we define DTOs for responses?)
   - Can reuse entity interfaces or create separate response schemas

---

## References

- [openapi-typescript Documentation](https://openapi-ts.dev/)
- [openapi-fetch Documentation](https://openapi-ts.dev/openapi-fetch/)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

---

**Last Updated:** 2025-12-01
**Maintained By:** Engineering Team
