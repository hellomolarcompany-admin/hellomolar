# Database Integration Plan (Prisma)

This document outlines how intake submissions are stored, how to operate the database locally and in production, and what to build next.

## Current State (Phase 1)

- ORM: Prisma with PostgreSQL (`prisma/schema.prisma`)
- Model: `IntakeSubmission`
  - Indexed timestamps, selected denormalized fields (name, dob, contact, country, flags)
  - JSON fields for medications, allergies, conditions
  - `encBlob` stores the full original JSON payload encrypted with AES‑256‑GCM
- API: `POST /api/intake` validates (Zod), derives columns, encrypts payload, and persists
- Health endpoint: `GET /api/health/db` (diagnostics; requires admin session in production)

## Environment

Required variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
INTAKE_ENC_KEY=BASE64_32_BYTES   # openssl rand -base64 32
```

## Local Setup

```bash
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm dev
```

## Data Model

- `fullName`, `dob`, `phone`, `email`, `residentType`, `address`, `country`
- `medications` (JSON {selected[], details{}})
- `allergies` (JSON {selected[], details{}})
- `conditions` (JSON map of booleans)
- `hadComplications`, `complicationsNote`
- `locale`, `marketingOptIn`, `privacyAccepted`
- `userAgent`, `ipInet`, optional `fingerprint`
- `encBlob` (Bytes): AES‑256‑GCM buffer produced by `encryptJsonToBuffer`

## Security

- Keep `INTAKE_ENC_KEY` secret; store in a secure secret manager
- Consider key rotation strategy (versioned key id + re-encrypt job)
- Minimize access: separate read-only users for analytics, restricted write for API
- Avoid logging PII; scrub or redact application logs

## Operations

- Migrations: standard Prisma workflow (`migrate dev`/`migrate deploy`)
- Backups: schedule regular DB backups; validate restores
- Observability: enable Prisma warn/error logs (already configured), add app metrics later

## Next Phases

Phase 2 – Retrieval & Admin

- Admin UI to list/search submissions
- Secure decryption endpoint for `encBlob` (audit logged)
- Role-based access control (RBAC) for staff

Phase 3 – Notifications & Integrations

- Optional email/SMS notification on new submission
- Export endpoints (CSV) and EHR/PM integrations
- Rate limiting and bot protection (e.g., Turnstile) on form and API

Phase 4 – Compliance & Data Lifecycle

- Data retention policy with automated purge
- DPIA/records of processing, consent management
- Encryption key rotation and incident response playbooks
