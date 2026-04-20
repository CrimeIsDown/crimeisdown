# CrimeIsDown Frontend

This repository now contains the Astro rewrite of the public `crimeisdown.com` site. The active app lives in `src/` and uses Astro, React islands, Tailwind v4, and shadcn/ui components.

## Requirements

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Local development

Use the normal Astro dev server:

```bash
npm run dev
```

If you run into slow dev startup in this mixed-history repo, the local config avoids the Cloudflare adapter during development:

```bash
npx astro dev --config astro.config.local.mjs
```

## Checks

```bash
npm run lint
npm run test
```

## Production build

```bash
npm run build
```

The production deploy target is Cloudflare Pages/Workers, with configuration in [wrangler.jsonc](./wrangler.jsonc) and CI workflows under `.github/workflows/`.
