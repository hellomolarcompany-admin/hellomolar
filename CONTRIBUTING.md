# Contributing Guide

We welcome contributions that improve quality, security, and clarity. Please follow the guidelines below.

Basics

- Use feature branches off `main` and open a PR.
- Keep PRs focused and small where possible; link related issues.
- Ensure CI checks pass: `pnpm typecheck && pnpm lint && pnpm build`.

Code Style

- TypeScript, ESLint, Prettier are configured. Format and lint before pushing.
- Prefer explicit types and early returns.
- UI: use primitives in `src/ui/*` and tokens from `globals.css`. Avoid raw hex colors.
- i18n: put copy in `src/messages/*.json`; do not hardcode strings.

Commits

- Use clear, imperative messages, e.g., "Add tenant KMS decryption guard".
- Reference issues with `#123` where relevant.

Testing & Validation

- Run locally: `pnpm dev`.
- Validate schema and endpoints: see `docs/API.md` for examples.
- For DB changes, add a Prisma migration and update docs if needed.

Security & Privacy

- Do not include secrets or real PII in PRs, logs, or screenshots.
- Follow `SECURITY.md` guidance for reporting vulnerabilities.

Documentation

- Update or add docs under `docs/` when behavior or setup changes.
- Keep README focused and link to deeper docs.
