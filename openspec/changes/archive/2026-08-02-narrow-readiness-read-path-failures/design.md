## Context

Three defects in the tier-B readiness read path, all recorded in
`openspec/specs/repo-readiness/spec.md` as known weaknesses the requirement text
declines to endorse. They were deferred from `close-readiness-spec-gaps`
(archived 2026-08-02) because each changes what tier B promises rather than
correcting what it does.

Current state, verified against the code:

- `evidenceIsReadable` (`readinessFile.ts:146`) returns a whole-file `unusable`
  outcome on the first citation it cannot open. `assemble.ts:67` then sets
  `file = null`, so all six checks fall back to derived values.
- `readFleet` (`service.ts:345`) awaits `Promise.allSettled` over per-repo
  snapshots with no time bound, and awaits `signatureFor` before that with no
  bound either. `allSettled` survives rejection, not a hang. Git subprocesses
  carry `GIT_SUBPROCESS_TIMEOUT_MS` (5 s), but **no filesystem call in this path
  is bounded at all** — `lstat`, `stat`, `readFile` and the verifying `open`.
- `PenTestDeclarationSchema` (`readiness.ts:434`) restricts status to
  `ok | warn | fail` and requires `evidence`, `commit`, `validUntil` and
  `observedAt` on all of them.

The binding constraint on the whole design is `computeReady`
(`readiness.ts:285`), and specifically its advisory exemption: a `never` that is
`derived`, on an advisory check, with `notice === null`. Session 17 added the
`notice === null` term precisely to stop a repo reaching ready by breaking its
own readiness file. Any narrowing of the citation blast radius runs straight at
that guard.

## Goals / Non-Goals

**Goals:**

- One bad citation costs one declaration, not six.
- The fleet endpoint answers within a bounded time whatever a single repo does.
- An author can declare "never pen-tested" and have it block.
- `computeReady` is not modified. Its contract is well-tested and cross-validated
  by `refineReady` on the wire; a change there is a change to every surface.

**Non-Goals:**

- Closing the TOCTOU substitution window itself. That belongs to the shared read
  primitive (`resolveAllowedNamed`) and stays out of scope, as the spec already
  states. This change bounds the *consequence* at the endpoint, not the race.
- Cancelling a hung filesystem operation. Node cannot interrupt a blocking
  `open` on a FIFO; the design abandons the wait, it does not reclaim the work.
- Any wire-shape change. No new field on `CheckResult`, `RepoSummary`, or
  `FleetResponse`.
- New SPA state. The rejected-entry result must render through paths that
  already exist.

## Decisions

### D1 — A rejected entry becomes an error-bearing declared `fail`, not a fallback

**This is the decision the change turns on.** The obvious implementation of
"narrow the blast radius" is to drop the offending entry and let that check fall
back to its derived value. That reopens the exact hole session 17 closed:

> repo declares `pen-test: fail`, cites a path, deletes the path → entry dropped
> → `pen-test` falls back to derived `never` → `never` + `derived` + advisory +
> no notice → **exempt** → the repo reports ready.

A repo would improve its verdict by breaking its own evidence. So a rejected
entry does not fall back. It produces:

```
{ id, status: 'fail', source: 'declared', at: null, value: null,
  threshold: null, evidence: null,
  error: { code: 'evidence-unverifiable', message: '<cited> could not be read' } }
```

`computeReady` blocks on `check.error !== null` before it ever reaches the
exemption, so the rejection is **self-sufficient** — correct even if the notice
were dropped. That is the property worth having: the verdict does not depend on
two mechanisms agreeing.

Shape constraints this satisfies: `refineResult` requires an error-bearing result
to use `status: 'fail'` (✓), and `error.message` is `SanitisedTextSchema`, which a
repo-relative path passes. `evidence` is null because an unverified citation must
not be presented as evidence — the path goes in the message, where it reads as a
fault to fix rather than a link to follow.

*Alternative rejected:* drop the entry and keep a notice, relying on the
notice-suspension to block. It reaches the right verdict today but only for
advisory checks, and only while the suspension exists; a rejected `coverage`
entry would still silently become a derived value.

### D2 — Whole-file invalidation survives for structural malformations

