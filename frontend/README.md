# CrimeIsDown frontend

The public CrimeIsDown.com website uses Astro, React, Bootstrap, and Tailwind.
This repository contains the frontend, public map assets, and frontend tests.

## Development

Use Node.js 24 or newer and npm:

```sh
npm ci
npm run dev
```

The development server and production build both use the Node adapter.

## Configuration

- `PUBLIC_API_BASE_URL`: browser-accessible API origin; defaults to
  `https://api.crimeisdown.com`.
- `PUBLIC_MAPBOX_ACCESS_TOKEN`: optional Mapbox public browser token (`pk.`).
  Without it, the map uses OpenStreetMap and omits the Mapbox basemaps.
- `PUBLIC_PREVIEW=true`: enables the frontend preview notice.
- `PUBLIC_GOOGLE_MAPS_API_KEY`: browser key for Maps JavaScript and Places.
  Restrict it to approved website referrers and the required APIs.
- `GOOGLE_GEOCODING_API_KEY`: server-only key required for address lookup.
  Restrict it to the server egress IP and Geocoding API. Never use a `PUBLIC_`
  variable for this key.

Set local values in an ignored `.env` file. Variables prefixed with `PUBLIC_`
are embedded in browser code; never put private credentials in them.

The settings page supports browser-local API and search configuration overrides.
Member search credentials are requested from the API after login. The bundled
search-only demo credential supports the publicly accessible transcript demo.

## API integration

Account state and Patreon login are provided by the configured API. Browser
requests include cookies; the API must allow the frontend origin and credentialed
CORS. Writes initialize `/sanctum/csrf-cookie` and send the readable `XSRF-TOKEN`
cookie in the `X-XSRF-TOKEN` header. Local development against an API requires
compatible cookie settings or a local API instance.

The frontend consumes user, saved-search, subscription, channel, and audio-export
resources. It does not store account or subscription records locally. Patreon
login returns to the current frontend URL through the API's `/auth/redirect`
endpoint. Tests should use synthetic accounts and mocked responses.

## Checks and builds

```sh
npm test
npm run lint
npm run build
```

The Node build emits a standalone server. Run it with
`HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs` or use the generic container
recipe in `Dockerfile` after building `dist`.

Deployment-specific infrastructure and release procedures are maintained
separately from this public repository.
