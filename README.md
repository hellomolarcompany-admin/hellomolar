# HelloMolar Intake (Modular)

A multilingual (NL/EN/ES/PAP) intake form for a dental clinic. Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, react-hook-form, Zod, next-intl v4, and Prisma (PostgreSQL). The API validates and stores submissions and keeps an encrypted archive of the original payload.

## Features

- Multilingual UI: Dutch, English, Spanish, Papiamentu (next-intl v4 + middleware)
- Responsive and accessible form layout
- Client- and server-side validation with Zod + react-hook-form
- Residency logic (resident vs tourist) toggles required fields
- Medical history with multi-select and conditional detail fields
- Persists to PostgreSQL via Prisma; raw payload encrypted (AES‑256‑GCM)
- Code quality: ESLint, Prettier, TypeScript checks, Husky pre-commit

## Tech Stack

- Next.js 15 (App Router, Turbopack)
- TypeScript
- Tailwind CSS 4
- react-hook-form + @hookform/resolvers
- Zod
- next-intl v4
- Prisma (PostgreSQL) — per-tenant DB
- Control plane DB (PostgreSQL) — tenants/hosts/secrets

## Requirements

- Node.js 18+
- pnpm (recommended): `npm i -g pnpm`
- PostgreSQL database URL
- (Multi-tenant) Redis for rate limits, AWS KMS for secrets, hCaptcha keys

## Quick Start

1. Install dependencies and start the dev server

```bash
pnpm install
pnpm dev
# open http://localhost:3000/nl/intake
```

2. Configure environment variables

Create a `.env` with at least:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
# Strong secret used to sign admin sessions (32+ chars)
SESSION_SECRET=REPLACE_WITH_LONG_RANDOM
# 32 random bytes, base64-encoded (used for AES-256-GCM)
INTAKE_ENC_KEY=REPLACE_WITH_BASE64_32B
MODULES=intake                       # enable desired modules (comma-separated)
CONTROL_DATABASE_URL=postgres://...  # control-plane DB (optional in single-tenant)
```

Generate a suitable key:

```bash
openssl rand -base64 32  # copy the output into INTAKE_ENC_KEY
```

3. Set up the database

```bash
pnpm prisma generate
pnpm prisma migrate dev --name init
```

You can also copy `.env.example` to `.env` and fill in values. Never commit real secrets.

### Multi-Tenant Setup (Subdomains)

1. Configure environment

```
CONTROL_DATABASE_URL=postgres://...            # same as DATABASE_URL by default
REDIS_URL=redis://USER:PASS@HOST:6379/0
HCAPTCHA_SECRET=your_hcaptcha_secret
NEXT_PUBLIC_HCAPTCHA_SITEKEY=your_hcaptcha_sitekey
AWS_REGION=your_aws_region
# App still supports single-tenant fallback via INTAKE_ENC_KEY for local dev
```

2. Migrate database (adds control-plane tables, `isSpam`, core Patient/Outbox)

```bash
pnpm prisma generate
pnpm prisma migrate dev --name multi_tenant_init
```

3. Provision a tenant

- Create a KMS key in AWS and encrypt:
  - the tenant Postgres DB URL → base64 ciphertext
  - a 32-byte base64 intake encryption key → base64 ciphertext
- Insert rows:
  - `Tenant { slug, name }`
  - `TenantHost { host, tenantId }` with `host = slug.example.com`
  - `TenantSecret { tenantId, dbUrlCiphertext, encKeyCiphertext, kmsKeyId }`
  - (optional) `Branding { tenantId, logoUrl }`

4. Access app on `https://<slug>.your-domain.tld/`

- Visit `/admin/login` on the tenant subdomain to bootstrap first admin (in production requires `ADMIN_BOOTSTRAP_TOKEN`).
- Home `/` requires login; patient intake remains public at `/<locale>/intake`.

5. Production hardening

- Set strict secrets in the platform secret manager.
- Ensure HTTPS termination and HSTS.
- Configure DNS and TLS for tenant subdomains.
- Monitor Redis and DB; set up backups per tenant.

## Project Structure (key files)

