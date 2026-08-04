## 1. Pin the escape with failing tests

- [x] 1.1 Add `isAnchoredUnder` unit tests in `packages/agent/src/lib/paths.test.ts`: equal paths, a path under the root, a sibling whose name shares the root's prefix (`/a/rootster` vs `/a/root`), and a path outside. Run RED — the function does not exist yet.
- [x] 1.2 Add a `resolveAllowed` test building a temp fixture where `<project>/.claude` is a symlink to a directory outside the project, asserting `PathViolation`. Confirm RED with the current code returning the outside path (this is the repro from the proposal).
- [x] 1.3 Add the two control tests that must stay green throughout: an ordinary `.claude` directory resolves, and a symlink *under* `.claude` pointing within the project still resolves.
- [x] 1.4 Add a `routes/read.ts` test asserting a read through an escaping `.claude` returns the daemon's existing out-of-allow-list refusal, and that the file's content appears nowhere in the response body. Confirm RED.
- [x] 1.5 Add a `routes/open.ts` test asserting the same request is refused and no path under the symlink target reaches the spawned-editor boundary. Confirm RED.

## 2. Anchor the async resolver

- [x] 2.1 Add `isAnchoredUnder(realBoundary, realRoot)` to `paths.ts` — the pure `=== root || startsWith(root + sep)` predicate from D4, exported for reuse and testing.
- [x] 2.2 In `resolveAllowed`, realpath `projectRoot` once and drop any allow-listed root not anchored under it before the containment check; raise the existing `PathViolation` when no root survives. Turn 1.2, 1.4 and 1.5 GREEN with 1.3 still green.
- [x] 2.3 Add optional `anchorTo?: string` to `ResolveAllowedNamedOpts`; when present, filter `roots` to those anchored under `realpath(anchorTo)` and raise `PathViolation` if none remain. Absent `anchorTo` keeps today's behaviour exactly.
- [x] 2.4 Add a `resolveAllowedNamed` test covering `anchorTo`: an escaping root is dropped, a legitimate one is kept, and the no-surviving-root case raises.

## 3. Anchor the sync resolver

- [x] 3.1 Import `isAnchoredUnder` into `coverageResolver.ts` and use it for the existing root-prefix comparison, so both resolvers share one predicate.
- [x] 3.2 Add `anchorTo?: string` to the `PathResolver` type and apply the filter to caller-supplied roots in `makeCoverageResolver`. **Amended during implementation (design D7):** an anchored call must also not fall back to the family roots, or the anchor is defeated whenever one root survives and the target sits under a family root — true of every repo in the fleet. Unanchored calls keep the allowance untouched.
- [x] 3.3 Add `coverageResolver` tests mirroring 2.4, pinning both halves of D7: an anchored call does not reach the family roots, and an unanchored call still does.

## 4. Sweep the five derived-root call sites

Each: write the escaping-symlink fixture test first and confirm RED, then pass `anchorTo`.

- [x] 4.1 `projectMetadataScan.ts:281` — `parseCiWorkflowsForSentry`, anchor `<root>/.github/workflows` to `projectRoot`.
- [x] 4.2 `workflowVersionScanner.ts:158` — anchor `skillRoot` to `repoAbsPath`. Test must assert the case from the proposal: with `roots: [skillRoot, repoAbsPath]`, an escaping `skillRoot` no longer admits its target even though `repoAbsPath` is also listed.
- [x] 4.3 `workflowFleetScanner.ts:286` — anchor `skillRoot` to the host repo root.
- [x] 4.4 `workflowFleetScanner.ts:296` — anchor `skillDir` to the host repo root, not merely to `skillRoot`, so a two-hop escape is caught.
- [x] 4.5 `workflowArtifactScanner.ts:414` — **REFUTED, not fixed.** `canonicalRoot` derives from a machine root (`~/.claude/skills`, `~/.codex/skills`), which the daemon names directly; there is no registered repository above it to anchor to. Symlinking skills into those directories is the intended install mechanism — 13 of 14 entries under `~/.codex/skills` and 33 of 98 under `~/.claude/skills` are symlinks into `~/Sourcecode`. Anchoring would report all of them missing. See design D8.
- [x] 4.6 Confirm each scanner degrades per-repository on refusal rather than throwing out of the scan, using the degradation path each already has.

