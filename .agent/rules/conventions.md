---
trigger: always_on
---

# Coding Conventions

## 1. Naming Conventions

### Files & Folders

- **Files**: `[feature].[role].ts` (kebab-case)
  - Examples: `account.controller.ts`, `account.service.ts`, `database.config.ts`
- **Folders**: kebab-case
  - Examples: `modules/account`, `shared/middleware`

### File Roles (Suffixes)

- **controller**: HTTP request handlers (Controller layer)
- **service**: Business logic (Service layer)
- **repository**: Data access layer (Repository layer)
- **route**: Express route definitions
- **dto**: Data Transfer Objects (interfaces only)
- **schema**: Zod validation schemas
- **entity**: Database entity interfaces
- **middleware**: Express middleware functions
- **util**: Utility functions
- **config**: Configuration files
- **constant**: Application constants

### Code Naming

- **PascalCase**: Classes, Interfaces, Types, Enums
  - Examples: `AccountController`, `AccountEntity`, `CreateAccountDto`
- **camelCase**: Variables, functions, methods
  - Examples: `accountService`, `createAccount`, `generateAccountNumber`
- **UPPER_SNAKE_CASE**: Constants only
  - Examples: `HTTP_STATUS`, `DEFAULT_PORT`

## 2. Quality Assurance

### Mandatory Quality Check

**After creating or editing ANY file:**

1. Run `pnpm check` to verify:
   - Prettier formatting
   - ESLint rules
   - TypeScript type checking

2. Fix ALL errors before considering task complete:
   - Format errors → `pnpm format`
   - Lint errors → Fix manually or auto-fix
   - Type errors → Fix TypeScript issues

3. Report results to user (pass/fail)

**This ensures code quality is maintained at all times.**

## 3. TypeScript Standards

### Type Imports

Use inline type imports (enforced by ESLint):

```typescript
import { type Request, type Response } from 'express';
import { type AccountEntity } from '../interfaces/account.entity';
```

### Object Shapes

- **Use `interface`** for object shapes and DTOs
- **Use `type`** only for unions, intersections, or complex types

```typescript
// ✅ Correct
export interface CreateAccountDto {
  customerId: string;
  currency: string;
}

// ❌ Avoid
export type CreateAccountDto = {
  customerId: string;
  currency: string;
};
```

### Return Types

Always specify explicit return types on functions:

```typescript
async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
  // implementation
}
```

### Compiler Settings

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: enabled
- **No `any`**: avoided (linted)

## 4. Architecture & Layering

### Three-Layer Architecture

**Controller → Service → Repository → Database**

#### Controller Layer

- Handle HTTP requests/responses
- Validate input using middleware
- Map entities to DTOs
- NO business logic

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
- No HTTP/framework dependencies
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

- Data access only
- Prisma operations
- Define repository interface
- No business logic

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

Each module follows this structure:

```
modules/account/
├── account.module.ts        # Module setup & DI
├── controllers/             # HTTP handlers
│   ├── account.controller.ts
│   └── index.ts
├── services/                # Business logic
│   ├── account.service.ts
│   └── index.ts
├── repositories/            # Data access
│   ├── account.repository.ts
│   └── index.ts
├── dto/                     # Data Transfer Objects (interfaces)
│   ├── account.dto.ts
│   └── index.ts
├── schemas/                 # Zod validation schemas
│   ├── account.schema.ts
│   └── index.ts
├── interfaces/              # Entity interfaces
│   ├── account.entity.ts
│   └── index.ts
└── routes/                  # Express routes
    ├── account.route.ts
    └── index.ts
```

### Module Isolation

- Modules CANNOT access other modules' repositories, services, or database tables
- Use REST APIs or shared interfaces for cross-module communication
- Shared code lives in `shared/` or `packages/shared/`

## 5. Code Quality

### Logging

Use Pino logger (never `console.log`):

```typescript
import { logger } from '@shared/utils';

logger.info('Account created', { accountId: account.id });
logger.error('Failed to create account', { error, customerId });
```

### Error Handling

Use typed custom errors:

```typescript
import { NotFoundError, BadRequestError } from '@shared/utils';

if (!account) {
  throw new NotFoundError('Account not found');
}
```

Available error classes:

- `AppError` (base)
- `NotFoundError` (404)
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)

### Async/Await

- Pure async/await (no `.then()` mixing)
- Use `Promise.all()` for parallel operations

### Import Order

Enforced by ESLint (simple-import-sort):

1. Node.js built-ins (`node:*`)
2. External packages (excluding `@shared`)
3. Internal packages (`@shared`, `@modules`, etc.)
4. Parent imports (`../`)
5. Sibling/local imports (`./`)

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

Use in routes:

```typescript
import { validateBody } from '@shared/middleware';
import { createAccountSchema } from '../schemas/account.schema';

router.post('/', validateBody(createAccountSchema), controller.createAccount);
```

### DTOs

Define DTOs as interfaces (not inferred from Zod):

```typescript
export interface CreateAccountDto {
  customerId: string;
  currency: string;
}
```

## 7. Security

- **Environment variables**: No defaults for sensitive values (throw if missing)
- **Authentication**: JWT + refresh tokens, bcrypt (≥10 rounds)
- **Input validation**: All inputs validated via Zod middleware
- **Database queries**: Parameterized via Prisma
- **Helmet**: Applied for security headers

## 8. Performance

- **Database**: Select specific fields, use `where`/`take` for filtering
- **Parallel operations**: Use `Promise.all()` when operations are independent
- **BigInt**: Use for monetary values (converted to numbers in DTOs)

## 9. Git Workflow

### Commit Format

```
<type>(<scope>): <subject>

<body>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

**Examples**:

- `feat(account): add account creation endpoint`
- `fix(auth): resolve token expiration issue`
- `refactor(repository): abstract account repository interface`

### Pre-commit Hooks

Lint-staged runs on staged files:

- Prettier formatting
- ESLint fixes
- Type checking

## 10. Tooling Configuration

### Prettier

```js
{
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: 'all',
  arrowParens: 'always',
}
```

### ESLint

Key rules:

- `no-console`: warn
- `@typescript-eslint/no-unused-vars`: error (except `_` prefix)
- `@typescript-eslint/consistent-type-imports`: error (inline type imports)
- `@typescript-eslint/consistent-type-exports`: error
- `simple-import-sort/imports`: error (auto-sortable)

### NPM Scripts

- `pnpm dev`: Start development server (tsx watch)
- `pnpm build`: Build for production (tsc + tsc-alias)
- `pnpm quality`: Run format:check + lint + typecheck
- `pnpm check`: Run format + lint + typecheck

## 11. Monorepo Structure

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

## 12. Enforcement Checklist

Before writing code:

- [ ] Using inline type imports
- [ ] Using `interface` for DTOs
- [ ] Return types explicit on functions
- [ ] Repository has interface
- [ ] Service has no HTTP dependencies
- [ ] Controller has no business logic
- [ ] Using Pino logger (not `console.log`)
- [ ] Using typed errors from `@shared/utils`
- [ ] All inputs validated with Zod
- [ ] Following module structure exactly

After creating/editing files:

- [ ] **Run `pnpm check` and ensure it passes**
- [ ] Fix all formatting, linting, and type errors
- [ ] Confirm to user that quality checks pass

Before committing:

- [ ] `pnpm quality` passes
- [ ] No `console.log` statements
- [ ] Proper error handling with typed errors
- [ ] All inputs validated with Zod
- [ ] Repository abstracted with interface
