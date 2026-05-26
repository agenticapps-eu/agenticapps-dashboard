#!/usr/bin/env bash
# stub-gitnexus-failing.sh — Phase 13 integration-test fixture (failure variant).
# Variant of stub-gitnexus.sh that fails on the Nth invocation.
# Used for partial-success family scan tests (D-13-05).
#
# Behaviour controlled by environment variables:
#   STUB_FAIL_ON_INVOCATION  default 2  — which invocation number fails (1-based)
#   STUB_COUNTER_DIR         default $TMPDIR or /tmp — directory for counter file
#
# The counter persists across invocations via a file so the test harness
# can run multiple calls in sequence and observe per-invocation behaviour.
# Reset by deleting COUNTER_FILE between test cases.
set -e

COUNTER_DIR="${STUB_COUNTER_DIR:-${TMPDIR:-/tmp}}"
COUNTER_FILE="${COUNTER_DIR}/stub-gitnexus-failing.count"
N=$(( $(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$N" > "$COUNTER_FILE"

FAIL_ON="${STUB_FAIL_ON_INVOCATION:-2}"
if [ "$N" = "$FAIL_ON" ]; then
  echo "stub-gitnexus-failing: synthetic failure on invocation $N" >&2
  exit 1
fi

exit 0
