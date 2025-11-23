# Fintech Modular Monolith Backend

A production-grade Node.js/TypeScript backend following Modular Monolith architecture with strict domain separation and clean architecture principles.

## Project Structure

```
.
├── apps/
│   └── backend/                # Main backend application
│       ├── prisma/             # Database schema and migrations
│       └── src/
│           ├── shared/         # Backend-only shared infrastructure
│           │   ├── config/     # Environment, database, server config
│           │   ├── utils/      # Logger, error handlers, response utils
│           │   ├── middleware/ # Error, request-id, validation middleware
│           │   ├── constants/  # HTTP constants
│           │   └── database/   # Prisma client wrapper
│           ├── modules/        # Domain modules (to be added)
│           └── server.ts       # Server entry point
├── packages/
│   └── shared/                 # Cross-app shared code
│       └── src/
│           ├── types/          # Common types
│           └── constants/      # App constants
└── docker-compose.yml          # PostgreSQL for local development
```

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript 5.7+
- **Framework**: Express v5
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod
- **Logging**: Pino
- **Security**: Helmet, CORS, bcrypt, JWT
- **Code Quality**: ESLint, Prettier, Husky, lint-staged

## Getting Started

### Prerequisites

- Node.js 22+ (use `nvm use` to match .nvmrc)
- pnpm 9+
- Docker and Docker Compose

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL:

```bash
docker-compose up -d
```

3. Setup environment:

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your configuration
```

4. Generate Prisma client and run migrations:

```bash
cd apps/backend
pnpm db:generate
pnpm db:migrate
```

5. Start development server:

```bash
pnpm dev
```

The server will be running at `http://localhost:3000`

### Available Scripts

#### Root

- `pnpm dev` - Start backend in development mode
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Type check all packages
- `pnpm quality` - Run all quality checks

#### Backend

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Prisma Studio

## Architecture Principles

### Modular Monolith

- Each module owns its data and business logic
- Modules communicate through well-defined interfaces
- No direct database access between modules
- Clear separation of concerns

### Clean Architecture

- **Controller**: HTTP layer (validation + routing)
- **Service**: Business logic
- **Repository**: Data access
- **DTO**: Data transfer objects with Zod validation

### Module Structure Template

```
src/modules/[module-name]/
├── [module-name].controller.ts    # HTTP layer
├── [module-name].service.ts       # Business logic
├── [module-name].repository.ts    # Data access
├── [module-name].dto.ts          # DTOs & validation
├── [module-name].route.ts        # Route definitions
├── [module-name].module.ts       # DI setup
├── [module-name].interface.ts    # Type definitions
└── __tests__/                    # Tests
```

## Code Quality

### Pre-commit Hooks

Husky runs lint-staged on commit to:

- Format code with Prettier
- Lint TypeScript with ESLint
- Ensure type safety

### Quality Checks

Run `pnpm quality` before pushing to ensure:

- Code is properly formatted
- No linting errors
- Type checking passes

## Environment Variables

See `apps/backend/.env.example` for required environment variables.

## License

MIT
