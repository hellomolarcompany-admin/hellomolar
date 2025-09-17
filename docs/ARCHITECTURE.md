# Architecture Overview

This project is a Next.js 15 App Router app with a secure intake workflow, optional multi‑tenant support, and a minimal admin area. It emphasizes validation, encryption at rest, and modularity.

Core Components

- App Router pages under `src/app` with server and client components.
- Internationalization via `next-intl` middleware and `src/i18n/*` helpers.
- API routes under `src/app/api/*` for intake, health checks, and admin endpoints.
- Prisma ORM with PostgreSQL for the tenant data plane and a control‑plane in multi‑tenant setups.
- Encryption helpers to persist the full intake payload as an encrypted blob.
- Optional outbox table for event‑driven integrations.

Request Flow (Intake)

1. User visits `/{locale}/intake` and completes the form.
2. Client posts to `POST /api/intake` with anti‑spam fields (honeypot, time‑to‑fill), optional captcha, and CSRF/same‑origin checks.
3. Server validates with Zod (`src/lib/validation/intake.ts`), normalizes and derives denormalized columns.
4. Server encrypts the raw JSON with AES‑256‑GCM using `INTAKE_ENC_KEY` (single‑tenant) or the per‑tenant key (multi‑tenant).
5. Prisma persists to `IntakeSubmission` and emits an `OutboxEvent` (best‑effort) for decoupled consumers.

Internationalization

- Locale detection and routing through `middleware.ts` and `src/i18n/routing.ts`.
- Server usage via `createTranslator`, client usage with `useTranslations`.
- Message catalogs in `src/messages/*.json`.

Admin & Auth

- Minimal admin with login, sessions signed via HMAC (`SESSION_SECRET`), HttpOnly cookies, and CSRF for POSTs.
- Middleware gates `/admin/*` and `/` (home) behind session checks. CSRF token issued via cookie.
- Admin bootstrap flow: dev‑friendly by default; gated in production by `ADMIN_BOOTSTRAP_TOKEN`.

Security

- Security headers configured in `next.config.ts` (CSP report‑only by default), HSTS in production, clickjacking, nosniff, COOP, referrer policy, minimal permissions policy.
- Rate limiting for intake and login via Redis when `REDIS_URL` is set; graceful in‑memory fallback in single‑instance environments.
- Encrypted payload (`encBlob`) stores the original JSON for audit/replay; denormalized columns support efficient querying.

Data Model (high level)

- `IntakeSubmission`: core denormalized fields, JSON maps for medical data, `encBlob`, `encKeyId`, `encAlg`, `isSpam`.
- `Patient` (core): canonical patient record for linking.
- `OutboxEvent`: events emitted for decoupled processing by optional modules.

Multi‑Tenant Mode

- Control‑plane DB stores `Tenant`, `TenantHost`, `TenantSecret`, optional `Branding`.
- `middleware.ts` and `src/lib/tenant.ts` parse subdomain and resolve the tenant.
- `src/lib/keys.ts` decrypts per‑tenant DB URL and encryption key using AWS KMS.
- Tenant‑scoped Prisma clients cached in `src/lib/tenantDb.ts` to avoid reconnect storm.
- Single‑tenant fallback is used when no tenant slug is present (local dev, single host).

Modularity

- `src/lib/modules.ts` reads `MODULES` env var to enable/disable features. For example, `intake` can be disabled to return 404 for intake routes.

Where to Look

- Validation: `src/lib/validation/intake.ts`
- Encryption: `src/lib/crypto.ts`
- API handler: `src/app/api/intake/route.ts`
- Admin auth/session: `src/lib/auth.ts` and `middleware.ts`
- Tenancy: `src/lib/tenant.ts`, `src/lib/controlPlane.ts`, `src/lib/tenantDb.ts`, `src/lib/keys.ts`
- Rate limit: `src/lib/rateLimit.ts`
