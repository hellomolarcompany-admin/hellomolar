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

Admin Appointment Requests (module `apprequest`)

- `POST /admin/appointments/new/create`: Log an appointment request (existing or new patient). Requires admin session + CSRF. Body comes from HTML form; server validates with `appointmentRequestCreateSchema`.
- `POST /admin/appointments/new/create`: Log an appointment request (existing or new patient). Requires admin session + CSRF. Body comes from HTML form; server validates with `appointmentRequestCreateSchema`. The payload now includes `preferredLocale` (`en`|`nl`|`es`|`pap`) which is persisted on both the request and the patient record.
- `POST /admin/appointments/:id/update`: Update status, schedule, availability, notes, preferred providers, and `preferredLocale`. Recomputes priority, syncs the parent `PatientEvent`, and updates the linked patient when the language changes.
- `POST /admin/appointments/:id/follow-up`: Append a follow-up attempt, optionally creating a contact event and adjusting priority when an offer is declined.
- `POST /admin/appointments/:id/prefill-link`: Generates a 24-hour intake link token and redirects back with shareable URL/template for email/WhatsApp. The link path and template text are localized using the appointment's `preferredLocale`.
- UI list/detail pages live under `/admin/appointments` and `/admin/appointments/:id`; they surface urgent counts, triage scores, and the unified patient timeline.

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
- Appointment workflows emit `appointment.requested`, `appointment.updated`, and `appointment.followup` payloads for downstream automation (notifications, BI, etc.).
