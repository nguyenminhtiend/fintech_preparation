# Fintech Backend Coding Conventions

You are working on a **production-grade fintech modular monolith** built with Express, TypeScript, Prisma, and Zod. Follow these conventions strictly.

---

## 1. Naming Conventions

### Files & Folders

- **Files**: `[feature].[role].ts` (kebab-case)
  - ✅ `account.controller.ts`, `account.service.ts`, `database.config.ts`
- **Folders**: kebab-case
  - ✅ `modules/account`, `shared/middleware`

### File Roles (Suffixes)

- `controller` - HTTP request handlers (Controller layer)
- `service` - Business logic (Service layer)
- `repository` - Data access layer (Repository layer)
- `route` - Express route definitions
- `dto` - Data Transfer Objects (interfaces only)
- `schema` - Zod validation schemas
- `entity` - Database entity interfaces
- `middleware` - Express middleware functions
- `util` - Utility functions
- `config` - Configuration files
- `constant` - Application constants

### Code Naming

- **PascalCase**: Classes, Interfaces, Types, Enums
  - ✅ `AccountController`, `AccountEntity`, `CreateAccountDto`
- **camelCase**: Variables, functions, methods
  - ✅ `accountService`, `createAccount`, `generateAccountNumber`
- **UPPER_SNAKE_CASE**: Constants only
  - ✅ `HTTP_STATUS`, `DEFAULT_PORT`

---

## 2. Quality Assurance

### Mandatory Quality Check

**CRITICAL: After creating or editing ANY file, you MUST:**

1. **Run quality check:**

   ```bash
   pnpm check
   ```

2. **Fix ALL errors** before considering the task complete
   - Format errors → Fix with `pnpm format`
   - Lint errors → Fix manually or with ESLint auto-fix
   - Type errors → Fix TypeScript issues

3. **Report results to user:**
   - If checks pass: Confirm success
   - If checks fail: Show errors and fix them immediately

**This is NON-NEGOTIABLE. Never present code to the user without running `pnpm check` and ensuring it passes.**

---

## 3. TypeScript Standards

### Type Imports

**ALWAYS use inline type imports** (enforced by ESLint):

```typescript
import { type Request, type Response } from 'express';
import { type AccountEntity } from '../interfaces/account.entity';
```

### Object Shapes

- **Use `interface`** for object shapes and DTOs
- **Use `type`** ONLY for unions, intersections, or complex types

```typescript
// ✅ CORRECT
export interface CreateAccountDto {
  customerId: string;
  currency: string;
}

// ❌ AVOID
export type CreateAccountDto = {
  customerId: string;
  currency: string;
};
```

### Return Types

**ALWAYS specify explicit return types** on all functions:

```typescript
async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
  // implementation
}
```

### TypeScript Config

- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode: enabled
- Avoid `any` (will be linted as error)

---

## 4. Architecture & Layering

### Three-Layer Architecture

**Controller → Service → Repository → Database**

#### Controller Layer

- Handle HTTP requests/responses
- Validate input using middleware
- Map entities to DTOs
- **NO business logic**

```typescript
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  createAccount = async (req: Request, res: Response): Promise<void> => {
    const { customerId, currency } = req.body as CreateAccountDto;
    const account = await this.accountService.createAccount({ customerId, currency });
    const response = this.mapToAccountResponse(account);
    res.status(201).json(response);
  };
}
```

#### Service Layer

- Pure business logic
- NO HTTP/framework dependencies
- Coordinate between repositories
- Throw typed errors

```typescript
export class AccountService {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
    const accountNumber = this.generateAccountNumber();
    return await this.accountRepository.create({ ...input, accountNumber });
  }
}
```

#### Repository Layer

- Data access ONLY
- Prisma operations
- **ALWAYS define repository interface**
- NO business logic

```typescript
export interface IAccountRepository {
  create(data: CreateAccountData): Promise<AccountEntity>;
  findById(id: string): Promise<AccountEntity | null>;
}

export class AccountRepository implements IAccountRepository {
  constructor(private readonly db: Database) {}
  // implementation
}
```

### Module Structure

**Every module MUST follow this exact structure:**

```
modules/[feature]/
├── [feature].module.ts     # Module setup & DI
├── controllers/            # HTTP handlers
│   ├── [feature].controller.ts
│   └── index.ts
├── services/               # Business logic
│   ├── [feature].service.ts
│   └── index.ts
├── repositories/           # Data access
│   ├── [feature].repository.ts
│   └── index.ts
├── dto/                    # Data Transfer Objects (interfaces)
│   ├── [feature].dto.ts
│   └── index.ts
├── schemas/                # Zod validation schemas
│   ├── [feature].schema.ts
│   └── index.ts
├── interfaces/             # Entity interfaces
│   ├── [feature].entity.ts
│   └── index.ts
└── routes/                 # Express routes
    ├── [feature].route.ts
    └── index.ts
```

### Module Isolation

- Modules **CANNOT** access other modules' repositories, services, or database tables
- Use REST APIs or shared interfaces for cross-module communication
- Shared code lives in `shared/` or `packages/shared/`

---

## 5. Code Quality

### Logging

**NEVER use `console.log`**. Use Pino logger:

```typescript
import { logger } from '@shared/utils';

logger.info('Account created', { accountId: account.id });
logger.error('Failed to create account', { error, customerId });
```

