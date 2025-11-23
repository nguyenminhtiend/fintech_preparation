# Complete Module Structure Guide

This guide demonstrates a complete module implementation following clean architecture principles with Express.js, TypeScript, and dependency injection.

## Module Structure

```
src/modules/auth/
├── controllers/
│   ├── auth.controller.ts
│   └── index.ts
├── services/
│   ├── auth.service.ts
│   └── index.ts
├── repositories/
│   ├── auth.repository.ts
│   └── index.ts
├── dto/
│   ├── auth.dto.ts
│   └── index.ts
├── routes/
│   ├── auth.route.ts
│   └── index.ts
├── interfaces/
│   ├── auth.interface.ts
│   └── index.ts
├── auth.module.ts       # DI setup
└── __tests__/
    ├── controllers/
    │   └── auth.controller.spec.ts
    ├── services/
    │   └── auth.service.spec.ts
    └── repositories/
        └── auth.repository.spec.ts
```

---

## 1. DTOs & Validation

```typescript
// dto/auth.dto.ts
import { z } from 'zod';

// Login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginDto = z.infer<typeof loginSchema>;

// Register
export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(2).max(100)
});
export type RegisterDto = z.infer<typeof registerSchema>;

// Response
export interface AuthResult {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}
```

---

## 2. Controller (HTTP Layer)

```typescript
// controllers/auth.controller.ts
import { type Request, type Response } from 'express';
import { type AuthService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../dto/auth.dto';
import { logger } from '@shared/logger';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Arrow function - auto-binds 'this'
  login = async (req: Request, res: Response): Promise<void> => {
    const data = loginSchema.parse(req.body);
    const result = await this.authService.authenticate(data);

    logger.info('User logged in', { userId: result.user.id });
    res.json(result);
  };

  register = async (req: Request, res: Response): Promise<void> => {
    const data = registerSchema.parse(req.body);
    const result = await this.authService.register(data);

    logger.info('User registered', { userId: result.user.id });
    res.status(201).json(result);
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const result = await this.authService.refreshToken(refreshToken);

    res.json(result);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    await this.authService.logout(refreshToken);

    res.status(204).send();
  };
}
```

---

## 3. Service (Business Logic)

```typescript
// services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { type UserRepository } from '../repositories/auth.repository';
import { type LoginDto, type RegisterDto, type AuthResult } from '../dto/auth.dto';
import { UnauthorizedError, ConflictError } from '@shared/errors';
import { logger } from '@shared/logger';

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async authenticate(credentials: LoginDto): Promise<AuthResult> {
    logger.info('Authenticating user', { email: credentials.email });

    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    await this.userRepository.saveRefreshToken(user.id, refreshToken);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async register(data: RegisterDto): Promise<AuthResult> {
    logger.info('Registering user', { email: data.email });

    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await this.userRepository.create({
      email: data.email,
      name: data.name,
      hashedPassword
    });

    const token = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    await this.userRepository.saveRefreshToken(user.id, refreshToken);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async refreshToken(token: string): Promise<Pick<AuthResult, 'token'>> {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };

    const isValid = await this.userRepository.verifyRefreshToken(payload.userId, token);
    if (!isValid) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const newToken = this.generateAccessToken(payload.userId);
    return { token: newToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    await this.userRepository.deleteRefreshToken(payload.userId, refreshToken);
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  }
}
```

---

## 4. Repository (Data Access)

```typescript
// repositories/auth.repository.ts
import { type Database } from '@shared/database';
import { users } from '@shared/database/schema';
import { eq } from 'drizzle-orm';

export interface CreateUserData {
  email: string;
  name: string;
  hashedPassword: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  createdAt: Date;
}

export class UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email)
    });
    return result || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.id, id)
    });
    return result || null;
  }

  async create(data: CreateUserData): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async saveRefreshToken(userId: string, token: string): Promise<void> {
    // Store in database (could be separate table or Redis)
    await this.db.update(users).set({ refreshToken: token }).where(eq(users.id, userId));
  }

  async verifyRefreshToken(userId: string, token: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.refreshToken === token;
  }

  async deleteRefreshToken(userId: string, token: string): Promise<void> {
    await this.db.update(users).set({ refreshToken: null }).where(eq(users.id, userId));
  }
}
```

---

## 5. Routes

