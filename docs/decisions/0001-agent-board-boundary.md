# ADR-0001 — Agent board wire and trust boundary

- Status: Accepted
- Date: 2026-07-28
- Change: `openspec/changes/add-agent-board`
- Supersedes: —
- Superseded by: —

## Context

The dashboard needs one read-only board for sessions and tasks produced by four
agent hosts. The canonical host parsers belong to the external terminal-viewer
package, while the dashboard owns the HTTP boundary used by a second device.
That boundary must tolerate one bad or missing host without exposing local
paths, inventing a second data model, or mixing fixture and observed records.

## Decision

1. The dashboard mirrors the frozen upstream `Host`, `TaskStatus`, `Session`,
   and `Task` shapes only as strict runtime wire validators. Host parsing remains
   in the external adapter package.
2. The HTTP response uses a dashboard-owned envelope with exactly one state
   entry for each of `claude`, `codex`, `opencode`, and `pi`. Identities are
   composite—session `(host,id)` and task `(host,sessionId,id)`—and invalid,
   duplicate, or referentially unresolved records are excluded and counted
   before outbound validation.
3. A response is wholly synthetic or wholly observed. Stage 1 serves one
   explicitly synthetic four-host fixture; Stage 2 may replace that immutable
   snapshot only as a complete unit.
4. `GET /api/v2/board` is mounted behind the daemon's existing bearer, CORS,
   and bind-mode middleware and has no mutating sibling. Working directories
   are reduced to `repo:<registry-id>/<relative-path>` or `external`.
5. Before transmission, records receive deterministic ordering, per-host
   200-session and 2,000-task caps, and Unicode-code-point title/note bounds.
   The envelope discloses record omissions, field truncation, and completed
   tasks outside the display window as separate values.

## Alternatives considered

- **Copy the host parsers into this repository.** Rejected because format fixes
  would fork across the terminal viewer and dashboard.
- **Expose one endpoint per host.** Rejected because clients could observe
  inconsistent refreshes and would need to reconstruct partial-failure rules.
- **Return raw working directories.** Rejected because the founding use case
  sends the payload to a second device and absolute paths reveal machine-local
  information.
- **Drop a whole host after one malformed record.** Rejected because readable
  siblings remain useful when omissions and the stable failure reason are
  disclosed.

## Consequences

- The external adapter release is a prerequisite for live data, but not for the
  fixture-backed endpoint and UI.
- Runtime validation exists in both the adapter boundary and outbound HTTP
  boundary; compile-time compatibility and shared fixtures must prevent those
  checks from becoming an independent model fork.
- Clients can render partial failures deterministically, but must state when a
  snapshot is synthetic and keep record-cap omissions distinct from the
  completed-window count.
- The board remains read-only and uses polling; no host write API or push
  channel is introduced.

## Verification

- OpenSpec delta: `openspec/changes/add-agent-board/specs/agent-board/spec.md`
- Wire tests: `packages/shared/src/schemas/board.test.ts`
- Endpoint policy tests: `packages/agent/src/lib/boardSnapshot.test.ts`
- Route tests: `packages/agent/src/routes/board.test.ts`
