# Configuration

Use ignored environment files or a deployment secret store. The checked-in
`.env.example` contains local placeholders only. Do not copy a live environment
into the repository. The isolated development helper does not read that file.

## Backend

Set `APP_KEY` to a private 32-byte application key and `CID_DATABASE_URL` to the
intended application database. During a migration, retain existing keys, IDs,
cookie names and session settings through private environment configuration.
Use the schema-check command before enabling workers; no template migrations
or account seeds are run automatically against an existing database.

`CID_MEMBERSHIP_TIERS` is a JSON object keyed by provider tier IDs. Each value is
`[name, monthly_rate, archive_downloads, transcript_search, notifications, geosearch]`.
`CID_ADMIN_TIER_ID` selects the existing administrator override identifier.
Defaults use fabricated `demo-*` IDs for tests and development. Configure the
real mappings privately before using an existing membership database.

Configure Patreon client/campaign/callback settings, credentialed CORS, Redis,
mail, notification transports, recording storage and export buckets as needed.
Recording/export bucket names and the optional video channel have no production
default. Static notification rules default to an empty JSON object; a private
file can be selected with `NOTIFICATION_CONFIGURATION`. Never commit its real
delivery destinations. No owner-only deployment enrollment feature is included.

## Frontend

Set these during the Astro build:

- `PUBLIC_API_BASE_URL`: browser-accessible API origin.
- `PUBLIC_GOOGLE_MAPS_API_KEY`: restricted browser Maps/Places key.
- `PUBLIC_MAPBOX_ACCESS_TOKEN`: restricted public Mapbox token.
- `PUBLIC_MEILISEARCH_URL` and `PUBLIC_MEILISEARCH_DEMO_KEY`: search origin and
  an optional search-only credential restricted to the public demo index.
- `PUBLIC_DOORBELL_APP_ID` and `PUBLIC_DOORBELL_API_KEY`: optional feedback widget.
- `PUBLIC_HOTJAR_SITE_ID`: optional analytics site identifier.

Missing widget/analytics settings disable those integrations. Missing Mapbox
configuration falls back to OpenStreetMap. Paid search keys are requested from
the API after authentication, rather than embedded in the frontend.

`GOOGLE_GEOCODING_API_KEY` is a server-only runtime setting for address lookup.
Restrict it to the intended server IP and Geocoding API. Never put it in a
`PUBLIC_` variable. All `PUBLIC_` values are visible to visitors; configure their
provider restrictions and scopes accordingly.

Build the API from the repository root with `docker build -f backend/Dockerfile .`.
For the website, build `frontend/dist` first, then use `frontend/Dockerfile` with
`frontend` as its build context. Production inventory and deployment runbooks
are maintained outside this repository.
