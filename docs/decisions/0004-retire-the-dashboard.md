# ADR-0004: Retire the dashboard

**Status**: Accepted  **Date**: 2026-08-05  **Linear**: —

## Context

This product was built to answer, at a glance and from any device, whether every
registered repo is production-ready. It works. It was never used.

The question "should this exist?" was asked directly on 2026-08-05, mid-way
through `retire-v1-surfaces`, and the honest answer was no. What follows is the
evidence, recorded here rather than summarised, because a decision to retire
something this carefully built should be checkable by whoever doubts it later.

### The fleet never materialised

The registry holds **three projects**: `agenticapps-dashboard` itself, `cparx`,
and `fx-signal-agent`. The `agenticapps` family alone contains 17 directories,
before counting `factiv`, `neuroflash`, `personal`, and `shared`. The registry
was last written on 2026-08-02 and had not grown in months.

Aggregation across a fleet is the *only* thing a resident daemon buys over
per-repo shell commands. It was being delivered for a fleet of two repos plus
itself. Two repos fit in a person's head.

### Four of the six checks had nothing to report

`repo-readiness` derives what it can from disk (tier A) and accepts an optional
`<repo>/.agenticapps/readiness.json` for what it cannot (tier B). **No registered
repo has ever had one.**

Tier A can genuinely derive `workflow` (is the skill current) and `spec` (does
the OpenSpec tree carry open changes). It cannot derive `security-review`,
`pen-test`, or `coverage` — those need something outside the filesystem to report
them. So the surface was, correctly and honestly, rendering `never` for the four
questions that actually matter, and answering the two that a shell one-liner
answers. The honesty rule worked exactly as designed; what it honestly reported
was *we do not know*.

### The cost, measured

| | |
|---|---|
| Commits | 662, 2026-05-02 → 2026-08-05 |
| Source (ts/tsx, excl. tests) | 33,125 lines |
| Tests | 39,260 lines |
| OpenSpec prose | 27,967 lines |

Roughly 100,000 lines of artifact. Note that the cost was not in *running* the
dashboard — it was in *maintaining* it. A tool whose upkeep exceeds its use is
worse than one that is merely expensive.

### The recent work was the product removing itself

Commits per month: **378** (May), **170** (June), **31** (July), **83** (August).
The August resurgence is not new capability. It is `retire-v1-surfaces`: §2 alone
deleted 107 files and 17,527 lines, and the change withdrew five of fifteen
capabilities and forty of 145 requirements. The most productive recent work on
this product was amputation, and the amputation was correct each time.

### The design admitted the problem in its own artifacts

The workflow conformance surface measured **65.0** against the ratified critique
floor of **80** and was waived on 2026-08-05. The recorded reason is not a polish
defect:

> No route from a finding to an action. The surface carries **zero anchors** and
> no remedy prose. It reports "codex-workflow: 7 laggards" and offers nowhere
> to go.

Two proposed changes stood at **0/23** (`add-oss-readiness`) and **0/24**
(`verify-tailscale-second-device-access`). The second is the "from any device"
premise from the founding spec — proposed, worktree created, never started.

### Agent independence is what actually settles it

The dashboard is **read-only by constitution**. That is `filesystem-access-policy`,
the security spine, and it was the right call for a tool a human reads.

It is the wrong shape for a tool an agent uses. The loop is: daemon reads repo →
SPA renders state → human reads it → human opens a terminal → agent acts. The
human is a message bus between two machines. An agent that reads the repo
directly collapses both hops and can then *do something*, which the dashboard is
constitutionally forbidden from doing.

Every check the dashboard performs is a computation an agent can run in-repo,
with full context, at the moment it matters. What the dashboard adds is a glance
across repos — for a fleet of two.

## Decision

**Retire the dashboard.** Preserve it, explain it, and stop.

Specifically:

- `retire-v1-surfaces` is merged to `main` at **39/56** and closed as superseded.
  It is deliberately *not* finished. The remaining bullets — §1's help pages,
  §6's package unhooking, §7's deploy and two-stage review — are work to polish a
  product being withdrawn.
- `add-oss-readiness` (0/23) and `verify-tailscale-second-device-access` (0/24)
  are closed unstarted.
- `@agenticapps/dashboard-agent` is deprecated on npm, not unpublished, so
  existing lockfiles keep resolving and anyone installing it sees why it stopped.
