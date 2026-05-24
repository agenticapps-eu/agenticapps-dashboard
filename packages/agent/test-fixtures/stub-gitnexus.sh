#!/usr/bin/env bash
# stub-gitnexus.sh — Phase 13 integration-test fixture.
# Mimics `gitnexus analyze` behaviour for deterministic daemon tests.
#
# Behaviour controlled by environment variables:
#   STUB_GITNEXUS_EXIT_CODE  default 0  — final exit code (set to 1/2 for failure)
#   STUB_GITNEXUS_DELAY_MS   default 0  — sleep before exit (for progress-poll tests)
#   STUB_GITNEXUS_STDERR     default "" — string printed to stderr if non-empty
#
# Side effects: NONE — never writes to ~/.gitnexus. Tests that need a writable
# .gitnexus directory should point HOME at a per-test tmpdir
# (Phase 10 gitnexusHomeOverride pattern).
#
# Only the 'analyze' subcommand is supported; all others exit 2.
set -e

if [ "${1:-}" != "analyze" ]; then
  echo "stub-gitnexus: unsupported subcommand '${1:-<none>}'" >&2
  exit 2
fi

if [ -n "${STUB_GITNEXUS_DELAY_MS:-}" ]; then
  python3 -c "import time; time.sleep(${STUB_GITNEXUS_DELAY_MS}/1000.0)"
fi

if [ -n "${STUB_GITNEXUS_STDERR:-}" ]; then
  echo "${STUB_GITNEXUS_STDERR}" >&2
fi

exit "${STUB_GITNEXUS_EXIT_CODE:-0}"
