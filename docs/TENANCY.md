# Multi‑Tenancy

The app supports host‑based tenancy (e.g., `acme.example.com`). In tenant mode, database URLs and intake encryption keys are stored in a control‑plane DB and decrypted via AWS KMS.

Control‑Plane Models (conceptual)

- `Tenant { id, slug, name }`
- `TenantHost { host, tenantId }`
- `TenantSecret { tenantId, dbUrlCiphertext, encKeyCiphertext, kmsKeyId }`
- `Branding { tenantId, logoUrl? }` (optional)

Environment

- `CONTROL_DATABASE_URL` must point to the control‑plane Postgres.
- `AWS_REGION` (or `AWS_DEFAULT_REGION`) must be set to use KMS.
- `REDIS_URL` is recommended for shared rate limiting across instances.
- `INTAKE_ENC_KEY` remains as a local/single‑tenant fallback.

Provisioning a Tenant

1. Create a Postgres database for the tenant and run tenant migrations.
2. Generate a 32‑byte base64 intake encryption key (`openssl rand -base64 32`).
3. In AWS KMS, create/select a CMK and encrypt:
   - The tenant DB URL → base64 ciphertext
   - The intake encryption key → base64 ciphertext
4. Insert rows in control‑plane DB:
   - `Tenant { slug, name }`
   - `TenantHost { host, tenantId }` where `host = <slug>.example.com`
   - `TenantSecret { tenantId, dbUrlCiphertext, encKeyCiphertext, kmsKeyId }`
   - (optional) `Branding { tenantId, logoUrl }`
5. Point DNS of `<slug>.example.com` to the app and ensure TLS.

Runtime Resolution

- `middleware.ts` parses the subdomain; `src/lib/tenant.ts` resolves the tenant and decrypts secrets via `src/lib/keys.ts`.
- A tenant‑scoped Prisma client is cached via `src/lib/tenantDb.ts`.
- If no tenant is resolved (localhost/single host), single‑tenant fallback is used (`DATABASE_URL` + `INTAKE_ENC_KEY`).

Admin Access

- `/admin/*` is tenant‑scoped; the admin session embeds the tenant id, validated server‑side.
- Bootstrap the first admin per tenant (see `docs/DEVELOPMENT.md`).
