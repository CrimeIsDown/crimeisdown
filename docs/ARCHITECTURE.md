# Architecture

The Astro website consumes a cookie-authenticated FastAPI API. The backend owns
account identity, membership enforcement, CSRF, saved searches, notifications,
search credentials, recording access and export jobs. Redis stores session/cache
state and Celery coordinates background work. The website and API remain separate
services even though their source is developed together.

The replacement API preserves the established JSON resources and session/record
formats. SQLAlchemy works against the existing schema; credentials, session scope,
provider identifiers and transport destinations are environment configuration.
There is no dependency on a private repository or a second backend at runtime.

Public tests use an empty schema, invented accounts and mocked providers. They
exercise login/CSRF, account updates, OAuth state and replay rejection, entitlements,
resource ownership, notification configuration, quotas, audio conversion, exports,
cache compatibility and worker recovery. They are contract and behavior tests,
not claims that a private historical implementation runs in public CI.
