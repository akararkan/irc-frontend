# IRC — "Modern Manuscript" restyle

The visual layer was rebuilt to the Modern Manuscript design while **all
backend-connected logic was left untouched** (api/, hooks/, lib/, features
data flow, routes, contexts, i18n). Nothing about how the app talks to the
backend changed.

## What changed
- **`index.css`** — completely re-themed design token foundation. Because the
  whole app (shadcn UI primitives + every feature component) reads semantic
  tokens (`bg-card`, `text-fg`, `bg-brand`, `.surface-card`, `.pill-*`, …),
  rewriting these tokens re-skins the entire app at once.
  - Palette: deep **emerald** brand + warm **parchment** surfaces + **brass-gold**
    accent (light) and an **ink-dark** scheme for reels / dark mode.
  - Type: **Fraunces** (display serif) + **Plus Jakarta Sans** (UI sans),
    loaded via Google Fonts. Arabic/RTL Amiri + Noto preserved.
  - Rounder radii, warm ink-tinted shadows, parchment background glow,
    real emerald/brass gradient-text utilities, brass→emerald story ring.
  - A small compatibility layer snaps any stray hardcoded Tailwind brand
    colors (indigo/blue/violet/purple/amber) onto the manuscript palette.
- **`layouts/auth-layout.jsx`** — new premium split-screen auth hero:
  emerald-ink gradient panel, IRC geometric star mark, latticework pattern,
  serif headline + scholarly quote + stats.
- **`features/auth/pages/*`** — serif display headings, emerald gradient
  submit buttons (fixed a stale `text-fg-foreground` token), rounder inputs
  with emerald focus rings.
- A few stray gradient colors in `story-viewer`, `post-card`, `reels-page`
  were mapped to emerald/brass.
- Removed an unused stray `App.css …` file.

## Fonts
Loaded from Google Fonts at the top of `index.css`. For fully offline /
self-hosted builds, install `@fontsource/fraunces` and
`@fontsource-variable/plus-jakarta-sans` and import them in `main.jsx`
instead of the CDN `@import`.
