# Design notes — agent board

## 1. Extract the adapters, do not copy them

**Rejected: copy the four adapter files into this repo.**

Fastest to start and guaranteed to rot. The adapters encode a lot of accumulated
knowledge about malformed input — layered error containment in one, nine distinct
fixture cases in another including a truncated trailing line and a duplicated
plan update, a SQLite read with a legacy fallback in the third. That knowledge
lives partly in the code and partly in fixtures verified against real files. A
copy takes the code and leaves the fixtures, which is the worst possible split:
the copy looks correct and is untested against the cases that motivated it.

Two copies also guarantee divergence. The first time one host changes its
on-disk format, one frontend gets fixed and the other does not, and the failure
is silent — a session simply stops appearing.

**Rejected: import across repo boundaries by relative path.**

Avoids duplication without any packaging work, and breaks the rule that repos are
self-contained. It also makes this repo's build depend on a sibling checkout
existing at a particular path.

**Chosen: consume an external adapter package extracted by a separate change in the viewer's
repo.** That repository owns and reviews the workspace migration. This change
owns only the dependency contract and integration after a release exists. The
cost buys one implementation, one fixture set, and a format change that fixes
both frontends once each consumer upgrades to the released package version.

The existing adapters are not runtime-portable: they use `Bun.file`,
`Bun.JSONL`, and `bun:sqlite`, while the daemon supports Node 20 and carries no
native dependencies. The extraction therefore preserves the frozen model,
observable parsing behavior, and fixture corpus while replacing those runtime
seams behind internal interfaces. The package must import and pass its fixture
suite in both Bun and Node 20. A separately published version still requires an
ordinary dependency upgrade in each consumer; the package is one source of the
fix, not an automatic deployment channel.

## 2. Why the endpoint ships before the adapters

Stage 1 serves the wire shape from a stub. Stage 2 swaps in the real adapters.

The alternative — do the extraction first, then build everything — makes the
board surface wait on a repo migration it has no dependency on. Two pieces of
work that need nothing from each other would be serialised for no reason. The
wire shape is fixed from the start, so the swap is invisible to every consumer.
The store publishes one immutable snapshot reference at a time, so a request
observes either the complete synthetic snapshot or the complete live snapshot,
including when live adapter initialisation fails.

## 3. Polling, not push

The existing architecture has no push channel, deliberately. Adding server-sent
events or a websocket for one surface means introducing a connection lifecycle,
a reconnection policy, and a second failure mode, in exchange for latency that
nobody watching a board will perceive.

Polling every three seconds, backed by a daemon cache no older than one second,
meets a five-second render target with one second of request/render headroom. It
pauses when the tab is not visible,
because the actual usage pattern is a tab left open on a second device, and a
forgotten tab polling for days is a real cost with no benefit.

## 4. No dependency arrows

Blocked cards name their blockers as text rather than drawing edges.

This is not a rendering shortcut; it is the same decision the terminal viewer
already reached. Drawn edges over a kanban surface become unreadable at around
five of them, and they answer a question nobody asks. The question is "what am I
waiting for", and a title answers it directly.

## 5. Read-only, and why that is a security position rather than a scope cut

Making the board writable would mean the daemon mutating the state of running
agent sessions belonging to four different hosts. That is a different product
with a different threat model, and it would put the daemon in the position of
corrupting a session it does not own. The read-only posture here is the same one
the rest of the product holds.

## 6. One colour system across two frontends

Host identity uses the colours the terminal viewer already defines, imported from
the shared package rather than re-picked. Somebody moving between the terminal
and the browser should not have to relearn which host is which — and a second
palette would drift from the first the moment either changed.

The shared style entry carries both colour and a short textual label. Cards render
the label as well as colour so host identity does not depend on hue.

## 7. Exact envelope and identity

The response wraps the frozen upstream records in a dashboard-owned envelope.
It records generation time, synthetic state, and one status entry for each
known host: `claude`, `codex`, `opencode`, and `pi`. Host entries also carry
deterministic omission counts covering
invalid records, referential exclusions, and record caps, plus the total number
of completed tasks outside the window computed from the readable source
inventory before record caps.
Record identity is composite: session `(host,id)`, task
`(host,sessionId,id)`. Blocker IDs resolve only inside the blocked task's own
host and session. The upstream arrays carry bare task `id` strings, so a
reference is looked up as `(task.host, task.sessionId, referencedId)`; a missing
target renders its short ID rather than disappearing.
The upstream `Session.updatedAt` field is required; only `cwd` and `createdAt`
remain optional in the session record.

The dashboard's internal shared schema package owns the strict runtime envelope validator.
Its Stage 1 record schemas mirror the frozen upstream fields so fixture responses
can be validated before the external package is released; they are wire
validation, not host parsing. Stage 2 adds compile-time compatibility checks
against the imported model and runs the upstream fixture corpus through the
dashboard validator. A field change therefore fails a build or fixture test
rather than becoming an independent model fork.

Host state describes trust in the source, not merely whether some records were
returned. `present` means the source was readable and all accepted records were
valid; `absent` means no source exists; `unreadable` covers either a wholly
inaccessible source or a partially readable source with rejected records. The
required unreadable-state reason and omission counts distinguish those two cases and
are shown on the surface. Reasons are dashboard-owned codes rather than raw
adapter errors, so they cannot contain a path or host-authored text.

## 8. Read-only input boundary and output minimisation

Adapters read only fixed host-data roots chosen by daemon code. Canonical paths
must remain beneath those roots, reads are size-bounded, and the SQLite adapter
opens read-only without creating WAL or shared-memory sidecars. The daemon never
logs or persists a board payload.

Free text is agent-authored and cannot be semantically redacted without silently
changing task meaning. The host is responsible for what it records. The board
minimises exposure by emitting plain text only, replacing absolute working
directories with symbolic paths, truncating bounded fields, and marking the host
entry when truncation occurred.

## 9. Freshness and fan-out

Visible tabs poll every three seconds. Host snapshots are memoised for at most
one second and concurrent refreshes coalesce per host, so multiple second devices
do not multiply filesystem reads. A network failure leaves the last snapshot
visible with its generation time and a stale warning. A hidden tab pauses,
retains the last snapshot with a paused label, and refreshes immediately when it
becomes visible.

## 10. Fixed limits

Per host, one response carries at most 200 sessions and 2,000 tasks. Titles are
bounded to 256 Unicode code points and notes to 2,048. Exceeding a bound
truncates deterministically and marks the host envelope; it never silently
pretends the snapshot is complete. The surface reports record-cap omissions
separately from the completed-window count. Caps retain the first records in the
specified deterministic order.
