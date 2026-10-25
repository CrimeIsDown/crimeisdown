#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
uv run --package app pytest backend/tests -q "$@"
