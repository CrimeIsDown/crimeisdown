# CrimeIsDown

Tools for listening to Chicago scanner audio, searching transcripts, looking up
locations and managing notifications. The application uses an Astro/React frontend
and a FastAPI backend, with SQLAlchemy, Redis, Celery, Meilisearch and FFmpeg.

```text
backend/       API, workers, account pages and self-contained contract tests
frontend/      Astro/React website and frontend tests
scripts/       Local development and publication checks
compose.yml    Optional local Redis and Meilisearch services
```

## Development

Use Python 3.14+, uv, Node.js 24+ and npm. FFmpeg is required for audio tests.

```sh
uv sync --frozen --package app
npm --prefix frontend ci
# Terminal 1: temporary SQLite and memory state; no real provider credentials.
CID_DEMO=1 uv run --package app python scripts/dev-api.py
# Terminal 2: website against the local API.
CID_RUNTIME=node PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

The development API uses an empty application schema and blocks outbound provider
calls. It demonstrates startup and logged-out behavior; authenticated scenarios
are covered by synthetic fixtures and mocked providers in the tests. Public map
and scanner links still use external services. No production account database,
audio corpus or deployment configuration is included.

## Validate

```sh
npm test
npm run test:backend
CID_RUNTIME=node npm run build
python3 scripts/check-publication.py
# Install Gitleaks, then scan every locally available Git ref.
gitleaks git --log-opts=--all --redact=100
```

The public test suite requires no PHP, private repository or historical backend
commit. Original-implementation comparisons are maintained separately. The
optional Meilisearch integration test needs a disposable local search service.

Read [configuration](docs/CONFIGURATION.md), [architecture](docs/ARCHITECTURE.md)
and [security](SECURITY.md). The backend retains compatible account records,
sessions and API contracts; deployment-specific mappings are configured separately.
The earlier frontend history is preserved with credential literals removed.

This project incorporates work derived from the
[FastAPI full-stack template](https://github.com/fastapi/full-stack-fastapi-template).
See LICENSE for attribution.
