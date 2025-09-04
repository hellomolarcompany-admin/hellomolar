# HelloMolar Intake

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
- Prisma (PostgreSQL)

## Requirements

- Node.js 18+
- pnpm (recommended): `npm i -g pnpm`
- PostgreSQL database URL

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
      health/db/route.ts    # DB diagnostics (GET) (auth required)
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

`GET /api/health/db` (or `/api/_health/db`)

- Returns connectivity diagnostics (auth required in all environments).

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

### Security Headers

- Global security headers are set via `next.config.ts` (CSP in Report-Only to start, HSTS in production, anti-clickjacking, nosniff, COOP, referrer policy, and a minimal permissions policy).

### HTTPS

- Admin routes redirect to HTTPS in production if the `x-forwarded-proto` indicates HTTP.

### Secrets Hygiene

- Do not commit real secrets. `.env*` files are ignored; use `.env.example` as the template.
- Required secrets: `SESSION_SECRET` (32+ chars), `INTAKE_ENC_KEY` (base64 32 bytes), DB URLs.
- Rotate any credentials that were ever committed or shared. For Git history cleanup, use `git filter-repo` (or `git filter-branch` as a last resort) to remove `.env*` and force-push, then rotate creds at the provider.
- In CI/CD, use your platform’s secret manager (e.g., Vercel/Cloud provider) instead of checked-in files.

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
