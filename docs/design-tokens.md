# Design Tokens

House style distilled from the reference card: bold uppercase sans + cursive accent, teal brand on clean white surfaces, simple icons, generous spacing.

## Colors

- Brand teal: `brand-500` (`--brand-500`)
- Scale: `brand-50..900` for tints/shades
- Semantic tokens: `background`, `foreground`, `surface`, `border`, `ring`, `muted-foreground`

Use via Tailwind token classes:

- Backgrounds: `bg-brand-600`, `bg-surface`
- Text: `text-foreground`, `text-brand-700`, `text-muted-foreground`
- Borders: `border-brand-600`, `border`

## Typography

- Sans: Montserrat (variable `--font-sans`)
- Script accent: Dancing Script (variable `--font-script`)
- Helpers: `heading-title` (uppercase + tracking), `heading-script`

## Components

Utility classes are defined in `globals.css` under `@layer components`:

- Buttons: `.btn .btn-brand | .btn-outline | .btn-ghost`
- Card: `.card`
- Form: `.label`, base input/select/textarea styles

## Dark Mode

- Tokens adapt under `prefers-color-scheme: dark`. Use semantic tokens to stay consistent.
