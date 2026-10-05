# Backend Template

NestJS backend project template. HTTP kernel is **Fastify** (`@nestjs/platform-fastify`), not Express — use Fastify plugins and types (`NestFastifyApplication`, `app.register(...)`) in `src/main.ts`. Compression (`@fastify/compress`), cookies (`@fastify/cookie`), and security headers (`@fastify/helmet`) are already registered.

## Scripts

```bash
npm run start:dev    # Development with hot reload
npm run start:prod   # Production
npm run build        # Build
npm run lint         # Lint & fix
npm run test         # Unit tests
npm run test:e2e     # E2E tests
```

## Project Structure

```
src/
├── core/
│   ├── config/      # App configuration (env variables)
│   ├── prisma/      # Prisma client
│   ├── health/      # Health check endpoints
│   └── app/         # Root module
├── database/        # Prisma schema and migrations
├── modules/         # Feature modules
└── main.ts          # Entry point
```

## Database

PostgreSQL is accessed only through Prisma. Inject `PrismaService` from `src/core/prisma`.

- **Local Postgres:** `docker compose up -d` (image and credentials from `.env` / `.env.example`)
- **Schema:** `src/database/schema.prisma`
- **Migrations:** `src/database/migrations/`

```bash
npm run prisma:migrate    # Create and apply a migration
npm run prisma:generate   # Regenerate the Prisma client
```

## Libraries

| Purpose       | Library                  |
|---------------|--------------------------|
| HTTP          | Fastify (`@nestjs/platform-fastify`) |
| Validation    | class-validator          |
| ORM           | Prisma (`@prisma/client`) |
| Database      | PostgreSQL (`pg`)        |

## Core Modules

| Purpose       | Module           |
|---------------|-----------------|
| Configuration | `ConfigModule`  |
| Database      | `PrismaModule`  |
| Health Check  | `HealthModule`  |

## Adding a Module

```bash
nest generate module <name>
nest generate controller <name>
nest generate service <name>
```

## Code Style

- Use `@` aliases for imports (e.g., `@config/config.service`)
- Run `npm run format` before committing
- Follow NestJS module pattern