### Error Handling

**ALWAYS use typed custom errors:**

```typescript
import { NotFoundError, BadRequestError } from '@shared/utils';

if (!account) {
  throw new NotFoundError('Account not found');
}
```

Available error classes:

- `AppError` (base class)
- `NotFoundError` (404)
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)

### Async/Await

- Pure async/await (NO `.then()` mixing)
- Use `Promise.all()` for parallel operations

### Import Order

**Auto-sorted by ESLint (simple-import-sort):**

1. Node.js built-ins (`node:*`)
2. External packages (excluding `@shared`)
3. Internal packages (`@shared`, `@modules`, etc.)
4. Parent imports (`../`)
5. Sibling/local imports (`./`)

---

## 6. Validation

### Zod Schemas

Define schemas in `schemas/` folder:

```typescript
import { z } from 'zod';

export const createAccountSchema = z.object({
  customerId: z.uuid('Invalid customer ID format'),
  currency: z.string().length(3).toUpperCase(),
});
```

### Validation Middleware

**ALWAYS validate in routes:**

```typescript
import { validateBody } from '@shared/middleware';
import { createAccountSchema } from '../schemas/account.schema';

router.post('/', validateBody(createAccountSchema), controller.createAccount);
```

### DTOs

**Define DTOs as interfaces** (NOT Zod-inferred):

```typescript
export interface CreateAccountDto {
  customerId: string;
  currency: string;
}
```

---

## 7. Security

- **Environment variables**: NO defaults for sensitive values (throw if missing)
- **Authentication**: JWT + refresh tokens, bcrypt (≥10 rounds)
- **Input validation**: ALL inputs validated via Zod middleware
- **Database queries**: Parameterized via Prisma
- **Helmet**: Applied for security headers

---

## 8. Performance

- **Database**: Select specific fields, use `where`/`take` for filtering
- **Parallel operations**: Use `Promise.all()` when operations are independent
- **BigInt**: Use for monetary values (converted to `number` in DTOs)

---

## 9. Monorepo Structure

```
fintech-preparation/
├── apps/
│   └── backend/              # Main Express application
│       ├── src/
│       │   ├── modules/      # Feature modules
│       │   ├── shared/       # Shared backend code
│       │   ├── app.ts
│       │   └── server.ts
│       └── prisma/           # Database schema & migrations
├── packages/
│   └── shared/               # Shared across apps
│       ├── src/
│       │   ├── constants/
│       │   └── types/
└── pnpm-workspace.yaml
```

---

## 10. Enforcement Checklist

**Before writing ANY code, verify:**

- [ ] Using inline type imports (`import { type ... }`)
- [ ] Using `interface` for DTOs (not `type`)
- [ ] Return types explicit on ALL functions
- [ ] Repository has interface (`IXRepository`)
- [ ] Service has NO HTTP dependencies
- [ ] Controller has NO business logic
- [ ] Using Pino logger (NOT `console.log`)
- [ ] Using typed errors from `@shared/utils`
- [ ] All inputs validated with Zod
- [ ] Following module structure exactly
- [ ] Imports properly ordered
- [ ] File naming: `[feature].[role].ts`

**After creating/editing ANY file:**

- [ ] **Run `pnpm check` and ensure it passes**
- [ ] Fix all formatting, linting, and type errors
- [ ] Confirm to user that quality checks pass

---

## 11. Common Patterns

### Creating a New Module

When asked to create a new module (e.g., "transaction"):

1. **Create folder structure:**

   ```
   modules/transaction/
   ├── transaction.module.ts
   ├── controllers/
   ├── services/
   ├── repositories/
   ├── dto/
   ├── schemas/
   ├── interfaces/
   └── routes/
   ```

2. **Create in this order:**
   - Entity interface (`interfaces/transaction.entity.ts`)
   - DTOs (`dto/transaction.dto.ts`)
   - Schemas (`schemas/transaction.schema.ts`)
   - Repository interface + implementation (`repositories/transaction.repository.ts`)
   - Service (`services/transaction.service.ts`)
   - Controller (`controllers/transaction.controller.ts`)
   - Routes (`routes/transaction.route.ts`)
   - Module setup (`transaction.module.ts`)

3. **Always create `index.ts` in each folder** for clean exports

### Adding a New Endpoint

1. Define Zod schema in `schemas/`
2. Define DTO interface in `dto/`
3. Add service method (business logic)
4. Add controller method (HTTP handling)
5. Add route with validation middleware
6. Export route in module

---

## 12. Quick Reference

**Do's:**

- ✅ Use inline type imports
- ✅ Use `interface` for DTOs
- ✅ Define repository interfaces
- ✅ Use Pino logger
- ✅ Use typed errors
- ✅ Validate all inputs
- ✅ Explicit return types
- ✅ Three-layer architecture
- ✅ **Run `pnpm check` after every file change**

**Don'ts:**

- ❌ Use `console.log`
- ❌ Use `type` for DTOs
- ❌ Put business logic in controllers
- ❌ Put HTTP code in services
- ❌ Access other modules' repositories
- ❌ Forget validation middleware
- ❌ Use `any` type
- ❌ Mix `.then()` with async/await
- ❌ **Skip quality checks before presenting code**
