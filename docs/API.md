# API Reference

All endpoints are relative to the app origin. Admin routes require a valid admin session.

Public

- `POST /api/intake`: Submit an intake form
  - Content-Type: `application/json`
  - Security: same‑origin enforced; optional hCaptcha; basic spam checks (honeypot/time‑to‑fill)
  - Body: conforms to `IntakeSchema` in `src/lib/validation/intake.ts`
  - Response: `{ ok: true, id, createdAt }` or `{ ok: false, message }`
  - Rate limit: 5 requests/minute per IP per tenant

Health (admin‑gated)

- `GET /api/health/db`: Check tenant DB connectivity
- `GET /api/health/control`: Check control‑plane DB connectivity

Diagnostics

- `GET /api/ping`: Returns `{ ok: true, env }` for quick checks.

Intake Request Schema (summary)

- Identity: `firstName`, `lastName`, `dateOfBirth` (ISO), `email?`, `phone1?`.
- Address: `address.street`, `address.number`, `address.city`, `address.country`.
- Residency: `residentType` (resident|tourist). Required fields vary by value.
- Medical: `medicationsSelected[]`, `medicationDetails{}`, `allergiesSelected[]`, `allergyDetails{}`, `conditions{}`.
- Consents: `privacyConsent` (boolean), `marketingConsent` (boolean).
- Anti‑spam: `botField` (must be empty), `formTs` (ms since epoch), `captchaToken`.

Example (abridged)

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": "1990-05-01",
  "email": "jane@example.com",
  "residentType": "resident",
  "address": { "street": "Main", "number": "1", "city": "Willemstad", "country": "CW" },
  "medical": {
    "medicationsSelected": ["ibuprofen"],
    "medicationDetails": { "ibuprofen": "200mg PRN" },
    "allergiesSelected": [],
    "allergyDetails": {},
    "conditions": { "pregnant": false }
  },
  "privacyConsent": true,
  "marketingConsent": false,
  "formTs": 1736800000000,
  "captchaToken": "<token>"
}
```

Persistence & Encryption

- Denormalized columns: name, dob, contact, country, flags for efficient queries.
- Raw JSON is encrypted to `encBlob` using AES‑256‑GCM.
- Key source: `INTAKE_ENC_KEY` in single‑tenant; per‑tenant key in multi‑tenant.
- Metadata `encKeyId`/`encAlg` recorded to aid rotation and audit.

Outbox Events

- On success, emits an `OutboxEvent` with topic `intake.submitted`.
- Consumers can read and process events asynchronously without coupling to the API path.
