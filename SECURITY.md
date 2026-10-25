# Security

Report vulnerabilities through GitHub private vulnerability reporting when
available. Do not open a public issue containing credentials, private records,
signed audio URLs, browser authentication state or production configuration.

Before committing, install Gitleaks and enable the local hooks:

```sh
git config core.hooksPath hooks
```

CI scans all fetched history with Gitleaks and checks the tracked tree for common
operational disclosures. Do not bypass a failed scan. Classify and resolve the
finding, rotate actual exposed credentials where needed, and rescan. Provider
restrictions remain necessary for public browser keys.

Generic development configuration and public service endpoints belong here.
Live environment files, private keys, notification destinations, account data,
production inventory, rollback reports and private repository histories do not.
A clean automated scan does not replace a manual review of data and configuration.
