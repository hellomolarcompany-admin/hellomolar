# Environment Variables

Reference for all supported environment variables. Copy `.env.example` to `.env` and adjust as needed. Do not commit real secrets.

Core

- `DATABASE_URL`: Tenant database (PostgreSQL) connection string. Required in single‑tenant mode and for migrations.
- `DIRECT_URL`: Optional direct DB URL for Prisma (e.g., primary for writes). Recommended to match `DATABASE_URL` locally.
- `SESSION_SECRET`: 32+ character secret to sign admin sessions (HMAC‑SHA256). Required.
- `INTAKE_ENC_KEY`: Base64‑encoded 32‑byte key used to encrypt the raw intake JSON payload (AES‑256‑GCM). Required in single‑tenant mode and as fallback in multi‑tenant.
- `INTAKE_FALLBACK_KEYS`: Optional comma‑separated list of legacy base64 keys for decrypting historical records.
- `MODULES`: Comma‑separated list of enabled modules (e.g., `intake,apprequest`). Defaults to all enabled.
  - `intake`: public intake form and admin intake explorer.
  - `apprequest`: appointment-request backlog, triage scoring, follow-up logging, and intake-prefill tooling (admin only).

Multi‑tenant / Integrations

- `CONTROL_DATABASE_URL`: Control‑plane PostgreSQL for tenants/hosts/secrets. Required for multi‑tenant mode.
- `REDIS_URL`: Redis connection URL for rate limiting. Optional; in‑memory fallback is used when absent (single instance only).
- `AWS_REGION` / `AWS_DEFAULT_REGION`: AWS region for KMS (when decrypting tenant secrets in control‑plane).
- `HCAPTCHA_SECRET`: hCaptcha server secret. Optional; when missing, captcha is skipped in development.
- `NEXT_PUBLIC_HCAPTCHA_SITEKEY`: hCaptcha site key. Optional; when absent, widget is hidden.

Admin & Security

- `ADMIN_BOOTSTRAP_TOKEN`: Optional one‑time token to allow creating the first admin user in production (through `/admin/login`). Must be removed after use.
- `NODE_ENV`: `development` or `production`. Affects logging, cookies, HTTPS redirects, headers, etc.

Notes

- Generate a strong `INTAKE_ENC_KEY`: `openssl rand -base64 32`.
- Prefer your platform secret manager (Vercel/Cloud) instead of checked‑in files.
- In multi‑tenant mode, the per‑tenant DB URL and encryption key are decrypted from control‑plane secrets using AWS KMS; `INTAKE_ENC_KEY` remains as local/dev fallback.
