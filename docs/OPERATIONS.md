# Operations

Deploy Targets

- Any Node.js 18+ platform (e.g., Vercel, Fly.io, containers). Ensure a Postgres DB and environment variables are set.

Deploy Steps

- Set environment variables (see `docs/ENV.md`).
- Run Prisma migrations before serving traffic (`prisma migrate deploy`).
- Build and start the app (`pnpm build && pnpm start`) or use platform buildpacks.

Migrations

- Dev: `pnpm prisma migrate dev` to create migrations.
- Prod: `pnpm prisma migrate deploy` to apply existing migrations.
- Multi‑tenant: apply tenant schema to each tenant DB; control‑plane schema to `CONTROL_DATABASE_URL`.
- Latest tenant migration: `20250921120000_appointment_request_module` introduces patient timeline tables (`PatientEvent`, `AppointmentRequest*`, `StaffMember`). Run on every tenant database before enabling the module.
- Enable the admin module by adding `apprequest` to `MODULES` once migrations are applied and staff records are provisioned.
- New migration `20250921151500_add_preferred_locale` adds the `LocaleCode` enum plus `preferredLocale` columns on `Patient` and `AppointmentRequest`. Apply after the earlier appointment module migration so language preferences are stored.

Rate Limiting

- Provide `REDIS_URL` to enable distributed rate limiting across instances; otherwise an in‑memory limiter is used (single instance only).

Admin Bootstrap

- Development: free bootstrap via login form.
- Production: set `ADMIN_BOOTSTRAP_TOKEN` temporarily to allow first admin creation; remove after use.

Key Management

- Intake payloads are encrypted with AES‑256‑GCM.
- Rotate keys by introducing a new key and keeping old keys in `INTAKE_FALLBACK_KEYS` until data is migrated or decryption windows close.
- In multi‑tenant mode, rotate per‑tenant keys in KMS; update `encKeyCiphertext` and set a new `encKeyId` convention.

Backups & DR

- Schedule regular backups for tenant and control‑plane DBs.
- Test restores periodically.

Observability

- Prisma logs warnings/errors by default.
- Consider adding app metrics and structured logs (PII‑scrubbed) for production.

Security

- HTTPS required in production; HSTS enabled by default. Ensure TLS termination at the edge or proxy.
- Secrets must be set via platform secret manager; never commit real `.env*`.
- See `SECURITY.md` for the full policy.

Troubleshooting

- 400 Invalid origin: Ensure same‑origin POSTs and correct `x-forwarded-proto`.
- 429 Too many requests: Rate limit threshold reached; review `REDIS_URL` config.
- 500 Tenant key missing: Check tenant resolution and KMS/secret configuration.