- The GitHub repository is archived. The working directory stays where it is.
- The daemon is stopped and `~/.agenticapps/dashboard/` removed. No launchd
  service was ever installed, so nothing restarts it.

## What is worth keeping, and where it is

One idea here is genuinely non-trivial and is recorded rather than extracted,
because building a second thing that also goes unused is the mistake this ADR
exists to stop.

**Ancestry-based freshness.** Evidence about a repo is stale when the last commit
touching production code is *not an ancestor of the evidence commit* — never when
a file timestamp looks old. Timestamps are actively wrong here: a fresh clone
stamps every file with checkout time, which makes stale evidence look current.
This is the failure mode that silently invalidates every "we reviewed it"
claim in a repo.

| File | Lines | What it holds |
|---|---|---|
| `packages/agent/src/lib/readiness/freshness.ts` | 42 | The whole rule. `stalenessReason()` returns why evidence is stale, or null. Read this first. |
| `packages/agent/src/lib/readiness/gitFacts.ts` | 178 | `isAncestor()`, `lastCommitTouching()` — the git plumbing, bounded per `filesystem-access-policy`. |
| `packages/agent/src/lib/readiness/productionScope.ts` | — | What counts as production code, so docs-only commits do not age evidence. |
| `packages/agent/src/lib/readiness/reviewDeriver.ts` | — | The consumer worth reading as a worked example. |

Recovering this is an hour of reading, not a rebuild. The trigger for doing so is
a *named consumer that wants it* — not the feeling that it was a shame to waste.

## Alternatives rejected

**Finish v2, then decide.** Rejected. Seventeen bullets remained across four
sections. Completing them would improve a product whose problem is not
incompleteness — the finished parts were not used either.

**Keep it running, unmaintained.** Rejected. An abandoned daemon with a bearer
token, a CORS lock, and read access to every registered project's filesystem is a
security surface nobody is watching. Retiring it properly is safer than letting
it rot.

**Extract the readiness kernel into a CLI now.** Rejected for now, recorded
above. Roughly a day of work with no consumer asking for it, which is the same
reasoning that produced the dashboard.

**Register all 17 repos and use it for two weeks as a falsification test.**
Genuinely offered and genuinely cheap. Declined: the author's own answer to "do
you open it?" was no, which is the same data the test would have produced, more
slowly.

## Consequences

- No dashboard. Readiness questions are answered per-repo, by an agent, at the
  moment they are asked.
- `agenticapps-workflow-core`, `claude-workflow`, `codex-workflow` and
  `pi-agentic-apps-workflow` are unaffected. Nothing depended on this.
- The OpenSpec specs remain readable in the archived repo. `openspec/specs/`
  states v2 as of the fold on 2026-08-05: 105 requirements across 10
  capabilities. `openspec/CAPABILITY-MAP.md` carries the full withdrawal history.
- **Do not reopen this without new evidence.** The argument above turns on three
  facts: a fleet of two, zero tier-B files, and an author who did not open it. If
  those change, the decision deserves revisiting. If they have not, this ADR is
  the answer.

## What was actually good here

Recorded because a retirement that pretends the work was worthless teaches
nothing, and because some of this is worth stealing.

- **Ancestry freshness over timestamps.** The one genuine idea. See above.
- **Honest absence.** Six-value status vocabulary where `never`, `na`, and an
  evaluation error are first-class states, distinct from `fail`. A check that
  cannot run says so and is never rendered as `0 %` or as a green tick standing
  in for no data. Most dashboards lie here.
- **No aggregate score.** Deliberately refusing a number, because a ranking
  invites comparing repos instead of reading the cells that say what to fix.
  This was argued for and held under pressure.
- **Requirements that name their own oracle.** The repeated review finding that a
  `MUST NOT` asserting an outcome with no named check is unenforceable prose. It
  produced real tests — `typographyTokens.test.ts` parses the token enumeration
  out of the stylesheet rather than restating it, so the two cannot drift.
- **Proving a test can fail before believing it.** Applied throughout, including
  on the last working day: a schema assertion went green for the wrong reason and
  was caught and rewritten rather than banked.

The discipline was better than the product. That is worth knowing about oneself,
and it is the reason this ADR is long.