```
src/
  app/
    [locale]/
      layout.tsx            # Intl provider + layout
      intake/page.tsx       # Intake page (server)
    intake/IntakeForm.tsx   # Intake form (client)
  api/
      intake/route.ts       # Save intake (POST)
      health/db/route.ts    # Tenant DB diagnostics (GET) (auth required)
      health/control/route.ts # Control DB diagnostics (GET) (auth required)
      _health/db/route.ts   # Alias to health/db (auth required)
    globals.css
  components/
    LanguageSwitcher.tsx
  i18n/
    config.ts               # locales + helpers
    request.ts              # next-intl request config
  messages/
    nl.json, en.json, es.json, pap.json
  lib/
    validation/intake.ts    # Zod schema + types
    prisma.ts               # Prisma client
    modules.ts              # Module registry via env
    crypto.ts               # AES-256-GCM helpers
middleware.ts               # next-intl middleware
```

## Internationalization (next-intl v4)

- Middleware-driven routing for locales: `middleware.ts` + `src/i18n/routing.ts`
- Request config for message loading: `i18n/request.ts`
- Server usage: `createTranslator({ locale, messages, namespace: 'intake' })`
- Client usage: `const t = useTranslations('intake')`

## API

`POST /api/intake`

- Input: `IntakeFormData` (see `src/lib/validation/intake.ts`)
- Validation: Zod server-side; rejects spam via honeypot field
- Persistence: stores selected fields in columns and the full JSON payload encrypted as `encBlob`
- Encryption: AES‑256‑GCM with `INTAKE_ENC_KEY` (base64‑encoded 32‑byte key)
  - Encryption metadata stored alongside payload (key id + algorithm)
  - Emits an `OutboxEvent` topic `intake.submitted` for async consumers

`GET /api/health/db` (or `/api/_health/db`)

- Returns connectivity diagnostics (auth required in all environments).

`GET /api/health/control`

- Returns control-plane connectivity diagnostics (auth required).

## Modularity

- Enable/disable modules via `MODULES` env var (comma-separated). Default: all enabled for backwards compatibility.
- Intake routes return 404 when the `intake` module is disabled.
- Core `Patient` model in the tenant DB enables other modules to link to a canonical patient.
- Outbox pattern (`OutboxEvent`) enables decoupled processing by optional modules.

## Scripts

```bash
pnpm lint        # ESLint
pnpm lint:fix    # ESLint --fix
pnpm format      # Prettier
pnpm typecheck   # TypeScript
pnpm build       # Next.js production build
pnpm start       # Start production server
```

## Security & Privacy

- Never log sensitive data in production
- Keep `INTAKE_ENC_KEY` secret and rotate if necessary (use `INTAKE_FALLBACK_KEYS` for decrypting older records)
- Configure CORS/CSRF only if exposing the API cross‑origin
- Restrict DB credentials and network access
- Rate limiting protects `/api/intake` and `/admin/login/submit`
- Session/tenant binding on admin routes: the session tenant id must match the subdomain.

### Security Headers

- Global security headers are set via `next.config.ts` (CSP in Report-Only to start, HSTS in production, anti-clickjacking, nosniff, COOP, referrer policy, and a minimal permissions policy).

### HTTPS

- Admin routes redirect to HTTPS in production if the `x-forwarded-proto` indicates HTTP.

### Secrets Hygiene

- Do not commit real secrets. `.env*` files are ignored; use `.env.example` as the template.
- Required secrets: `SESSION_SECRET` (32+ chars), `INTAKE_ENC_KEY` (base64 32 bytes), DB URLs.
- Rotate any credentials that were ever committed or shared. For Git history cleanup, use `git filter-repo` (or `git filter-branch` as a last resort) to remove `.env*` and force-push, then rotate creds at the provider.
- In CI/CD, use your platform’s secret manager (e.g., Vercel/Cloud provider) instead of checked-in files.
  - If any real secrets or bootstrap tokens were committed previously, rotate them immediately.

### Admin Bootstrap (first admin)

- In development: the first admin can be created by submitting the login form with any username and a password (min 8 chars).
- In production: bootstrap is disabled by default. To allow a one-time bootstrap, set `ADMIN_BOOTSTRAP_TOKEN` and provide it in the "Bootstrap token" field on the login form. After creating the first admin, remove the token from the environment.

## Deployment

- Vercel or any Node.js 18+ host
- Ensure env vars are set (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `INTAKE_ENC_KEY`)
- Run Prisma migrations before serving traffic

## Contributing

- Prefer feature branches and PRs
- Keep ESLint/Prettier/TypeScript clean
- Keep all UI strings in `src/messages/*.json`
- Pre-push checks run `pnpm typecheck && pnpm lint && pnpm build`
