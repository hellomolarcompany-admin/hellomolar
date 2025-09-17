# Development Guide

Prerequisites

- Node.js 18+
- pnpm (`npm i -g pnpm`)
- PostgreSQL (local or hosted)

Initial Setup

1. Install dependencies
   - `pnpm install`
2. Copy environment file
   - `cp .env.example .env` and fill the values (see `docs/ENV.md`).
3. Initialize database
   - `pnpm prisma generate`
   - `pnpm prisma migrate dev --name init`
4. Start development server
   - `pnpm dev` then open `http://localhost:3000/nl/intake`.
5. Install git hooks (once)
   - `pnpm prepare`

Useful Commands

- `pnpm dev`: Next.js dev server (Turbopack)
- `pnpm typecheck`: TypeScript
- `pnpm lint` / `pnpm lint:fix`: ESLint
- `pnpm format`: Prettier
- `pnpm build` / `pnpm start`: Production build and start
- `pnpm prisma studio`: Prisma Studio DB inspector

Databases

- Local development can use a single Postgres DB via `DATABASE_URL`.
- In multi‑tenant mode, a control‑plane DB is also required (`CONTROL_DATABASE_URL`). Tenants are resolved by subdomain.

Internationalization

- Messages live in `src/messages/*.json`.
- Server: `createTranslator`, client: `useTranslations`.
- Routes are locale‑prefixed; the middleware normalizes locale handling.

Admin Login

- Dev: submit any username and a password (min 8 chars) to create the first admin.
- Prod: set `ADMIN_BOOTSTRAP_TOKEN` to allow one‑time creation of the first admin, then remove it.

Captcha

- If `HCAPTCHA_SECRET` is not set, captcha checks are skipped; the widget is hidden unless `NEXT_PUBLIC_HCAPTCHA_SITEKEY` is provided.

Troubleshooting

- Migration errors: verify `DATABASE_URL` and run `pnpm prisma migrate reset` (will wipe local data) then `pnpm prisma migrate dev`.
- Session errors: ensure `SESSION_SECRET` is 32+ chars.
- “Invalid origin” on POST: post from the same origin (no cross‑origin form submit).
