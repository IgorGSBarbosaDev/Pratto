# Pratto

Pratto is a mobile-first digital menu with a visual vertical product feed. The project is a
modular monolith in a pnpm/Turborepo monorepo and runs locally with PostgreSQL, MinIO, and
Mailpit.

## Requirements

- Node.js 20+
- pnpm 10+
- Docker Compose v2

## Getting started

```bash
cp .env.example .env
corepack enable
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app is available at http://localhost:3000. The API is available at
http://localhost:4000, with OpenAPI documentation at http://localhost:4000/docs and the health
endpoint at http://localhost:4000/health.

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm db:validate
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm db:test:reset
pnpm db:test:seed
```

`pnpm db:reset` reapplies every migration without running the seed. Run `pnpm db:seed` afterwards
when demo data is required. Integration tests use the isolated `pratto_test` PostgreSQL schema from
`.env.test` and reset only that schema.

Before the authentication E2E suite, run `pnpm db:test:reset && pnpm db:test:seed`. The suite starts
the API and web app with `.env.test`; Mailpit and PostgreSQL must be available. To start the isolated
test PostgreSQL service locally without colliding with another PostgreSQL on port 5432, run:

```bash
docker compose --profile test up -d postgres-test mailpit
pnpm db:test:reset
pnpm db:test:seed
```

Set `SEED_ADMIN_PASSWORD` before seeding. The seed creates `owner@pratto.local` and
`owner@cafe-aurora.local` without replacing a password that was already changed.

The catalog, publication, public feed, analytics, and dashboard will be delivered incrementally following the implementation plan in
`docs/Pratto-Plano-de-Implementacao-e-Arquitetura.md`.

The multi-tenant model is documented in `docs/architecture/data-model.md`; administrative
authentication is documented in `docs/architecture/authentication.md`.

## Repository layout

```text
apps/web                 Next.js public menu and admin dashboard
apps/api                 NestJS REST API
packages/database        Prisma schema and database client
packages/contracts       Shared API and adapter contracts
packages/validation      Shared Zod validation schemas
packages/ui              Reusable UI components
packages/config          Environment configuration
packages/eslint-config   Shared ESLint configuration
docs                     Architecture, ADRs, API, and product documentation
infrastructure/docker    Local Docker assets
```