Narrowing applies only to citation verification, which happens *after* a
successful parse and therefore has trustworthy entry boundaries. Unsupported
version, unparsable JSON, a malformed known entry, and the collapsing production
scope (`assemble.ts:80`) all still discard the file: there is no reliable notion
of "which entry" to narrow to when the structure itself is in question.

A consequence worth stating: the notice-suspension clause in the predicate
requirement stays. It is still load-bearing for those modes.

### D3 — `evidenceIsReadable` returns a set of rejected ids, not an outcome

Signature changes from `Promise<ReadinessFileOutcome | undefined>` to something
like `Promise<Set<CheckId>>`. `readReadinessFile` returns a fourth outcome kind
carrying both the usable file and the rejected ids:

```
| { kind: 'usable'; file: ReadinessFile; rejected: Map<CheckId, string> }
```

The map value is the cited path, so `assemble.ts` can name it in the error
message without re-deriving it. A `usable` file with a non-empty `rejected` map
also raises the repo-level notice — the file is not wholly unusable but it is not
correct, and the author needs to see that.

Loop behaviour changes from "return on first failure" to "collect every failure",
which is better anyway: an author fixing three broken citations currently
discovers them one run at a time.

### D4 — The pen-test declaration becomes a two-variant union

```
PenTestDeclarationSchema = z.discriminatedUnion(?, [substantiated, unsubstantiated])
```

- *substantiated*: `status: ok | warn | fail`, plus `observedAt`, `evidence`,
  `commit`, `validUntil` — the current schema, unchanged.
- *unsubstantiated*: `status: never | na`, and **none** of those four fields.
  `summary` required when `na` (the existing `DeclarationsSchema` refinement
  already enforces "na states a reason" across all entries — reuse it, do not add
  a second rule).

Two variants rather than one shape with optional fields, because optionality
admits `pen-test: never` carrying an expiry and an evidence path — a claim about
a test that did not happen — which the schema would then need a second refinement
to reject. Making it unstateable is cheaper than making it rejected.

Zod note: `z.discriminatedUnion` needs a literal discriminator, and here both
variants share `id: 'pen-test'`. Discriminating on `status` requires enumerating
literals per variant; the simpler route is `z.union([...])` for these two inside
the existing `id`-discriminated outer union, accepting the slightly worse error
messages. Decide at implementation time — either satisfies the spec.

`assemble.ts` needs no change for this: `declaredResult` already computes
`observed = status !== 'never' && status !== 'na'` and nulls `at` and `evidence`
accordingly (`assemble.ts:169`). It reads `entry.observedAt` only when `observed`,
so an absent field is never parsed. `ageDeclaration` returns via the `validUntil`
branch for `pen-test` — that branch must be guarded for the unsubstantiated
variant, which has no `validUntil` and cannot expire.

### D5 — The fleet bound is a race at `service.ts`, not a signal through the stack

`Promise.race([work, deadline])` around each `snapshotFor(...)` and around
`signatureFor(...)`. Threading an `AbortSignal` down to every `stat`/`open` would
be the principled fix, but it touches `resolveAllowedNamed` — the shared read
primitive the spec explicitly puts out of scope — and Node's `fs.promises` honours
`AbortSignal` only on some calls, so it would be a partial bound wearing the
costume of a complete one.

The race is honest about what it does: it bounds *the wait*, not the work. The
hung `open` stays hung until the OS releases it; the fleet stops waiting.

Two hazards this must handle, both in `snapshotFor`:

1. **Do not cache a timeout, and do not abandon the computation either.** The
   bound is at the caller (`readFleet`), outside the
   `.then(snapshot => cache.set(...))` chain, so a timeout naturally caches
   nothing. The in-flight record must also be left alone — and this turned out to
   matter more than "don't corrupt the map".

   *Revised during implementation.* The first draft of the spec said a later
   request should "compute rather than replaying the timeout". Writing the test
   showed that it does not: it joins the still-blocked in-flight computation, so
   the repo keeps reporting unscannable until the block clears. That is the
   better behaviour and is now what the spec says. The alternative — abandon the
   record so the next request starts fresh — would spawn a new blocking scan on
   every poll of a 5-second endpoint, and since a blocked filesystem call cannot
   be cancelled, each new scan would block in turn. Coalescing is what caps the
   cost of a stuck repo at one blocked computation; recovery happens on its own
   when the underlying call returns.
