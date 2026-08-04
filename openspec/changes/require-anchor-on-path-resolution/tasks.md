## 1. Establish the baseline before changing anything

- [ ] 1.1 Record the current admission behaviour of the two resolvers as a
  characterisation test that passes on `main` unmodified: for each of the three
  shapes in design's survey table, one admitted path and one refused path. This
  is what "runtime admission is unchanged" is checked against later — without it,
  the claim is unfalsifiable.
- [ ] 1.2 Confirm the survey counts on the current `main` (`dcc5d13`): 28
  non-test `resolveAllowedNamed` sites, 6 already anchored. Record any drift
  from design's table before relying on it.

## 2. Make the field required and let the compiler enumerate

- [ ] 2.1 Replace `anchorTo?: string` with the required `containment` union on
  `ResolveAllowedNamedOpts` (`paths.ts`) and on `PathResolver`'s options
  (`coverageResolver.ts`). Do not touch any call site yet.
- [ ] 2.2 Run `pnpm --filter @agenticapps/dashboard-agent typecheck` and capture
  the **complete** list of error locations. This list — not the grep from design
  — is the authoritative site enumeration (D3.3).
- [ ] 2.3 Diff that list against design's survey table. Any site the grep missed
  is the single most important finding this change can produce: record it in §5
  by name, with what its `roots:` is built from and why the grep did not see it.
  If the lists agree exactly, record that too — a corroborated grep is a result,
  not a non-event.

## 3. Classify, in three separate commits (D3.1)

- [ ] 3.1 Confirm the `daemon-named` split against the code before applying it:
  `makeCoverageResolver`'s bound family roots are the resolver's own and are
  **not** what `daemon-named` classifies; caller-supplied machine roots
  (`workflowArtifactScanner`'s `~/.claude/skills`, `~/.codex/skills`) are.
  Design D4 asserts this — verify it rather than inherit it.
- [ ] 3.2 **Commit 1 — spelling only.** The type change plus the six already
  anchored sites in `workflowFleetScanner.ts`, `workflowVersionScanner.ts` and
  `projectMetadataScan.ts` restated as `{ kind: 'anchored', root }`. Semantics
  must be unchanged; tests from §1.1 must pass untouched.
- [ ] 3.3 **Commit 2 — the behavioural one.** The ~22 `roots: [projectRoot]`
  sites as `{ kind: 'repository-root' }`. This is the only commit where D2's
  fallback removal takes effect. Gate it on 4.4 having been done first.
- [ ] 3.4 **Commit 3 — the reasons.** `daemon-named` sites, each with a reason
  written from D8's actual evidence (33 of 98 and 13 of 14 entries under the
  skills roots are install symlinks), not a restatement of the classification.

## 4. Prove the parts that are inherited rather than established

- [ ] 4.1 RED first for the type-level requirement: a resolution site written
  without a `containment` declaration fails to compile. Prove it fails before
  the field is required, per the project's standing rule that a new test must be
  shown capable of failing.
- [ ] 4.2 A derived boundary declared as `repository-root` or `daemon-named` is
  still governed by the anchoring requirement — the misdeclaration scenario. Assert
  behaviour, not just types.
- [ ] 4.3 A `daemon-named` site resolves a machine root that anchoring would
  reject, confirming D8's install-symlink case still works after the change.
- [ ] 4.4 **D2's fallback removal.** Construct a root that cannot be realpath'd
  and assert the refusal is identical before and after conversion. Design D2
  argues the lexical fallback is unreachable in the admitting direction because
  an unresolvable root implies an unresolvable candidate — that argument is
  inherited from a round-1 finding on the sync resolver and is second-hand until
  this test re-proves it on the async one. **If the test shows a reachable
  difference, D2 is wrong**: `repository-root` must then preserve the unanchored
  fallback verbatim, and 3.3 changes shape.

## 5. Findings recorded during execution

<!-- 2.3's enumeration diff goes here. Any site whose classification departs from
     design's survey table is named here with its reasoning (D3.2) rather than
     folded into the mechanical pass. Leave the reasoning even if nothing
     departs — "the compiler and the grep agreed" is the finding in that case. -->

## 6. Verification

- [ ] 6.1 `pnpm --filter @agenticapps/dashboard-agent test` green; §1.1's
  characterisation tests still passing and **unmodified** — if they needed
  editing, admission changed and §5 must say where.
- [ ] 6.2 `pnpm -r typecheck` and `pnpm lint` green (CI enforces lint; the gate
  does not).
- [ ] 6.3 `openspec validate --all` green.
- [ ] 6.4 No `impeccable:critique` run required — this change touches no
  frontend route. Confirm `git diff --stat` is `packages/agent` only before
  claiming that.

## 7. Review

- [ ] 7.1 Run the plan review **before** code, using the shared producer
  `~/.agenticapps/bin/run-plan-review.sh` (1.2.0) with
  `--implementing-host claude` and `REVIEW_TIMEOUT=540` — the prior change lost
  opencode to a 540s timeout in round 2, and round 2 was the round that found a
  real escape. Skipping this is a decision to record, not a step to forget.
- [ ] 7.2 Address or explicitly refute every REQUEST-CHANGES finding before
  archiving, with the disposition written here. Verify each finding against the
  code before acting on it — the prior change refuted several on merit.
- [ ] 7.3 Preserve prior rounds as `REVIEWS-round-N.md` before re-running.