```typescript
// routes/auth.route.ts
import { Router } from 'express';
import { type AuthController } from '../controllers/auth.controller';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  // Express v5 natively supports async/await - no wrapper needed
  router.post('/login', controller.login);
  router.post('/register', controller.register);
  router.post('/refresh', controller.refreshToken);
  router.post('/logout', controller.logout);

  return router;
}
```

---

## 6. Module Setup (DI)

```typescript
// auth.module.ts
import { type Database } from '@shared/database';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { UserRepository } from './repositories/auth.repository';
import { createAuthRouter } from './routes/auth.route';

export function createAuthModule(db: Database) {
  // Build dependency chain (bottom-up)
  const userRepository = new UserRepository(db);
  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);
  const authRouter = createAuthRouter(authController);

  return {
    authRouter,
    authService // Export for other modules if needed
  };
}
```

---

## 7. Global Error Handler

```typescript
// shared/middleware/error-handler.ts
import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '@shared/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', { errors: error.errors, path: req.path });
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors
    });
    return;
  }

  // Custom app errors
  if (error instanceof AppError) {
    logger.warn('Application error', {
      message: error.message,
      code: error.code,
      path: req.path
    });
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
    return;
  }

  // Unknown errors
  logger.error('Unexpected error', {
    message: error.message,
    stack: error.stack,
    path: req.path
  });
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
```

---

## 8. App Setup

```typescript
// app.ts
import express from 'express';
import { createAuthModule } from './modules/auth/auth.module';
import { createDatabase } from './shared/database';
import { errorHandler } from './shared/middleware/error-handler';

export function createApp() {
  const app = express();
  const db = createDatabase();

  // Global middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Modules
  const { authRouter } = createAuthModule(db);
  app.use('/auth', authRouter);

  // Global error handler (MUST be last)
  app.use(errorHandler);

  return app;
}
```

---

## 9. Unit Tests

### Controller Tests

```typescript
// __tests__/controllers/auth.controller.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Request, type Response } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import { type AuthService } from '../../services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: AuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockAuthService = {
      authenticate: vi.fn(),
      register: vi.fn()
    } as unknown as AuthService;

    controller = new AuthController(mockAuthService);

    mockRequest = { body: {} };
    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
  });

  describe('login', () => {
    it('should return auth result on successful login', async () => {
      const loginData = { email: 'test@example.com', password: 'Pass123!' };
      const authResult = {
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        user: { id: '1', email: loginData.email, name: 'Test' }
      };

      mockRequest.body = loginData;
      vi.mocked(mockAuthService.authenticate).mockResolvedValue(authResult);

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.authenticate).toHaveBeenCalledWith(loginData);
      expect(mockResponse.json).toHaveBeenCalledWith(authResult);
    });
  });
});
```

### Service Tests

```typescript
// __tests__/services/auth.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { type UserRepository } from '../../repositories/auth.repository';
import { UnauthorizedError } from '@shared/errors';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepository: UserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      saveRefreshToken: vi.fn()
    } as unknown as UserRepository;

    service = new AuthService(mockUserRepository);
  });

  describe('authenticate', () => {
    it('should throw UnauthorizedError when user not found', async () => {
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

      await expect(
        service.authenticate({ email: 'test@example.com', password: 'pass' })
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
```

### Repository Tests

```typescript
// __tests__/repositories/auth.repository.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../../repositories/auth.repository';
import { type Database } from '@shared/database';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      query: {
        users: {
          findFirst: vi.fn()
        }
      },
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) }))
    } as unknown as Database;

    repository = new UserRepository(mockDb);
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
      vi.mocked(mockDb.query.users.findFirst).mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      vi.mocked(mockDb.query.users.findFirst).mockResolvedValue(undefined);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });
});
```

---

## Key Features

✅ **Clean Architecture**: Controller → Service → Repository
✅ **Arrow Functions**: Auto-bind `this` in controllers
✅ **Global Error Handler**: No need for `next` in controllers
✅ **Express v5**: Native async/await support, no wrapper needed
✅ **Type Safety**: TypeScript throughout
✅ **Validation**: Zod schemas with type inference
✅ **Dependency Injection**: Manual, explicit, testable
✅ **Unit Tests**: Mock dependencies easily
✅ **Logging**: Direct import, still mockable

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test auth.service.spec.ts

# Watch mode
pnpm test:watch
```

---

## Environment Variables

```env
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
LOG_LEVEL=info
```