2. **Do not leak the timer.** `clearTimeout` on the settling path, and `unref()`
   so a pending deadline cannot hold the process open at shutdown.

**Bound value:** 15 s, as a new `READINESS_SCAN_TIMEOUT_MS` in `constants.ts`.
Rationale: a scan issues two git subprocesses (`repoFingerprint`) plus more in
`readGitFacts`, each capped at 5 s, plus the openspec CLI at 5 s. A bound at or
below 5 s would cut off repos that are merely slow. 15 s exceeds any single
subprocess cap while keeping the endpoint's worst case tolerable. It is a
constant, not configuration — there is one consumer.

The detail routes (`readRepo`, `rescanRepo`) are deliberately **not** bounded.
The spec's guarantee is about one repo not withholding *the fleet*; a request for
one repo hanging affects only its own caller, and returning "unscannable" to
someone who explicitly asked to rescan that repo would report a fact about the
daemon as a fact about the repository.

## Risks / Trade-offs

- **Narrowing changes reported checks without any file changing.** A repo whose
  file was wholly discarded for one bad citation now has its other declarations
  honoured, so its checks — and possibly its verdict — move on upgrade.
  → Intended, and the direction is not uniformly "readier": the rejected entry
  now blocks where it previously vanished into a derived value. Called out as
  BREAKING for tier-B authors in the proposal.

- **D1 makes a broken citation *worse* for the author than it was.** Previously a
  bad path meant "declarations ignored"; now it means "this check fails".
  → Correct, and the point. A refused declaration must not be silently
  equivalent to no declaration. The notice names the path to fix.

- **The 15 s bound is a guess about pathology, not a measurement.** A very large
  repo on a cold cache could conceivably exceed it and be reported unscannable.
  → The bound exceeds every subprocess cap in the path, so exceeding it means
  something is genuinely stuck rather than slow. If it proves tight, it is one
  constant.

- **A raced timeout leaves work running.** An abandoned scan continues consuming
  a file descriptor and a slot until the OS unblocks it.
  → Unavoidable without cancellable I/O, and bounded in practice: the in-flight
  map holds one computation per repo, so repeated requests do not multiply it.

- **Testing a hang needs a real blocking primitive.** A FIFO with no writer is
  the honest reproduction and is POSIX-only.
  → Use fake timers plus an injected never-settling promise for the bound's
  logic, and keep any real-FIFO test guarded by platform. The requirement is
  about the bound, and the bound is testable without reproducing the race.

## Migration Plan

No data migration. `.agenticapps/readiness.json` files valid today remain valid —
the pen-test change only widens what is accepted. Rollback is a revert; a repo
that adopted an unsubstantiated `pen-test` entry would have its file become
unusable under the old schema, which is visible rather than silent.

Version skew is the real consideration, and it is the known one: the SPA
cross-validates `ready` through `refineReady`, so a new SPA against an old daemon
replaces the readiness feature with the schema-drift screen. This change does not
move the predicate — `computeReady` is untouched by design (see Goals) — so it
does not add skew beyond what shipping the daemon and SPA together already
handles.

## Open Questions

*Both resolved during implementation.*

- **Rejected-entry error code: `evidence-unverifiable`.** A check error and a file
  notice are different objects with separate code spaces, and the precise code
  lets a surface treat a refused declaration differently from a broken file
  without parsing prose.
- **The fleet-signature bound uses the same 15 s.** A tighter bound was arguable
  (it reads one file per installed host and blocks all repos rather than one) but
  the simpler rule won: one constant, one meaning. A timed-out signature is not
  fatal, because it is only a cache key — the scan proceeds under a distinct
  placeholder, which simply means nothing replays from the previous key.

Genuinely still open:

- **Repo-relative paths containing a colon defeat the outbound sanitiser.** A
  citation like `docs/notes:/Users/x.md` is a legal repo-relative path whose
  interpolated error message the shared `SanitisedTextSchema` refuses, because it
  cannot tell that shape from a leaked absolute path. Handled here by dropping
  the path from `error.message` (it stays in `summary`, which is unrestricted),
  but the general hazard belongs to the sanitiser: any daemon message
  interpolating an author-controlled path has it. The schema's own comment
  asserts "no message this daemon constructs interpolates anything but a
  repo-relative path" as the bound on its residual risk — this change is the
  counterexample to that reasoning, not to the rule.
