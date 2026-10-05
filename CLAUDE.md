# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NestJS monolith backend. HTTP kernel is **Fastify** (`@nestjs/platform-fastify`), not Express — use Fastify plugins/types (`NestFastifyApplication`, `app.register(...)`) in `src/main.ts`. Compression, cookies, static file serving (`/uploads/`), and multipart upload handling are registered there as Fastify plugins.

Persistence is **Prisma** (`@prisma/client` + `@prisma/adapter-pg`). The DB access point is `PrismaService` (`src/core/prisma/prisma.service.ts`). Schema and migrations live at `src/database/schema.prisma` and `src/database/migrations/`. `prisma.config.ts` already points at those paths. Do not add a second ORM or a second migration tool.

## Commands

```bash
npm run start:dev       # Dev server with hot reload (Fastify, port from PORT env var)
npm run build            # nest build -> dist/
npm run start:prod       # node dist/main

npm run lint             # eslint --fix over src/apps/libs/test
npm run format            # prettier --write src/** test/**

npm run test              # jest unit tests (*.spec.ts, co-located with source)
npm run test:watch
npm run test:cov
npm run test:e2e         # jest -c test/jest-e2e.json

npm run prisma:generate  # regen Prisma client into generated/prisma (fix prisma.config.ts path first, see above)
npm run prisma:migrate   # prisma migrate dev
npm run prisma:studio
```

Run a single unit test file: `npx jest path/to/file.spec.ts` (rootDir for jest is `src`). E2E tests live in `test/` and use their own jest config.

Local Postgres: `docker compose up -d` (see `docker-compose.yml`; credentials come from `.env`, based on `.env.example`).

The Prisma client is generated to `generated/prisma` (gitignored) — import it as `../../../generated/prisma/client` relative to the importing file (see `PrismaService`, or `Prisma`/`User` types in `users.service.ts`). Run `npm run prisma:generate` after pulling schema changes or the app won't build.

## Architecture

### Module layout

- `src/core/` — cross-cutting infrastructure: `config` (typed env access), `prisma` (DB client), `mail`, `health`, `throttler`, `app` (root `AppModule` wiring everything together).
- `src/modules/` — feature modules: `auth`, `users`, `rbac`, `convert`.
- `src/common/` — shared decorators used across modules (`@Public()`).
- `src/database/` — Prisma schema + migrations + the (unused-at-runtime) TypeORM CLI data source.

### Config

`ConfigService` (`src/core/config/config.service.ts`) wraps `@nestjs/config`'s `ConfigService` with a typed `get<K extends keyof Config>(key)` — add new env vars in both `config.types.ts` (the `Config` interface) and `config.validation.ts` (the Joi schema); both are required for a var to be usable. Validation runs at startup via Joi and the app fails fast if required vars are missing/invalid. See `src/core/config/README.MD` for the walkthrough.

### Auth flow

- JWT-based, tokens delivered as **HttpOnly cookies** (`AuthCookiesService`, `src/modules/auth/auth-cookies.service.ts`), not `Authorization` headers. Cookie names/config are read from `ACCESS_TOKEN_COOKIE` and driven by `COOKIE_*` env vars.
- `JwtAuthGuard` (`src/modules/auth/guards/jwt-auth.guard.ts`) is registered globally as `APP_GUARD` in `AppModule` — every route requires a valid JWT cookie by default. Opt out per-route/controller with the `@Public()` decorator (`src/common/decorators/public.decorator.ts`).
- Registration and login both go through email OTP confirmation (`EmailOtp` model, purposes: `REGISTRATION`, `PASSWORD_RESET`, `LOGIN`, `EMAIL_CHANGE`, `ACCOUNT_DELETION`). OTPs are hashed (`argon2`), rate-limited via `resendAvailableAt`, and capped by `maxAttempts`. Sensitive user-initiated flows (email change, account deletion) follow the same initiate → emailed code → confirm pattern — see `UsersService.initiateEmailChange`/`confirmEmailChange` and `initiateAccountDeletion`/`confirmAccountDeletion` for the reference implementation of that pattern.
- Login attempts are tracked separately in the `LoginAttempt` model (status `PENDING`/`CONFIRMED`/`EXPIRED`).

