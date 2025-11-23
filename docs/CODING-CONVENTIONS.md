# Project Coding Conventions & Architectural Rules

## 1. File & Folder Naming Conventions

### File Naming Pattern: `[feature-name].[role].ts`

- **Feature name**: Always in **kebab-case**
- **Role**: Clearly defines the architectural layer
- **Valid roles**:
  - `controller` → HTTP request handling (deprecated, use `handler`)
  - `handler` → HTTP request handling (preferred)
  - `service` → Business logic layer
  - `repository` → Data access layer
  - `route` → Route definitions
  - `model` → Data models
  - `interface` → TypeScript interfaces
  - `middleware` → Express middleware
  - `util` → Utility functions
  - `type` → Type definitions
  - `config` → Configuration files
  - `dto` → Data Transfer Objects
  - `validator` → Validation schemas
  - `constant` → Constants
  - `enum` → Enumerations

#### Examples

✅ **Correct**:

- `user-profile.handler.ts`
- `create-payment.service.ts`
- `user-auth.repository.ts`
- `validate-email.util.ts`
- `payment-request.dto.ts`

❌ **Incorrect**:

- `UserProfileHandler.ts` (PascalCase)
- `user_profile_handler.ts` (snake_case)
- `userprofilehandler.ts` (no separation)
- `handler.ts` (missing feature name)

### Folder Naming

- Use **kebab-case** for all directories
- Examples:
  - `user-management/`
  - `payment-processing/`
  - `shared-utilities/`

## 2. TypeScript Style Guide

### Type Imports

```typescript
// ✅ Correct - inline type import
import { type User, createUser } from './user';

// ❌ Incorrect - separate type import
import type { User } from './user';
import { createUser } from './user';
```

### Object Types

```typescript
// ✅ Prefer interfaces for object shapes
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// ⚠️ Use types only for unions, intersections, or complex types
type UserRole = 'admin' | 'user' | 'guest';
type UserWithRole = UserProfile & { role: UserRole };
```

### Naming Conventions

- **PascalCase**: Classes, Interfaces, Types, Enums
- **camelCase**: Variables, Functions, Parameters, Methods
- **UPPER_SNAKE_CASE**: Constants
- **kebab-case**: Files, Folders

```typescript
// Constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// Interfaces/Types
interface PaymentService {}
type PaymentStatus = 'pending' | 'completed';

// Functions/Variables
const getUserById = async (userId: string) => {};
const isAuthenticated = true;
```

## 3. Module Architecture Rules

### Strict Layering

Each module MUST follow this hierarchy:

1. **Handler Layer** → Receives HTTP requests
2. **Service Layer** → Contains business logic
3. **Repository Layer** → Manages data access

### Layer Dependencies

```
Handler → Service → Repository → Database
   ↓         ↓          ↓
  DTO     Interface   Prisma
```

### Module Isolation Rules

- ❌ Modules CANNOT directly access each other's:
  - Database tables
  - Repositories
  - Internal services

- ✅ Modules CAN communicate through:
  - Well-defined APIs
  - Event bus (if implemented)
  - Shared types/interfaces

### Example Module Structure

```typescript
// handler layer - auth.handler.ts
export class AuthHandler {
  constructor(private authService: AuthService) {}

  async login(req: Request, res: Response) {
    const validated = loginSchema.parse(req.body);
    const result = await this.authService.authenticate(validated);
    return res.json(result);
  }
}

// service layer - auth.service.ts
export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async authenticate(credentials: LoginDto): Promise<AuthResult> {
    // Pure business logic, no HTTP concerns
    const user = await this.userRepository.findByEmail(credentials.email);
    // ... business logic
    return result;
  }
}

// repository layer - user.repository.ts
export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

## 4. Code Quality Standards

### Logging

```typescript
// ✅ Correct - use structured logging
import { logger } from '@shared/utils/logger';

logger.info('User authenticated', { userId: user.id, timestamp: Date.now() });
logger.error('Payment failed', { error, paymentId, userId });

// ❌ Incorrect - console.log
console.log('User authenticated');
console.error('Error:', error);
```

### Error Handling

```typescript
// ✅ Correct - proper error handling
try {
  const result = await paymentService.process(payment);
  return { success: true, data: result };
} catch (error) {
  logger.error('Payment processing failed', { error, paymentId });

  if (error instanceof ValidationError) {
    return { success: false, error: 'Invalid payment data' };
  }

  throw new InternalServerError('Payment processing failed');
}

