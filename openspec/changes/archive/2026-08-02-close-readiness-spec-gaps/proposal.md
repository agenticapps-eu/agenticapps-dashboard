## Why

`repo-readiness` shipped on 2026-08-02 with a verdict that cannot vary. `pen-test`
is the only one of the six checks with no derived signal — it reports `never`
unconditionally — and `never` blocks the readiness predicate. No repo declares a
pen test, so **every row on the fleet surface reads "Not ready", and always will**.
A verdict that has one possible value is a watermark, not a signal, and it
devalues the five checks that do measure something.

Four spec-completeness gaps were deferred from that change with reasons, and have
had no home since. Each is a property the code either has or needs, that the
durable spec does not state. One of them is the exact gap a Critical defect lived
in during the PR #90 review: the spec specifies rescan-vs-rescan coalescing and
says nothing about rescan-vs-read, and a rescan that joined a read's cached
computation answered 200 having done nothing. The code was fixed; the property is
still unwritten, so nothing stops it regressing.

## What Changes

- **A check with no derived signal no longer blocks readiness while undeclared.**
  `pen-test` undeclared becomes advisory: visible, ordered, counted, non-blocking.
  The exemption turns on the daemon having nothing to observe for that check, not
  on the result merely being derived — a `coverage` check that looks for an
  artifact and finds none reports a measured `never` that blocks as before, and
  neither does the exemption cover `fail`, `stale`, or a result that failed to
  evaluate.
- **A repo cannot currently assert "we have not pen-tested this" in a way that
  blocks, and the change says so rather than papering over it.** Declared
  `pen-test: never` is invalid (`never` is reserved for no-declaration) and `fail`
  is not a substitute — it asserts a test ran and failed, and requires evidence, a
  commit, and an expiry. An untested repo leaves the slot undeclared, which is
  exactly the advisory case that no longer blocks. Recorded as a genuine gap in
  the delta; closing it is a tier-B vocabulary or schema decision, not this change.
- **The exemption is suspended while a repo's readiness file is unusable**, so a
  repo cannot reach ready by making its own declarations unreadable. Without this
  the two behaviours compose badly: an unusable file discards a declared blocking
  status, the check falls back to a derived `never`, and the exemption would then
  excuse it.
  **BREAKING** for the readiness verdict: a repo with five derived `ok` results
  and no pen-test declaration flips from not-ready to ready. That is the point of
  the change, and it is why the surface must show the advisory check's undeclared
  state alongside the verdict rather than let a green row imply a pen test.
- **An expired declared pen test keeps blocking.** Already true via `stale`, now
  stated as the property that stops the advisory rule becoming a loophole.
- **A cited evidence path is verified, and an unopenable citation invalidates the
  readiness file.** This is what ships and has always shipped — every citation is
  resolved, confirmed to be a regular file within the read bound, and opened, and
  any failure discards the file so all six checks fall back to derived. Durable
  spec never said so, which is the whole of this gap. What the spec now also says
  is the limit of that guarantee: verification establishes the citation is real
  and reachable and **nothing about its contents**, so no surface may present a
  verified path as proof the assurance was performed.
- **A citation the read route cannot serve is shown as text, not as a link.**
  Tier-B validation admits an author-named path anywhere under the repo root while
  the read route serves only its fixed allow-list, so a valid citation can be
  unservable. Offering a link that is known in advance to fail is worse than
  naming the path.
- **The rescan response contract is written down as it ships:** 200 carrying the
  same repo detail shape as the read route, 404 for an unknown repo, 403 for a
  disallowed origin. Clients cannot currently be written from the spec alone.
- **A rescan MUST NOT be served from an in-flight read's computation.** The
  unwritten property behind the PR #90 Critical defect.
- **All three declaration decay models are recorded, including the weak one.**
  `pen-test` decays on the calendar via `validUntil`; declared `code-review` and
  `security-review` decay by commit ancestry; declared `workflow`, `spec`, and
  `coverage` **do not decay at all** and hold until an author edits them. The
  third is the weakest guarantee in tier B and is stated as such rather than
  justified, so a reader cannot infer from the other two that every declaration
  eventually goes stale.

Not in scope: the two reviewer findings from `add-repo-readiness` that were
reviewed and **not** accepted — codex's "the Tier-B schema is not specified" and
gemini's submodule case and `workflow` fail/warn polarity argument. They were
adjudicated with reasons on 2026-08-02 and stay adjudicated. Reopening them
because they are adjacent to this change would make "recorded as not accepted"
mean nothing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-readiness`: the readiness predicate gains the advisory exemption for
  underivable checks, its four limits, and its suspension while a readiness file
  is unusable; the pen-test slot states its advisory designation and the invariant
  that pins membership; two-tier provenance states that cited evidence paths are
  verified as openable, that an unopenable citation invalidates the whole file,
  and that verification establishes reachability and not content; the tier-B
  requirement states all three declaration decay models; the endpoints requirement
  gains the rescan response contract and the cache-forcing scope of coalescing;
  the fleet and detail surfaces state that a ready verdict must name the checks it
  excludes, and that an unservable citation is rendered as text.

## Impact

- `packages/shared/src/schemas/readiness.ts` — a new exported constant naming the
  checks with no derived signal, and `computeReady` gains the blocking rule that
  consults it. Its results parameter widens from `Pick<CheckResult, 'status' |
  'error'>` to include `id` and `source`; both call sites pass whole results
  already. It **additionally takes the repo's readiness-file notice**, which the
  results cannot supply: when a file is unusable every check falls back to a
  derived value with no error, so an advisory check's result is byte-identical to
  the same check in a repo that has no readiness file at all. Without the notice
  the unusable-file guard is not expressible.
- `refineReady` in the same file recomputes `ready` from the results and rejects a
  response where the two disagree. It **must be given the same notice**, which is
  already present on the object it validates alongside `ready` and the results.
  Left as-is, it would reject every response the guard is meant to produce — the
  guard and the outbound check would disagree by construction.
- `packages/agent/src/lib/readiness/assemble.ts`, `service.ts` — the two
  `computeReady` call sites.
- `packages/spa/src/components/panels/readiness/` — the fleet row and repo detail
  qualify a ready verdict with what it excludes. The unservable-citation rendering
  **already ships** (`RepoDetailPage.tsx:314` calls `isReadableProjectPath`); the
  delta states it rather than building it, and corrects the claim that this
  predicate is the read route's own guard — it is a conservative path-only mirror
  of the same allow-list, and the route may still refuse what it admits.
- No route, schema field, or filesystem-access change, and **no change to
  evidence validation** — `evidenceIsReadable` is described by this change, not
  modified by it. The wire shape is unchanged; only the value of `ready` and the
  presentation move.
- Fixtures and tests asserting the current permanent-`false` verdict will need
  updating, and that update is the visible proof the watermark is gone.
