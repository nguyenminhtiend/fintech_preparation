# Testing Guide: Node.js/Prisma/Express.js Best Practices (2025)

## Table of Contents

- [Overview](#overview)
- [Project Context](#project-context)
- [Framework Selection](#framework-selection)
- [Unit Testing Approach](#unit-testing-approach)
- [Integration Testing Approach](#integration-testing-approach)
- [Project Structure & Organization](#project-structure--organization)
- [Modern Tools & Libraries](#modern-tools--libraries)
- [Configuration & Setup](#configuration--setup)
- [Best Practices 2025](#best-practices-2025)
- [Implementation Roadmap](#implementation-roadmap)
- [Quick Start Commands](#quick-start-commands)

---

## Overview

This guide provides comprehensive best practices for setting up unit tests and integration tests for our Node.js/Prisma/Express.js fintech application in 2025.

---

## Project Context

**Current Stack:**

- Monorepo setup using pnpm workspaces
- TypeScript-based backend (Node.js >= 22.0.0)
- Express.js 5.0.1 for API layer
- Prisma 7.0.0 with PostgreSQL
- Modular architecture with feature-based modules
- ESM modules (`"type": "module"`)
- Path aliases configured (@shared/_, @modules/_)

**Current Status:**

- No existing test infrastructure
- Modular architecture already supports dependency injection
- Ready for testing implementation

---

## Framework Selection

### Recommended: Vitest ⭐

**Why Vitest is ideal for our project:**

1. **Native ESM Support**: Our project uses `"type": "module"` - Vitest handles ESM natively without configuration hacks
2. **TypeScript Out-of-the-Box**: Zero configuration for TypeScript, no ts-jest or babel-jest needed
3. **Performance**: 10-20x faster in watch mode, 30-70% faster overall
4. **Modern Tooling**: Built for modern JavaScript/TypeScript projects
5. **Path Aliases Support**: Works seamlessly with our existing tsconfig path mappings
6. **Jest Compatibility**: 95% API compatible, easy migration if needed

**Performance Metrics (2025):**

- Cold runs: Up to 4x faster than Jest
- Memory usage: 30% lower (800MB vs 1.2GB on large codebases)
- Watch mode: Near-instant with HMR

### Alternative: Jest

**Choose Jest only if:**

- You have concerns about Vitest's ecosystem maturity
- You need React Native support (mandatory)
- Team has extensive Jest experience

**Jest Drawbacks for Our Setup:**

- Requires ts-jest or babel-jest configuration
- Experimental ESM support only
- Slower performance, especially in watch mode
- Additional configuration for path aliases

### Node.js Native Test Runner

**Not Recommended** - Limited ecosystem, lacks essential features like coverage reporting, mocking utilities, and watch mode sophistication.

---

## Unit Testing Approach

### Testing Express Routes/Controllers

**Best Practice: Dependency Injection Pattern**

Our current architecture already uses DI, which enables easy mocking without stubbing libraries.

**Example Structure:**

```typescript
// account.controller.ts (current pattern)
export class AccountController {
  constructor(private accountService: AccountService) {}

  async createAccount(req: Request, res: Response) {
    const account = await this.accountService.create(req.body);
    res.json(account);
  }
}

// account.controller.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { AccountController } from './account.controller';
import type { AccountService } from './services/account.service';

describe('AccountController', () => {
  it('should create account successfully', async () => {
    // Mock service
    const mockService: AccountService = {
      create: vi.fn().resolveValue({ id: '123', accountNumber: 'ACC001' }),
    };

    const controller = new AccountController(mockService);
    const mockReq = { body: { customerId: '1', accountType: 'SAVINGS' } };
    const mockRes = { json: vi.fn(), status: vi.fn() };

    await controller.createAccount(mockReq as any, mockRes as any);

    expect(mockService.create).toHaveBeenCalledWith(mockReq.body);
    expect(mockRes.json).toHaveBeenCalledWith({ id: '123', accountNumber: 'ACC001' });
  });
});
```

### Mocking Prisma Client

**Recommended Approach: vitest-mock-extended**

**Installation:**

```bash
pnpm add -D vitest vitest-mock-extended
```

**Setup Mock Singleton:**

```typescript
// src/__tests__/setup/prisma-mock.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { beforeEach, vi } from 'vitest';

vi.mock('@/shared/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
```

**Usage in Tests:**

```typescript
import { prismaMock } from '../setup/prisma-mock';

it('should find account by id', async () => {
  const mockAccount = { id: '1', accountNumber: 'ACC001' };
  prismaMock.account.findUnique.mockResolvedValue(mockAccount);

  const result = await accountRepository.findById('1');

  expect(result).toEqual(mockAccount);
  expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
    where: { id: '1' },
  });
});
```

**Alternative Libraries:**

- `prisma-mock-vitest`: More comprehensive, stores data in memory
- `vitest-prisma-mock`: Specialized Prisma mocking

### Testing Service Layer in Isolation

**Pattern:**

```typescript
// account.service.spec.ts
describe('AccountService', () => {
  let service: AccountService;
  let mockRepository: DeepMockProxy<AccountRepository>;

  beforeEach(() => {
    mockRepository = mockDeep<AccountRepository>();
    service = new AccountService(mockRepository);
  });

  it('should create account with generated account number', async () => {
    const input = { customerId: '1', accountType: 'SAVINGS' };
    const expectedAccount = {
      id: '1',
      ...input,
      accountNumber: 'SAV1234567890',
    };

    mockRepository.create.mockResolvedValue(expectedAccount);

    const result = await service.createAccount(input);

    expect(result.accountNumber).toMatch(/^SAV\d{10}$/);
    expect(mockRepository.create).toHaveBeenCalled();
  });
});
```

### Mocking Middleware and Dependencies

**Middleware Testing:**

```typescript
// validation.middleware.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { validationMiddleware } from './validation.middleware';
import { z } from 'zod';

describe('validationMiddleware', () => {
  it('should pass valid request to next()', async () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validationMiddleware(schema);

    const req = { body: { email: 'test@example.com' } };
    const res = { status: vi.fn(), json: vi.fn() };
    const next = vi.fn();

    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid data', async () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validationMiddleware(schema);

    const req = { body: { email: 'invalid' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
```

---

## Integration Testing Approach

### Modern Testing Terminology (2025 Industry Standard)

**IMPORTANT: Clarifying Test Types to Avoid Confusion**

The term "integration test" is overloaded in the industry. Here's the modern 2025 consensus:

#### Test Type Hierarchy

**1. Unit Tests**

- Test single functions/methods in **complete isolation**
- Mock **ALL** dependencies (services, repositories, databases)
- **Example**: Test `generateAccountNumber()` with mocked repository
- **File naming**: `*.spec.ts`

**2. Integration Tests (Narrow/Component Tests)**

- Test interaction between **2-3 components** with some real dependencies
- **Example**: Service + Real Repository + Real Database (no HTTP layer)
- **File naming**: `*.integration.spec.ts`

**3. API Tests (Single Endpoint - Full Stack)**

- Test **one API endpoint** through complete stack with real database
- Full HTTP request → Controller → Service → Repository → Database
- Tests endpoints **independently** (not workflows)
- **Example**: `POST /accounts` with real database
- **File naming**: `*.api.spec.ts` or `*.integration.spec.ts`
- **Also called**: "Component Tests" or "Subcutaneous Tests" (Martin Fowler)

**4. E2E Tests (Workflows - Multiple APIs)**

- Test **complete user journeys** across **multiple endpoints**
- Simulates real user workflows end-to-end
- Can span multiple services/modules
- **Example**: Create customer → Create account → Deposit → Check balance
- **File naming**: `*.e2e.spec.ts`
- **Location**: Usually in separate `tests/e2e/` or `e2e/` folder at project root

#### Key Distinctions

| Test Type       | Scope              | Dependencies   | Speed   | Use Case                         |
| --------------- | ------------------ | -------------- | ------- | -------------------------------- |
| **Unit**        | Single function    | All mocked     | Fastest | Business logic, validation       |
| **Integration** | 2-3 components     | Partially real | Fast    | Service + Repository interaction |
| **API**         | Single endpoint    | Real database  | Medium  | Individual endpoint validation   |
| **E2E**         | Multiple endpoints | All real       | Slowest | Complete user workflows          |

#### Modern Testing Pyramid (2025)

```
        /\
       /E2E\      ← 5-10% - Critical user journeys only
      /------\
     /  API  \    ← 20-30% - Key endpoints (single API)
    /----------\
   /Integration\ ← 20-30% - Component interactions
  /--------------\
 /     Unit      \ ← 40-50% - Business logic
/------------------\
```

**Source**: Martin Fowler's "Practical Test Pyramid", Kent C. Dodds, Industry surveys 2025

### Database Testing Strategy with Prisma

**Recommended: Docker + Isolated Test Databases**

#### Approach A: Docker Compose with Test Database (Recommended)

**docker-compose.test.yml:**

```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: fintech_test
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U testuser']
      interval: 5s
      timeout: 5s
      retries: 5
```

**Setup Script (package.json):**

```json
{
  "scripts": {
    "test:integration": "pnpm test:db:start && pnpm test:db:migrate && vitest run --config vitest.config.integration.ts",
    "test:db:start": "docker-compose -f docker-compose.test.yml up -d",
    "test:db:migrate": "dotenv -e .env.test -- prisma migrate deploy",
    "test:db:stop": "docker-compose -f docker-compose.test.yml down -v"
  }
}
```

**.env.test:**

```env
DATABASE_URL="postgresql://testuser:testpass@localhost:5433/fintech_test?schema=public"
NODE_ENV=test
```

#### Approach B: Database Per Worker (Parallel Testing)

```typescript
// vitest.config.integration.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
      },
    },
    globalSetup: './tests/setup/global-setup.ts',
  },
});

// tests/setup/global-setup.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function setup() {
  const workerId = process.env.VITEST_POOL_ID || '0';
  const dbName = `fintech_test_${workerId}`;

  // Create database for this worker
  await execAsync(`createdb ${dbName}`);

  // Set DATABASE_URL for this worker
  process.env.DATABASE_URL = `postgresql://testuser:testpass@localhost:5432/${dbName}`;

  // Run migrations
  await execAsync('prisma migrate deploy');

  return async () => {
    // Teardown: drop database
    await execAsync(`dropdb ${dbName}`);
  };
}
```

### Handling Prisma Migrations in Tests

**Two Strategies:**

**1. Full Migration (Recommended for CI/CD):**

```bash
prisma migrate deploy
```

- Applies all migrations sequentially
- Ensures test DB matches production schema exactly
- Slower but more accurate

**2. Schema Push (Faster for Development):**

```bash
prisma db push --skip-generate --accept-data-loss
```

- Syncs schema directly without migrations
- Much faster
- Good for rapid iteration

**Setup/Teardown Pattern:**

```typescript
// tests/setup/test-db.ts
import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

const prisma = new PrismaClient();

beforeEach(async () => {
  // Clean all tables before each test
  const tables = ['Account', 'Customer', 'Transaction'];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }

  // Or use transactions (faster)
  await prisma.$transaction([
    prisma.account.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.transaction.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

### Testing API Endpoints (Single Endpoint Tests)

**Using Supertest (Still Standard in 2025):**

**Note**: These are API tests (single endpoint), NOT E2E tests (workflows).

```typescript
// account.api.spec.ts (or account.integration.spec.ts)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '../setup/test-db';

describe('Account API Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /accounts', () => {
    it('should create a new account', async () => {
      // Seed test customer
      const customer = await prisma.customer.create({
        data: { name: 'Test User', email: 'test@example.com' },
      });

      const response = await request(app)
        .post('/accounts')
        .send({
          customerId: customer.id,
          accountType: 'SAVINGS',
          currency: 'USD',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        accountType: 'SAVINGS',
        currency: 'USD',
        balance: '0',
      });
      expect(response.body.accountNumber).toMatch(/^SAV\d{10}$/);

      // Verify in database
      const dbAccount = await prisma.account.findUnique({
        where: { id: response.body.id },
      });
      expect(dbAccount).toBeTruthy();
    });

    it('should return 400 for invalid account type', async () => {
      const response = await request(app)
        .post('/accounts')
        .send({
          customerId: 'cust-123',
          accountType: 'INVALID',
          currency: 'USD',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});
```

**Alternative: supertest-fetch (2025 Modern Alternative)**

```typescript
import { agent } from 'supertest-fetch';

const api = agent(app);

await api
  .post('/accounts')
  .send({ accountType: 'SAVINGS' })
  .expect(201)
  .expectBody({ accountType: 'SAVINGS' });
```

### Docker Containers vs Test Databases

**Comparison:**

| Approach                | Pros                                       | Cons                              | Best For                     |
| ----------------------- | ------------------------------------------ | --------------------------------- | ---------------------------- |
| **Docker**              | Isolated, reproducible, matches production | Slower startup, requires Docker   | CI/CD, teams                 |
| **Local Test DB**       | Faster, simpler setup                      | Can pollute, less isolation       | Solo dev, quick iteration    |
| **In-Memory (sqlite)**  | Fastest, no setup                          | Different SQL dialect, unreliable | Not recommended for Postgres |
| **Database per worker** | True parallelization                       | Complex setup, resource intensive | Large test suites            |

**Recommendation:**

1. **Development**: Local PostgreSQL with separate test database
2. **CI/CD**: Docker containers for full isolation
3. **Future**: Database per worker when test suite grows large

---

## Project Structure & Organization

### Test File Organization

**Recommended: Centralized Test Directory**

All test files should be organized under `apps/backend/tests/` directory, mirroring the source structure for clarity and separation of concerns.

```
apps/backend/
├── src/
│   └── modules/
│       └── account/
│           ├── controllers/
│           │   └── account.controller.ts
│           ├── services/
│           │   └── account.service.ts
│           └── repositories/
│               └── account.repository.ts
│
└── tests/                                          # All test files centralized here
    ├── setup/                                      # Test configuration
    │   ├── global-setup.ts
    │   ├── vitest.setup.ts
    │   ├── integration.setup.ts
    │   ├── test-db.ts
    │   └── prisma-mock.ts
    ├── fixtures/                                   # Test data factories
    │   ├── account-fixtures.ts
    │   ├── customer-fixtures.ts
    │   └── transaction-fixtures.ts
    ├── unit/                                       # Unit tests (mirror src structure)
    │   └── modules/
    │       └── account/
    │           ├── controllers/
    │           │   └── account.controller.spec.ts
    │           ├── services/
    │           │   └── account.service.spec.ts
    │           └── repositories/
    │               └── account.repository.spec.ts
    ├── integration/                                # Integration tests (component interactions)
    │   └── modules/
    │       └── account/
    │           ├── account-service.integration.spec.ts
    │           └── account-repository.integration.spec.ts
    ├── api/                                        # API tests (single endpoint)
    │   └── modules/
    │       └── account/
    │           ├── create-account.api.spec.ts
    │           ├── get-account.api.spec.ts
    │           └── update-account.api.spec.ts
    └── e2e/                                        # E2E workflow tests
        ├── customer-onboarding.e2e.spec.ts
        └── transaction-workflow.e2e.spec.ts
```

**Rationale:**

- **Clear separation**: Test code separate from production code
- **Easy maintenance**: All tests in one location, easier to manage and configure
- **Consistent structure**: Mirrors source structure for easy navigation
- **Test type clarity**: Explicit directories for unit/integration/api/e2e tests
- **No build pollution**: Tests won't be accidentally included in production builds
- **Centralized utilities**: Shared fixtures and setup files in one place

**What Goes Where:**

```typescript
// ✅ tests/unit/modules/account/services/account.service.spec.ts
// Unit test - Service with MOCKED repository
describe('AccountService - Unit', () => {
  const mockRepo = mockDeep<AccountRepository>();
  const service = new AccountService(mockRepo);
  // Test business logic only - all dependencies mocked
});

// ✅ tests/integration/modules/account/account-service.integration.spec.ts
// Integration test - Service + REAL repository + REAL database
describe('AccountService Integration', () => {
  // Test service interacting with real database
  const service = new AccountService(new AccountRepository(prisma));
  // Tests component interactions with real dependencies
});

// ✅ tests/api/modules/account/create-account.api.spec.ts
// API test - Single endpoint through full stack
describe('POST /accounts - API Test', () => {
  await request(app).post('/accounts').send({...}).expect(201);
  // Tests ONE endpoint with real database and full HTTP stack
});

// ✅ tests/e2e/customer-onboarding.e2e.spec.ts
// E2E test - Multiple APIs in workflow
describe('Customer Onboarding E2E', () => {
  // Step 1: Create customer (API A)
  const customer = await request(app).post('/customers').send({...});

  // Step 2: Create account (API B - depends on API A)
  const account = await request(app).post('/accounts').send({
    customerId: customer.body.id
  });

  // Step 3: Make deposit (API C - depends on API B)
  await request(app).post('/transactions').send({
    accountId: account.body.id,
    amount: 100
  });

  // Step 4: Verify balance (API D)
  const balance = await request(app).get(`/accounts/${account.body.id}/balance`);
  expect(balance.body.balance).toBe(100);
  // Tests complete user journey across multiple endpoints
});
```

### Naming Conventions (2025 Standards)

**File Naming:**

- **Unit tests**: `*.spec.ts` (in `tests/unit/` directory)
- **Integration tests**: `*.integration.spec.ts` (in `tests/integration/` directory)
- **API tests**: `*.api.spec.ts` (in `tests/api/` directory)
- **E2E tests**: `*.e2e.spec.ts` (in `tests/e2e/` directory)
- **Test utilities**: `*.helper.ts` or `*.fixture.ts` (in `tests/fixtures/` or `tests/setup/`)

**Test Suite Naming:**

```typescript
// Unit tests - describe the unit
describe('AccountService - Unit', () => {
  describe('createAccount', () => {
    it('should generate unique account number', () => {});
    it('should throw error for invalid account type', () => {});
  });
});

// Integration tests - describe component interaction
describe('AccountService + Repository Integration', () => {
  it('should persist account to database', () => {});
  it('should handle database constraints', () => {});
});

// API tests - describe the endpoint
describe('POST /accounts - API', () => {
  it('should create account and return 201', () => {});
  it('should validate request body', () => {});
  it('should return 400 for invalid data', () => {});
});

// E2E tests - describe the user journey
describe('Customer Onboarding - E2E', () => {
  it('should complete full customer registration and account setup', () => {});
});

// Use "should" for test names (modern convention)
it('should create account with default balance of 0', () => {});
```

---

## Modern Tools & Libraries

### Essential Testing Stack

**Core Testing:**

```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "vitest-mock-extended": "^2.0.0",
    "vite-tsconfig-paths": "^5.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "@faker-js/faker": "^9.0.0"
  }
}
```

### Assertion Libraries

**1. Built-in Vitest Assertions (Recommended)**

- Compatible with Jest API
- Zero additional dependencies
- All standard assertions included

**2. AssertiveTS (For Advanced Type Safety - Optional)**

```bash
pnpm add -D @assertive-ts/core
```

- Fluent, type-safe assertions
- Framework agnostic
- Better TypeScript inference

**3. Earl (Modern Alternative - Optional)**

```bash
pnpm add -D earl
```

- Type-safe validators
- Zod integration
- Built-in snapshot support

**Recommendation**: Start with Vitest built-in assertions.

### HTTP Request Testing

**1. Supertest (Industry Standard - Recommended)**

```bash
pnpm add -D supertest @types/supertest
```

**Pros:**

- Mature, stable, widely used
- Excellent Express integration
- Rich ecosystem

**2. supertest-fetch (Modern Alternative)**

```bash
pnpm add -D supertest-fetch
```

**Pros:**

- Native fetch API
- TypeScript-first
- Modern promise-based API

**Recommendation**: Use **supertest** - proven and reliable.

### Test Data Generation

**Faker.js**

```bash
pnpm add -D @faker-js/faker
```

**Usage:**

```typescript
import { faker } from '@faker-js/faker';

export const createAccountFixture = (overrides = {}) => ({
  accountNumber: faker.finance.accountNumber(),
  accountType: 'SAVINGS',
  currency: 'USD',
  balance: faker.finance.amount(0, 10000, 2),
  ...overrides,
});
```

### Coverage Tools

**Vitest Built-in Coverage (Using V8 - Recommended)**

```bash
pnpm add -D @vitest/coverage-v8
```

**Configuration:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types/',
        '**/__tests__/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Prisma-Specific Testing Utilities

| Library                | Purpose               | Recommendation |
| ---------------------- | --------------------- | -------------- |
| `vitest-mock-extended` | Mocking Prisma Client | Essential      |
| `prisma-mock-vitest`   | In-memory Prisma mock | Optional       |
| `@faker-js/faker`      | Realistic test data   | Recommended    |

---

## Configuration & Setup

### Vitest Configuration for TypeScript

**Main Configuration (vitest.config.ts):**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()], // Resolves path aliases from tsconfig
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/unit/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'tests/integration/**', 'tests/api/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'dist/', 'tests/**', 'src/**/*.d.ts', 'src/types/**'],
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
```

**Integration Test Configuration (vitest.config.integration.ts):**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/integration.setup.ts'],
    include: ['tests/integration/**/*.integration.spec.ts'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    pool: 'forks', // Use separate processes for integration tests
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    testTimeout: 30000, // Longer timeout for DB operations
    hookTimeout: 30000,
  },
});
```

### TypeScript Configuration for Tests

**Update tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "types": ["node", "vitest/globals"],
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Test Environment Setup

**Setup File (tests/setup/vitest.setup.ts):**

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

// Setup before all tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
});

// Reset mocks after each test
afterEach(() => {
  mockReset();
});

// Cleanup after all tests
afterAll(() => {
  // Any global cleanup
});
```

**Integration Setup (tests/setup/integration.setup.ts):**

```typescript
import { beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://testuser:testpass@localhost:5433/fintech_test',
    },
  },
});

// Clean database before each test
beforeEach(async () => {
  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.account.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
```

**Global Setup (tests/setup/global-setup.ts):**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

export async function setup() {
  dotenv.config({ path: '.env.test' });

  console.log('Starting test database...');
  await execAsync('docker-compose -f docker-compose.test.yml up -d');

  // Wait for database
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('Running migrations...');
  await execAsync('dotenv -e .env.test -- prisma migrate deploy');

  console.log('Test database ready!');
}

export async function teardown() {
  console.log('Stopping test database...');
  await execAsync('docker-compose -f docker-compose.test.yml down -v');
}
```

### Setup and Teardown Patterns

**Test Isolation Strategies:**

**1. Transaction Rollback (Fastest)**

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

**Pros**: Very fast, perfect isolation
**Cons**: Some Prisma features don't work in transactions

**2. Table Truncation (Recommended)**

```typescript
beforeEach(async () => {
  const tables = ['Transaction', 'Account', 'Customer'];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
});
```

**Pros**: Simple, reliable, works with all Prisma features
**Cons**: Slightly slower than transactions

**3. Database Per Test (Most Isolated)**

```typescript
beforeEach(async () => {
  const dbName = `test_${Date.now()}`;
  await createDatabase(dbName);
  // ... setup
});

afterEach(async () => {
  await dropDatabase(testDbUrl);
});
```

**Pros**: Complete isolation
**Cons**: Very slow, resource intensive

### Parallel Test Execution

**Configuration:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4, // Adjust based on CPU cores
      },
    },
    isolate: true,
    fileParallelism: true,
    globals: false, // Don't use global APIs to avoid conflicts
  },
});
```

**Database Isolation for Parallel Tests:**

```typescript
// Option 1: Separate Database Per Worker
const workerId = process.env.VITEST_POOL_ID || '0';
const dbName = `fintech_test_${workerId}`;
process.env.DATABASE_URL = `postgresql://user:pass@localhost:5432/${dbName}`;

// Option 2: Connection Pooling with Schemas
const schema = `test_worker_${process.env.VITEST_POOL_ID || '0'}`;
process.env.DATABASE_URL = `postgresql://user:pass@localhost:5432/fintech_test?schema=${schema}`;
```

**Best Practices:**

1. **Unit tests**: Fully parallel (no shared state)
2. **Integration tests**: Limited parallelism (database constraints)
3. **E2E tests**: Sequential (shared resources)

---

## Best Practices 2025

### Test Isolation

**Golden Rules:**

**1. No Shared Mutable State**

```typescript
// BAD: Shared state across tests
let sharedAccount: Account;

it('test 1', () => {
  sharedAccount = createAccount();
});

it('test 2', () => {
  updateAccount(sharedAccount); // Depends on test 1!
});

// GOOD: Each test is independent
it('test 1', () => {
  const account = createAccount();
  // Test logic
});

it('test 2', () => {
  const account = createAccount();
  updateAccount(account);
});
```

**2. Use beforeEach for Setup**

```typescript
describe('AccountService', () => {
  let service: AccountService;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new AccountService(mockRepository);
  });

  it('test 1', () => {
    /* Uses fresh service */
  });
  it('test 2', () => {
    /* Uses fresh service */
  });
});
```

**3. Clean Database Between Tests**

```typescript
beforeEach(async () => {
  await cleanDatabase(prisma);
});
```

**4. Deterministic Test Data**

```typescript
// BAD: Random data can cause flaky tests
const accountNumber = Math.random().toString();

// GOOD: Deterministic
const accountNumber = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Or use faker with seeds
faker.seed(123);
```

**5. Avoid Test Dependencies**

```typescript
// BAD: Tests depend on execution order
describe('Account lifecycle', () => {
  it('creates account', () => {
    /* Sets global accountId */
  });
  it('updates account', () => {
    /* Uses global accountId */
  });
});

// GOOD: Each test sets up its own context
describe('Account lifecycle', () => {
  it('creates account', async () => {
    const account = await createAccount();
    expect(account).toBeDefined();
  });

  it('updates account', async () => {
    const account = await createAccount();
    const updated = await updateAccount(account.id, { balance: 1000 });
    expect(updated.balance).toBe(1000);
  });
});
```

### Performance Optimization

**1. Mock External Dependencies in Unit Tests**

```typescript
vi.mock('@/shared/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));
```

**2. Use Transaction Rollback for Fast Cleanup**

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

**3. Parallel Execution**

```typescript
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: Math.floor(os.cpus().length / 2),
      },
    },
  },
});
```

**4. Use Fixtures/Factories**

```typescript
export const accountFixture = (overrides = {}) => ({
  accountNumber: 'ACC1234567890',
  accountType: 'SAVINGS',
  currency: 'USD',
  balance: 0,
  ...overrides,
});

it('should validate account', () => {
  const account = accountFixture({ balance: 1000 });
  expect(validateAccount(account)).toBe(true);
});
```

**5. Minimize Database Queries**

```typescript
// BAD: Multiple queries
const customer = await prisma.customer.create({ data: customerData });
const account = await prisma.account.create({
  data: { ...accountData, customerId: customer.id },
});

// GOOD: Single nested create
const customer = await prisma.customer.create({
  data: {
    ...customerData,
    accounts: {
      create: accountData,
    },
  },
  include: { accounts: true },
});
```

**6. Selective Test Execution**

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --config vitest.config.ts",
    "test:integration": "vitest --config vitest.config.integration.ts",
    "test:changed": "vitest --changed",
    "test:watch": "vitest --watch"
  }
}
```

### CI/CD Integration

**GitHub Actions Workflow (.github/workflows/test.yml):**

```yaml
name: Tests

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test:unit --run

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: fintech_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm db:generate

      - name: Run migrations
        run: pnpm db:migrate:deploy
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/fintech_test

      - name: Run integration tests
        run: pnpm test:integration --run
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/fintech_test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: integration
```

### TypeScript Testing Best Practices

**1. Leverage TypeScript for Type-Safe Tests**

```typescript
import type { AccountService } from './account.service';
import { mockDeep } from 'vitest-mock-extended';

const mockService = mockDeep<AccountService>();

// TypeScript will catch errors
mockService.createAccount.mockResolvedValue({
  id: '123',
  accountNumber: 'ACC123',
  accountType: 'SAVINGS',
  // TypeScript ensures all required fields
});
```

**2. Use Branded Types for Test Data**

```typescript
type AccountId = string & { readonly brand: unique symbol };
type CustomerId = string & { readonly brand: unique symbol };

export const createAccountId = (id: string): AccountId => id as AccountId;
export const createCustomerId = (id: string): CustomerId => id as CustomerId;

it('should find account by id', async () => {
  const accountId = createAccountId('acc-123');
  const account = await repository.findById(accountId);
  expect(account).toBeDefined();
});
```

**3. Test Types with assertType**

```typescript
import { assertType } from 'vitest';

it('should return correctly typed account', async () => {
  const account = await service.createAccount(input);

  // Compile-time type assertion
  assertType<Account>(account);

  // Runtime assertion
  expect(account).toMatchObject({
    id: expect.any(String),
    accountNumber: expect.any(String),
  });
});
```

**4. Use Const Assertions for Test Data**

```typescript
export const VALID_ACCOUNT = {
  accountNumber: 'ACC1234567890',
  accountType: 'SAVINGS',
  currency: 'USD',
  balance: 0,
} as const;

// TypeScript infers exact types
type ValidAccount = typeof VALID_ACCOUNT;
```

**5. Generic Test Utilities**

```typescript
export function createMockRepository<T extends Record<string, any>>(): DeepMockProxy<T> {
  return mockDeep<T>();
}

const mockAccountRepo = createMockRepository<AccountRepository>();
const mockCustomerRepo = createMockRepository<CustomerRepository>();
```

**6. Infer Types from Zod Schemas**

```typescript
import { z } from 'zod';

const createAccountSchema = z.object({
  customerId: z.uuid(),
  accountType: z.enum(['SAVINGS', 'CHECKING']),
  currency: z.string().length(3),
});

type CreateAccountInput = z.infer<typeof createAccountSchema>;

it('should validate input', () => {
  const input: CreateAccountInput = {
    customerId: '123e4567-e89b-12d3-a456-426614174000',
    accountType: 'SAVINGS',
    currency: 'USD',
  };

  const result = createAccountSchema.safeParse(input);
  expect(result.success).toBe(true);
});
```

**7. Test Error Types**

```typescript
class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = 'AccountNotFoundError';
  }
}

it('should throw AccountNotFoundError', async () => {
  await expect(() => service.findAccount('invalid-id')).rejects.toThrow(AccountNotFoundError);

  // Or with type assertion
  try {
    await service.findAccount('invalid-id');
    fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(AccountNotFoundError);
    assertType<AccountNotFoundError>(error);
  }
});
```

---

## Implementation Roadmap

### Phase 1: Setup Foundation (Week 1)

**1. Install Dependencies**

```bash
cd apps/backend
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 vitest-mock-extended supertest @types/supertest @faker-js/faker vite-tsconfig-paths
```

**2. Create Configuration Files**

- `vitest.config.ts` (unit tests)
- `vitest.config.integration.ts` (integration tests)
- `docker-compose.test.yml` (test database)
- `.env.test` (test environment variables)

**3. Setup Test Directory Structure**

```bash
# Create the centralized test directory structure
mkdir -p tests/{setup,fixtures,unit,integration,api,e2e}
```

```
apps/backend/
└── tests/
    ├── setup/
    │   ├── vitest.setup.ts
    │   ├── integration.setup.ts
    │   ├── global-setup.ts
    │   ├── test-db.ts
    │   └── prisma-mock.ts
    ├── fixtures/
    │   ├── account-fixtures.ts
    │   ├── customer-fixtures.ts
    │   └── transaction-fixtures.ts
    ├── unit/              # Mirror src/ structure here
    ├── integration/       # Integration tests
    ├── api/              # API tests
    └── e2e/              # E2E workflow tests
```

**4. Update package.json Scripts**

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:api": "vitest run tests/api",
    "test:e2e": "vitest run tests/e2e",
    "test:all": "pnpm test:unit && pnpm test:integration && pnpm test:api && pnpm test:e2e",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### Phase 2: Write First Tests (Week 2)

**1. Start with Simple Unit Tests**

- Test utility functions
- Test validation schemas
- Test middleware

**2. Add Controller Tests**

- Mock service layer
- Test request/response handling
- Test error cases

**3. Add Service Tests**

- Mock repository layer
- Test business logic
- Test edge cases

### Phase 3: Integration Tests (Week 3)

**1. Setup Test Database**

- Docker Compose configuration
- Migration strategy
- Seed data utilities

**2. Write First Integration Test**

- Test complete API endpoint
- Verify database changes
- Test error scenarios

**3. Add Repository Tests**

- Test Prisma queries
- Test data relationships
- Test transactions

### Phase 4: CI/CD Integration (Week 4)

**1. Setup GitHub Actions**

- Unit test workflow
- Integration test workflow
- Coverage reporting

**2. Add Pre-commit Hooks**

```bash
pnpm add -D husky lint-staged
```

```json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "vitest related --run"]
  }
}
```

**3. Documentation**

- Testing guidelines
- How to run tests
- How to write tests

---

## Quick Start Commands

```bash
# Install all testing dependencies
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 vitest-mock-extended supertest @types/supertest @faker-js/faker vite-tsconfig-paths

# Create test directory structure
cd apps/backend
mkdir -p tests/{setup,fixtures,unit,integration,api,e2e}

# Run different test types
pnpm test:unit          # Run unit tests only
pnpm test:integration   # Run integration tests (requires test DB)
pnpm test:api          # Run API tests (single endpoint tests)
pnpm test:e2e          # Run E2E tests (workflow tests)
pnpm test:all          # Run all test types sequentially

# Other test commands
pnpm test:coverage     # Run all tests with coverage report
pnpm test:watch        # Run tests in watch mode
pnpm test:ui           # Run tests with interactive UI
```

---

## Summary of Recommendations

### Framework & Tools

- **Testing Framework**: Vitest ⭐
- **HTTP Testing**: Supertest
- **Mocking**: vitest-mock-extended
- **Test Data**: @faker-js/faker
- **Coverage**: Vitest built-in v8 coverage
- **Assertion**: Vitest built-in (Jest-compatible)

### Testing Strategy (2025 Modern Approach)

- **Unit Tests**: Mock all external dependencies, located in `tests/unit/` (40-50%)
- **Integration Tests**: Real dependencies, test component interactions in `tests/integration/` (20-30%)
- **API Tests**: Single endpoint through full stack with real database in `tests/api/` (20-30%)
- **E2E Tests**: Multi-API workflows, complete user journeys in `tests/e2e/` (5-10%)
- **Test Isolation**: Table truncation between tests
- **Parallel Execution**: Unit tests fully parallel, integration tests limited parallelism

### Key Distinctions to Remember

- **API Test ≠ E2E Test**: API tests validate single endpoints; E2E tests validate workflows
- **Integration Test**: Can mean component interaction OR single API endpoint (terminology varies)
- **Backend E2E**: Workflow testing via HTTP (no browser/UI needed)
- **Subcutaneous Testing**: Testing just below the UI layer (REST API level)

### Project Structure

- **All tests centralized**: Under `apps/backend/tests/` directory
- **Unit tests**: `tests/unit/` mirroring source structure (`*.spec.ts`)
- **Integration tests**: `tests/integration/` (`*.integration.spec.ts`)
- **API tests**: `tests/api/` (`*.api.spec.ts`)
- **E2E tests**: `tests/e2e/` (`*.e2e.spec.ts`)
- **Test utilities**: `tests/setup/` and `tests/fixtures/`
- **Naming**: Clear distinction between test types with explicit directories

### CI/CD

- **GitHub Actions**: Separate jobs for unit, integration, and E2E tests
- **Database**: PostgreSQL service for integration tests
- **Caching**: pnpm dependencies
- **Coverage**: Upload to Codecov

### Best Practices 2025

- Test isolation with clean database state
- Type-safe tests leveraging TypeScript
- Fast feedback with parallel execution
- Comprehensive coverage with unit + integration tests
- Automated CI/CD pipeline

---

## Additional Resources

### Industry Standards & References

- **Martin Fowler**: [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- **Kent C. Dodds**: [Static vs Unit vs Integration vs E2E Tests](https://kentcdodds.com/blog/static-vs-unit-vs-integration-vs-e2e-tests)
- **Testing Trophy**: Alternative to pyramid for frontend-heavy apps
- **Subcutaneous Testing**: Testing below the UI (API level) for backend apps

### Modern Testing Tools (2025)

- **Vitest**: Modern, fast test runner with native ESM support
- **Supertest**: Industry standard for HTTP endpoint testing
- **Playwright**: For browser-based E2E testing (if needed)
- **@faker-js/faker**: Realistic test data generation
- **vitest-mock-extended**: Type-safe mocking for TypeScript

### Key Takeaways

1. **Terminology varies**: "Integration test" means different things to different teams
2. **API ≠ E2E**: Single endpoint tests are NOT the same as workflow tests
3. **Backend E2E**: Focuses on API workflows, not browser automation
4. **Test pyramid**: More unit tests, fewer E2E tests for speed and reliability
5. **Clear naming**: Use explicit file names to avoid confusion

---

**Last Updated**: 2025-11-24
**Version**: 2.0 (Updated with modern 2025 industry standards)