### RBAC

Custom role/permission system, not a library:

- Schema: `Role` ↔ `UserRole` ↔ `User`, and `Role` → `Grant` → `Permission`, where a `Grant` carries an `actions: String[]` array (empty array means "all actions" for that permission).
- `RbacService` (`src/modules/rbac/rbac.service.ts`) loads all grants into an in-memory `Map<roleName, Map<permissionName, Set<action>>>` cache on module init, and reloads it after every role/permission/grant mutation. `canAccess(userRoles, permission, action?)` is the single authorization check point — call it from services, not just guards, when access also depends on record ownership (see `UsersService.getProfile`/`updateProfile`, which combine "is this the user's own record" with `canAccess(..., 'users', 'read'|'update')`).
- Two separate guards exist and are applied per-route, not globally: `RbacGuard` + `@RequirePermission(permission, action?)` for the permission/action model above, and `RolesGuard` + `@RequireRoles(...)` for simple role-name checks (e.g. admin-only routes). Check which decorator a controller uses before assuming the other applies.
- Admin CRUD over roles/permissions/grants/user-role assignment lives in `admin-rbac.controller.ts`.

### Convert module

Format-conversion module (`src/modules/convert/`) between CSV/JSON/XML/YAML, built around a codec abstraction:

- `FormatCodec` (`codecs/format-codec.ts`) defines `sniff`/`parse`/`serialize` against a shared `CanonicalData` shape (JSON-compatible value, usually array-of-objects).
- Each format has one codec (`csv.codec.ts`, `json.codec.ts`, `xml.codec.ts`, `yaml.codec.ts`), injected into `CodecRegistry` (`codecs/codec-registry.ts`) via the `FORMAT_CODECS` multi-provider token. `CodecRegistry.detect()` sniffs format from extension first, then content, across all registered codecs.
- Adding a new format means adding a codec implementing `FormatCodec`, registering it in the `FORMAT_CODECS` provider array, and adding it to `CONVERT_FORMATS`/`CONVERT_EXT` in `convert.types.ts`.
- Exact per-pair conversion semantics (header handling, attribute encoding, error cases) are documented in `src/modules/convert/README.md` — read it before changing codec behavior.
- Conversions are persisted as `ConversionJob` records (status `SUCCESS`/`ERROR`, byte counts, duration) for auditing/history.

### Users module

`UsersService` (`src/modules/users/users.service.ts`) is the largest service and the reference for this codebase's conventions:
- Every mutating/sensitive method logs a single structured line per outcome (`actorUserId=... targetUserId=... event=... outcome=<http-status>`) — follow this pattern for new endpoints rather than ad hoc logging.
- Field-level update permissions are enforced via an allowlist (`patchAllowlist` in `helpers/profile-field-policy.ts`), keyed off whether the actor can act on themselves vs. has the `users`/`update` RBAC permission.
- Account deletion is a soft-delete + anonymization (`anonymizeAccount`): email is replaced with a `deleted.<id>@deleted.invalid` sentinel, PII fields are cleared, roles/OTPs/login attempts are deleted, and the avatar file is removed — the row is not physically deleted.
- User avatars are stored on local disk under `uploads/avatars/`, served statically at `/uploads/` (see `main.ts`'s `fastifyStatic` registration). Filenames are randomly generated UUIDs; `removeAvatarFile` re-validates the filename pattern before deleting to avoid path traversal via a stored value.
- Cursor-based pagination for user listing (`helpers/user-list.ts`) encodes `{sort, order, value, id}` into an opaque cursor — when changing sortable fields, update both the cursor encode/decode and `userListCursorWhere`'s keyset comparison together.

## Conventions

- Import alias `@/*` maps to `src/*` (see `tsconfig.json`); prefer it over deep relative paths for cross-module imports.
- DTOs and environment variables use `class-validator`/`class-transformer`. HTTP bodies go through a global `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`. Env validation is `validateConfig` in `src/core/config/config.validation.ts`. Do not add Joi, Zod, or another schema library.