## 5. Verify

- [x] 5.1 Re-run the standalone repro from the proposal against the fixed code and confirm it now refuses; keep it out of the repo (scratchpad only). → `[REFUSED] PathViolation path outside allowed directories`, control still resolves.
- [x] 5.2 Prove the new tests can fail: revert the `paths.ts` fix, confirm RED, restore. → 13 RED with the fix stashed (5 predicate, 2 `resolveAllowed`, 3 `anchorTo`, 1 open route, 2 read route); all green restored. Each group-4 test was also shown RED individually before its own fix, and the sync-resolver test was proven RED by stashing `coverageResolver.ts`.
- [x] 5.3 `pnpm --filter @agenticapps/dashboard-agent test` — 1769/1773 with **two known-flaky tests excluded**, see the note below.
- [x] 5.4 `pnpm -r typecheck` green (all six packages) and `pnpm lint` 0 errors / 222 pre-existing warnings, none in the files this change touches.
- [x] 5.5 `openspec validate --all` green — 19/19.
- [x] 5.6 Confirmed no SPA or shared-schema change: `git diff` touches `packages/agent` only.

**On 5.3's two failures.** `changeReader.test.ts > the per-source bound` (both
cases) time out at ~5.2s against a 5000ms budget under full-suite parallel load.
Attributed before being dismissed, not assumed:

- `changeReader.ts` imports only `@agenticapps/dashboard-shared` and `./stage.js`.
  There is no import path from it to `paths.ts` or `coverageResolver.ts`, so this
  change cannot affect it at runtime.
- Stashing only the new *tests* (keeping the production fix) still failed.
- Stashing the production fix as well — a fully clean tree — **also failed**, at
  5297ms. An earlier clean run had passed, which is what made this look like a
  regression at first.

So it is a pre-existing, load-sensitive flake on `main`, in the same family as
the bounds work already carried as an open question. Raising the timeout would
be a fix to someone else's test inside a security change, so it is reported here
rather than done. In isolation both files are 100/100 green.

## 6. Review

- [x] 6.1 **Plan review skipped by explicit user decision.** Offered before implementation began — run `run-plan-review.sh` first, or go straight to apply — and apply was chosen. Recorded here rather than left as an unticked box, because the gate reports reviewers without enforcing them and a skipped review is otherwise invisible. Not yet run at any point in this change.
- [x] 6.2 No `impeccable:critique` run: this change touches no frontend route (`git diff` is `packages/agent` only), so there is no rendered surface to critique. The design floor waiver carried in the hand-off is unaffected.
- [x] 6.3 Address or explicitly refute any REQUEST-CHANGES finding before archiving.

**Round 1 — gemini, codex, opencode, all REQUEST-CHANGES.** Every finding was
verified against the artifacts or the code before being acted on. Dispositions:

*Fixed in code:*
- **Anchor verification did not fail closed in the sync resolver** (codex). Real:
  `realpathSafe` fell back to a lexical `pathResolve`, so the anchor was compared
  against a path nobody had verified, while `resolveAllowedNamed` threw. Now
  throws in both. Partly refuted too — no case was found where the lexical
  fallback actually *admits* a read, because an unresolvable anchor implies an
  unresolvable candidate, which fails first. Fixed as a contract inconsistency,
  and the test says so rather than claiming an escape.
- **`isAnchoredUnder`'s precondition was unstated** (opencode). Its contract now
  says both arguments must be canonical realpaths, why `+ sep` is only sound on
  one, and what case-insensitive volumes mean for it.

*Fixed in the spec delta:*
- **D7 was not normative** (gemini, codex). "Anchoring narrows, and SHALL NOT be
  widened by ambient authority" is now in the requirement body, with a scenario
  pinning that a standing scanner root does not rescue an anchored read.
- **"Registered" excluded discovered repositories** (codex). The requirement now
  defines repository root as any the daemon reads under, registry or discovered.