// ❌ Incorrect - swallowing errors
try {
  return await paymentService.process(payment);
} catch (error) {
  console.log(error);
  return null;
}
```

### Async/Await Pattern

```typescript
// ✅ Correct
async function getUser(id: string): Promise<User> {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

// ❌ Incorrect - mixing promises and async/await
async function getUser(id: string) {
  return userRepository.findById(id).then(user => {
    if (!user) throw new Error('Not found');
    return user;
  });
}
```

## 5. Import/Export Conventions

### Import Organization

```typescript
// 1. External packages
import express from 'express';
import { z } from 'zod';

// 2. Shared/Common modules
import { logger } from '@shared/utils/logger';
import { type ApiResponse } from '@shared/types';

// 3. Same module imports
import { UserService } from '../services';
import { type CreateUserDto } from '../dto';

// 4. Relative imports
import { validateUser } from './user-validator';
```

### Barrel Exports (index.ts)

```typescript
// ✅ Correct - import from barrel
import { UserService, PaymentService } from './services';

// ❌ Incorrect - direct file import
import { UserService } from './services/user.service';
import { PaymentService } from './services/payment.service';
```

### Module Exports

```typescript
// services/index.ts
export { UserService } from './user.service';
export { PaymentService } from './payment.service';
export { type ServiceConfig } from './service.interface';
```

## 6. Validation with Zod

### Schema Definition

```typescript
// ✅ Correct - detailed validation
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  age: z.number().int().min(18, 'Must be 18 or older').optional()
});

// Type inference
export type CreateUserDto = z.infer<typeof createUserSchema>;
```

### Validation Middleware

```typescript
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
};
```

## 7. Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

## 8. ESLint Rules (Key Highlights)

```json
{
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": "error",
    "prefer-const": "error",
    "curly": ["error", "all"],
    "eqeqeq": ["error", "always"],
    "no-var": "error"
  }
}
```

## 9. Testing Conventions

### Test File Naming

- Unit tests: `[feature].service.spec.ts`
- Integration tests: `[feature].integration.spec.ts`
- E2E tests: `[feature].e2e.spec.ts`

### Test Structure

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new UserService(mockRepository);
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'Test123!' };
      mockRepository.create.mockResolvedValue({ id: '1', ...userData });

      // Act
      const result = await service.createUser(userData);

      // Assert
      expect(result).toHaveProperty('id');
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error for duplicate email', async () => {
      // Test implementation
    });
  });
});
```

## 10. Git Commit Conventions

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(payment): add stripe payment integration

- Implement Stripe SDK integration
- Add payment processing service
- Create payment webhook handler

Closes #123
```

## 11. Security Best Practices

### Environment Variables

```typescript
// ✅ Correct
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is required');
}

// ❌ Incorrect
const dbUrl = process.env.DATABASE_URL || 'postgres://localhost/mydb';
```

### Input Validation

- Always validate input with Zod schemas
- Sanitize user inputs
- Use parameterized queries (handled by Prisma)
- Implement rate limiting

### Authentication

- Use JWT with proper expiration
- Implement refresh token rotation
- Hash passwords with bcrypt (min 10 rounds)
- Use secure session configuration

## 12. Performance Guidelines

### Database Queries

```typescript
// ✅ Correct - select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true
  },
  where: { isActive: true },
  take: 10
});

// ❌ Incorrect - fetching everything
const users = await prisma.user.findMany();
```

### Async Operations

```typescript
// ✅ Correct - parallel execution
const [users, payments] = await Promise.all([userService.getUsers(), paymentService.getPayments()]);

// ❌ Incorrect - sequential execution
const users = await userService.getUsers();
const payments = await paymentService.getPayments();
```

## 13. Documentation Standards

### JSDoc for Public APIs

```typescript
/**
 * Authenticates a user with email and password
 * @param credentials - User login credentials
 * @returns Authentication result with tokens
 * @throws {UnauthorizedError} When credentials are invalid
 */
export async function authenticate(credentials: LoginDto): Promise<AuthResult> {
  // Implementation
}
```

### README Requirements

Each module should have a README with:

- Purpose and responsibilities
- API endpoints
- Configuration requirements
- Testing instructions
- Deployment notes

## 14. Monitoring & Observability

### Structured Logging

```typescript
logger.info('operation.start', {
  operation: 'createPayment',
  userId,
  amount,
  currency,
  timestamp: Date.now()
});

logger.info('operation.complete', {
  operation: 'createPayment',
  userId,
  paymentId: result.id,
  duration: Date.now() - startTime
});
```

### Metrics Collection

- Response times
- Error rates
- Business metrics
- Database query performance

## 15. Quality Checklist

Before committing code, ensure:

- [ ] Code passes `pnpm quality` check
- [ ] All tests pass
- [ ] No console.log statements
- [ ] Proper error handling
- [ ] Input validation implemented
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Follows naming conventions
- [ ] Proper logging in place

## Enforcement

These conventions are enforced through:

1. **ESLint** - Code style and quality
2. **Prettier** - Code formatting
3. **TypeScript** - Type safety
4. **Husky** - Pre-commit hooks
5. **CI/CD** - Automated checks
6. **Code Reviews** - Manual verification

Run `pnpm quality` to verify compliance with all conventions.
