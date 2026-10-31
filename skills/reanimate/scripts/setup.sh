#!/usr/bin/env bash
# Compatibility entrypoint for Bash users; setup.ts also runs in PowerShell.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v bun >/dev/null; then echo "bun is required (https://bun.sh)"; exit 1; fi
exec bun "$HERE/setup.ts" "$@"
