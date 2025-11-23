---
trigger: always_on
---

# Coding Conventions - Compact

## 1. Naming

**Files**: `[feature].[role].ts` (kebab-case) | **Folders**: kebab-case
**Roles**: handler, service, repository, route, model, interface, middleware, util, type, config, dto, validator, constant, enum
**Code**: PascalCase (Classes/Interfaces/Types/Enums) | camelCase (vars/functions) | UPPER_SNAKE_CASE (constants)

## 2. TypeScript

- **Type imports**: `import { type User, createUser } from './user'`
- **Object shapes**: Use `interface`, not `type` (except unions/intersections)
- **Return types**: Always explicit on functions

## 3. Architecture

**Layers**: Handler → Service → Repository → Database
**Isolation**: Modules CANNOT access other modules' DB tables/repos/internal services. Use APIs/events/shared types.

```typescript
// Handler: HTTP concerns + validation
class AuthHandler {
  async login(req, res) {
    const data = schema.parse(req.body);
    return res.json(await this.service.authenticate(data));
  }
}

// Service: Pure business logic
class AuthService {
  async authenticate(creds: LoginDto): Promise<AuthResult> {
    return await this.repo.findByEmail(creds.email);
  }
}

// Repository: Data access only
class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

## 4. Code Quality

**Logging**: Use `logger.info/error(msg, { context })`, never `console.log`
**Errors**: Always handle, log with context, use typed errors
**Async**: Pure async/await, no mixing with .then()
**Imports**: 1) External packages → 2) @shared → 3) Module imports → 4) Relative

## 5. Validation

Use Zod for all input validation. Define schema + infer type:

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
});
type Dto = z.infer<typeof schema>;
```

## 6. Security

- **Env vars**: No defaults for sensitive values, throw if missing
- **Auth**: JWT + refresh tokens, bcrypt (≥10 rounds)
- **Validation**: All inputs via Zod
- **Queries**: Parameterized only (Prisma handles this)

## 7. Performance

- **DB**: Select specific fields, use where/take
- **Async**: Parallel with `Promise.all()` when possible

## 8. Testing

**Naming**: `[feature].service.spec.ts` | `[feature].integration.spec.ts` | `[feature].e2e.spec.ts`
**Structure**: Arrange-Act-Assert pattern in `describe/it` blocks

## 9. Git Commits

Format: `<type>(<scope>): <subject>`
Types: feat, fix, docs, style, refactor, test, chore

## 10. Tools

**Prettier**: semi, singleQuote, printWidth:100, tabWidth:2
**ESLint**: explicit-function-return-type, no-explicit-any, no-unused-vars, no-console errors
**Pre-commit**: Run `pnpm quality` (lints, formats, type-checks, tests)

## 11. Documentation

**JSDoc**: Required for public APIs
**README**: Each module needs: purpose, endpoints, config, tests, deployment

## 12. Enforcement Checklist

- [ ] `pnpm quality` passes
- [ ] Tests pass
- [ ] No console.log
- [ ] Proper error handling
- [ ] Zod validation
- [ ] Docs updated
- [ ] Security reviewed
- [ ] Performance considered
