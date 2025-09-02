# Design System Overview

This project exposes a minimal set of primitives so new features automatically follow the house style.

## Tokens

Defined in `src/app/globals.css` as CSS variables and exposed to Tailwind as `--color-*` tokens.

## Primitives (src/ui)

- `Heading`: Title component with optional cursive accent.
- `Text`: Paragraph component with `dim` and `small` variants.
- `Button`: Variants `brand | outline | ghost`.
- `Card`: Surface with border/shadow.
- `Field`, `Label`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`.
- `layout/Container`, `layout/Section`, `Divider`.

All primitives use Tailwind classes that reference tokens; avoid raw hex colors.

## Usage Rules

- Colors: Only use Tailwind token classes (e.g., `bg-brand-600`, `text-foreground`).
- Typography: Prefer `Heading` and `Text` or the utilities `heading-title`, `heading-script`.
- Buttons: Use `Button` component or `.btn` classes.
- Forms: Use `Field` + form controls or rely on base element styles.

## Lint Guardrails

ESLint warns on raw hex color literals in TS/TSX. Prefer tokens.

## Styleguide

See `/[locale]/styleguide` for a live preview of tokens and primitives.
