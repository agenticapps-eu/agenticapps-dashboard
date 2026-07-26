# Design notes — agent board

## 1. Extract the adapters, do not copy them

**Rejected: copy the three adapter files into this repo.**

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

**Chosen: extract into a package in the viewer's repo, consumed by both.** The
cost is real — the viewer repo has to move to a workspace layout, which is its
own work in its own repo. That cost buys one implementation, one fixture set, and
a format change that fixes both frontends at once.

## 2. Why the endpoint ships before the adapters

Stage 1 serves the wire shape from a stub. Stage 2 swaps in the real adapters.

The alternative — do the extraction first, then build everything — makes the
board surface wait on a repo migration it has no dependency on. Two pieces of
work that need nothing from each other would be serialised for no reason. The
wire shape is fixed from the start, so the swap is invisible to every consumer.

## 3. Polling, not push

The existing architecture has no push channel, deliberately. Adding server-sent
events or a websocket for one surface means introducing a connection lifecycle,
a reconnection policy, and a second failure mode, in exchange for latency that
nobody watching a board will perceive.

Polling on a short interval is sufficient. It pauses when the tab is not visible,
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
agent sessions belonging to three different hosts. That is a different product
with a different threat model, and it would put the daemon in the position of
corrupting a session it does not own. The read-only posture here is the same one
the rest of the product holds.

## 6. One colour system across two frontends

Host identity uses the colours the terminal viewer already defines, imported from
the shared package rather than re-picked. Somebody moving between the terminal
and the browser should not have to relearn which host is which — and a second
palette would drift from the first the moment either changed.