- **"Contributes nothing" contradicted the degradation behaviour** (codex,
  opencode). It now withholds what was *read through the escaped boundary* and
  explicitly allows a degraded record, which is what the scanners emit. The
  inherited first scenario is scoped to match, resolving its apparent conflict
  with the per-path scenario.
- **No scenario covered an unverifiable root** (codex). Added.

*Fixed in proposal/design:*
- **Site counts were stale after D8** (opencode, codex). Eight places said five or
  six; it is `resolveAllowed` plus four scanners. Reconciled throughout.
- **Impact contradicted D7** (opencode). Cross-family reads survive for
  *unanchored* readers only — now stated, with the warning that anchoring such a
  site later would silently cost it that reach.
- **Sweep completeness was asserted, not evidenced** (opencode). D6a records the
  grep and classification used, and its two limits.
- **TOCTOU was silent** (opencode). Now stated as residual, with the existing
  `O_NOFOLLOW` + re-`realpath` mitigations named.

*Not done, recorded instead:*
- **Make `anchorTo` required / distinguish machine roots in the type system**
  (gemini, echoed by all three). Agreed on merit and promoted from a passing note
  to the named next change in this area. Not done here: it touches ~30 correct
  call sites and would bury the four that matter in an unreviewable security diff.
- **Reverse symlink direction** (opencode, minor). Already governed by the
  existing scenarios; recorded as an open question to confirm rather than a new
  rule. *(Round 2: gemini asked for it explicitly, so it is now a scenario.)*

**Round 2 — gemini and codex REQUEST-CHANGES; opencode timed out at 540s and was
not counted.** Round 2 earned its keep: it found a real hole round 1 missed.

*Fixed in code:*
- **A `skills/` root symlinked into a sibling repository was enumerated**
  (codex). Confirmed and reproduced: `workflowFleetScanner` resolved that root
  *unanchored*, so the family roots admitted it, and `readdirSync` then put the
  sibling repository's entry names into this repository's output as skill ids.
  Round 1's tests missed it because they symlinked a directory *under* `skills/`,
  never `skills/` itself. Anchoring the child reads was too late. Now anchored
  before the enumeration; RED proven first.
- **`.github/workflows` was listed before its anchor was checked** (codex). Same
  shape, and the round-1 test genuinely did not prove otherwise — it asserted an
  empty result, which was true both when the directory was refused and when it
  was read and its files rejected one by one. The anchor now precedes the
  `readdir`, and `projectMetadataScan.anchor.test.ts` spies on `readdir` to
  assert the escaped directory is never passed to it. Names are content.
- **Unresolvable derived roots were still compared lexically** (codex). The
  round-1 fix covered the anchor but not the roots, which contradicted the
  precondition I had just documented on `isAnchoredUnder`. Anchored calls now
  drop roots that cannot be realpath'd; unanchored calls keep the old fallback.

*Fixed in the spec delta:*
- Scenarios added for an unverifiable *derived boundary* (codex), for verifying a
  boundary **before** listing the directory beneath it (codex), and for a
  boundary symlinked into another repository the reader may otherwise read
  (gemini's reverse-symlink case).

*Fixed in design:*
- **D6a's enumeration method was unsound** (codex). Classifying by what a call's
  `roots:` contains misses a resolver's *return value* later becoming a boundary
  — exactly how the `skills/` site was missed. D6a now records the corrected
  two-pass method and the site it found. Counts reconciled again: six fixed
  sites, `resolveAllowed` plus five scanner boundaries.

*Refuted, with reasoning:*
- **"Resolvers should apply the post-open `realpath` check universally"**
  (gemini). They cannot: the resolvers return a path and never open a file, so
  they have no fd to re-verify. The check belongs to whoever opens, which is why
  it lives in `routes/read.ts` alongside `O_NOFOLLOW`. Moving it into the
  resolvers would mean inventing a resolver that opens files — a larger design
  change than this one, and a worse layering.
- **"Make `anchorTo` required"** (gemini, again). Same answer as round 1, and the
  same agreement on merit: it is the named next change, deliberately not this
  one. Round 2 does strengthen the argument — the missed `skills/` site is
  precisely the "a new call site forgets" failure gemini predicts, though note it
  was an *existing* site rather than a new one, so a required field would have
  caught it only by forcing every site to be revisited.
