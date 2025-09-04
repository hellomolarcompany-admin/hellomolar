# Security Policy

We take patient privacy and data security seriously.

- For vulnerabilities, please email security@hellomolar.example (or the project contact).
- Do not open public issues for sensitive reports. We will acknowledge within 2 business days.
- Please avoid sharing any real patient data in logs, screenshots, or reproduction steps.

Hardening basics in this project:

- Security headers are set globally (frame busting, MIME sniffing, referrer policy, COOP).
- HTTPS is enforced for admin routes in production.
- Admin sessions are signed with HMAC (SHA‑256) and set as HttpOnly, SameSite=Lax.
- CSRF protection for admin POSTs via double-submit cookie checked server-side.
- Intake payloads are encrypted at rest with AES‑256‑GCM.
- Rate limits protect login and intake endpoints.

When rotating keys:

- Update `INTAKE_ENC_KEY` and keep prior keys in `INTAKE_FALLBACK_KEYS` until all records are migrated (if desired).
