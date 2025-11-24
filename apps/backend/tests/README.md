# Testing Setup

This directory contains all test files, utilities, and setup configuration for the backend application.

## Directory Structure

```
tests/
├── setup/                    # Test configuration
│   ├── vitest.setup.ts      # Global test setup and configuration
│   ├── integration.setup.ts # Integration test setup (to be added)
│   ├── global-setup.ts      # Global setup/teardown (to be added)
│   ├── test-db.ts           # Test database utilities (to be added)
│   └── prisma-mock.ts       # Prisma client mocking utilities
├── fixtures/                 # Test data factories
│   └── (to be added)
├── unit/                     # Unit tests (mirrors src/ structure)
│   └── shared/
│       └── utils/
│           └── math.util.spec.ts
├── integration/              # Integration tests (component interactions)
│   └── (to be added)
├── api/                      # API tests (single endpoint tests)
│   └── (to be added)
└── e2e/                      # E2E workflow tests
    └── (to be added)
```

## Available Test Commands

Run from project root or backend directory:

```bash
# Run all unit tests
pnpm test:unit

# Run integration tests (requires test DB)
pnpm test:integration

# Run API tests
pnpm test:api

# Run E2E tests
pnpm test:e2e

# Run all test types
pnpm test:all

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Open Vitest UI (interactive test runner)
pnpm test:ui

# Run tests (default - watch mode)
pnpm test
```

## Writing Tests

### Test File Organization

All test files are centralized in the `tests/` directory:

- **Unit tests**: `tests/unit/**/*.spec.ts` (mirrors src/ structure)
- **Integration tests**: `tests/integration/**/*.integration.spec.ts`
- **API tests**: `tests/api/**/*.api.spec.ts`
- **E2E tests**: `tests/e2e/**/*.e2e.spec.ts`

### Example Unit Test

```typescript
// tests/unit/shared/utils/math.util.spec.ts
import { describe, it, expect } from 'vitest';
import { sum } from '@shared/utils/math.util';

describe('Math Utilities - Unit Tests', () => {
  describe('sum', () => {
    it('should add two positive numbers correctly', () => {
      const result = sum(2, 3);
      expect(result).toBe(5);
    });

    it('should handle zero correctly', () => {
      const result = sum(0, 5);
      expect(result).toBe(5);
    });
  });
});
```

### Using Prisma Mocks

```typescript
// tests/unit/modules/account/repositories/account.repository.spec.ts
import { describe, it, expect } from 'vitest';
import { prismaMock } from '../../../../setup/prisma-mock';
import { AccountRepository } from '@modules/account/repositories';

describe('AccountRepository - Unit', () => {
  it('should fetch account from database', async () => {
    const mockAccount = {
      id: '1',
      accountNumber: 'ACC001',
      accountType: 'SAVINGS',
      balance: 1000
    };
    prismaMock.account.findUnique.mockResolvedValue(mockAccount);

    const repository = new AccountRepository(prismaMock);
    const result = await repository.findById('1');

    expect(result).toEqual(mockAccount);
    expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
      where: { id: '1' }
    });
  });
});
```

## Test Configuration

The test setup includes:

- **Vitest** as the test runner
- **vitest-mock-extended** for type-safe mocking
- **vite-tsconfig-paths** for path alias resolution
- **@faker-js/faker** for test data generation
- **supertest** for HTTP endpoint testing (for integration tests)

## Next Steps

- Write unit tests for controllers, services, and repositories
- Add integration tests configuration for database testing
- Create test fixtures for common test data
- Set up E2E tests for complete workflows

Refer to `/docs/TESTING-GUIDE.md` for comprehensive testing guidelines.
