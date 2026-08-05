# AGENTS.md

## Project

Pratto is a mobile-first digital menu with a vertical feed inspired by TikTok/Reels.
The portfolio MVP must manage products and media, publish a menu, open it by URL/QR Code, and show anonymous analytics.
It runs locally first but must remain ready for a future SaaS version without rewriting the core.

## Scope

Build: authentication, establishment settings, categories, products, media, versioned publishing, vertical feed, horizontal gallery, details, category filters, QR Code, analytics, and dashboard.
Do not build yet: orders, cart, checkout, Stripe, Cloudflare, microservices, Redis, queues, workers, multi-location support, or advanced permissions.
Do not expand scope without an explicit requirement.

## Stack

- TypeScript, pnpm workspaces, Turborepo.
- Next.js, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query.
- NestJS, REST, OpenAPI/Swagger.
- PostgreSQL, Prisma, MinIO, Mailpit.
- Jest, Vitest, Testing Library, Playwright, ESLint, Prettier, Pino.
- Docker Compose and GitHub Actions.

## Architecture

Use a modular monolith inside a monorepo.
Keep domain modules independent and avoid direct cross-module coupling.
Main API modules: identity, organizations, establishments, catalog, media, public-menu, analytics, and audit.
Use interfaces for storage, email, billing, and future media processing.
Do not introduce microservices without proven scaling or deployment needs.

## Repository Layout

```text
apps/web                 Next.js public menu and admin dashboard
apps/api                 NestJS API and domain modules
packages/database        Prisma schema, migrations, seed, client
packages/contracts       Shared API contracts and event schemas
packages/validation      Reusable Zod schemas
packages/ui              Generic reusable UI components
packages/config          Shared config and environment validation
docs/architecture        Current architecture documentation
docs/adr                 Architecture Decision Records
docs/product             Scope, rules, and acceptance criteria
infrastructure/docker    Local infrastructure configuration
```

## Code Organization

Prefer feature-based folders in the frontend.
Inside backend modules, separate domain, application, infrastructure, and presentation.
Keep business rules out of controllers, UI components, Prisma models, and adapters.
Do not expose Prisma entities directly through the API.

## Engineering Rules

- Follow Clean Code, SOLID, KISS, YAGNI, DRY, and separation of concerns pragmatically.
- Use clear domain names, small functions, explicit types, and early returns.
- Avoid `any`, hidden side effects, god services, and premature abstractions.
- Validate all external input at application boundaries.
- Use transactions for publishing, reordering, and dependent multi-record changes.
- Use `DECIMAL` for money; never use floating-point types for prices.
- Add database constraints and indexes for critical rules.
- Enforce tenant isolation in every read and write.
- Derive tenant context from the authenticated session, never client input alone.
- Use structured logs with request, user, organization, and establishment IDs.
- Never log passwords, tokens, cookies, or unnecessary personal data.

## Idempotency

Treat retries as expected behavior.
Use unique idempotency keys or event IDs for analytics, publishing, uploads, future jobs, and webhooks.
Enforce idempotency with database constraints, not memory-only checks.
Repeated requests must not duplicate events, publications, or side effects.

## Security

Use opaque sessions in HttpOnly cookies, Argon2id, CSRF protection, and rate limits.
Validate MIME type and file size; never trust file extensions.
Do not store secrets in the repository.
Return stable error codes without exposing stack traces or internal details.

## Testing

Test business rules, state transitions, tenant isolation, transactions, idempotency, publishing, uploads, and analytics.
Critical E2E flow: login → create category → create product → upload media → publish → open menu → interact → view dashboard.
Test behavior, not implementation details.

## Definition of Done

A task is complete only when it works, is typed, validates input, enforces authorization and tenant isolation, handles relevant errors, includes necessary tests, updates API/docs when required, and passes lint, test, and build.

## Priority

Foundation → domain/database → authentication → establishment → categories → products → media → publishing → public feed → analytics → dashboard → QR/refinement.
Build one complete vertical slice at a time.
