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
  a search-only credential restricted to `calls_demo`, required for the public
  homepage transcript preview.
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

### Homepage transcript preview

The homepage address form uses the browser Places autocomplete key above and
`/api/location-context`, the same server-side lookup as the Chicago Map. The
server Geocoding key must be available at runtime. City-boundary validation uses
the map datasets; locations outside Chicago are rejected.

Successful lookups open `/transcripts/search` with `calls_demo` refinements for
the police zone and OEMC fire/EMS channel tags: `CFD Fire Main` / `CFD EMS Main`
for north and `CFD Fire Englewd` / `CFD EMS Englwd` for south. Searches include
`chi_cpd` and `chi_oemc`; `chi_cfd` is excluded because
it patches OEMC and duplicates its traffic. Explicit demo links always use the
public demo search key, including for signed-in members. The
preview is channel-based, not a search for incidents at the exact address.

Configure the demo key in the private production `frontend-build.env` before
building a release. Use the existing demo index through the public search router;
monthly archive hosts may not contain `calls_demo`. Confirm the credential can
search that index and is denied access to monthly indexes and index settings.
Never embed an administrator key or use local synthetic data in production.

### Key-free local geocoding

`npm run dev` uses Photon/OpenStreetMap for geocoding and homepage address
suggestions by default, without Google keys. For a local production-build preview,
run `GEOCODING_PROVIDER=photon npm --prefix frontend run preview -- --host 0.0.0.0`.
Production builds default to Google; set `GEOCODING_PROVIDER=google` explicitly to
use Google during development. The browser obtains the active provider from
`/api/location-suggestions`, so no separate public provider setting is required.

Photon requests are debounced and cached for local use. Its public demo server
has no availability guarantee; see https://github.com/komoot/photon#demo-server.
Address coverage differs from Google. Numbered-address lookups reject unmatched
house numbers rather than assigning channels from a street midpoint. CrimeIsDown
still uses its own Chicago boundary and channel datasets after geocoding. Demo
transcript results continue to require `PUBLIC_MEILISEARCH_DEMO_KEY`.

### Testing transcript conversion without Patreon

The isolated API supports normal email/password registration at
`http://YOUR_LAN_IP:8000/register`; it does not require a Patreon account. Users
created there belong only to the temporary demo database and disappear when the
local API stops.

For repeatable search tests, `CID_DEMO=1 python3 scripts/seed-local-search.py`
seeds a separate local Meilisearch with eight clearly labeled synthetic calls. The
loader only writes to a loopback URL and reads a local Meilisearch master key from
`/tmp/cid-homepage-search.env` (override with `--env-file`). It writes only the
search-only demo key and public search origin to the ignored `frontend/.env.local`.
Use `--public-url http://YOUR_LAN_IP:7700` when testing from other machines, then
rebuild the frontend. The demo key is scoped to `calls_demo` and cannot change
settings or query monthly indexes. Synthetic calls have no audio attached.

### Member searches and Sirens handoff

Homepage account checks use `/api/user`. Visitors and users without transcript
search access open `calls_demo`; eligible members open the current UTC monthly
index with the same police-zone/fire-channel filters. Membership is still checked
by the backend when the search page requests a private search key.

The “Locate the sirens” link passes an editable question in a URL fragment. The
Sirens client must support `#prompt=...`; it preserves that draft through sign-in
and does not submit automatically. Production defaults to `https://sirens.app/`.
Set `PUBLIC_SIRENS_URL` in the ignored frontend environment to test a separate
local Sirens server. Deploy the Sirens receiver change before using prefilled
questions on the public site.
