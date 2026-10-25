#!/usr/bin/env bash
set -euo pipefail
# Replacement startup is read-only. Never run template migrations against Laravel.
python -m app.crimeisdown.cli check-schema
