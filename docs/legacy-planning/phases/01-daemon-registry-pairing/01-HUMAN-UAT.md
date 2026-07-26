---
status: partial
phase: 01-daemon-registry-pairing
source: [01-VERIFICATION.md]
started: 2026-05-03T14:15:00Z
updated: 2026-05-03T14:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live --bind tailscale positive path
expected: `agentic-dashboard start --bind tailscale` boots, pair URL contains MagicDNS hostname with trailing dot stripped, curl from a second Tailscale device returns 200
why_human: Requires a real Tailscale daemon running on host; dev machine has no tailscale binary. The absent-Tailscale path (D-17 degradation) is automated in `bind-modes.subprocess.test.ts`. The positive path is permanently manual per VALIDATION.md.
result: [pending]

### 2. D-20 yellow warning banner color rendering
expected: Running `agentic-dashboard start --bind 0.0.0.0` in a real TTY (iTerm/Terminal.app) shows the WARNING line in yellow ANSI color
why_human: Color rendering depends on terminal capabilities; automated test only checks string content, not ANSI escape code rendering
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
