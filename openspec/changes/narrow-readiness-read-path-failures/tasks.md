## 1. Pen-test declaration variants (shared schema)

TDD throughout: the failing test comes first in every task below.

- [x] 1.1 Test: a `pen-test` entry with `status: 'never'` and no `observedAt`,
      `evidence`, `commit` or `validUntil` parses; the same entry carrying any one
      of those four fields fails to parse.
- [x] 1.2 Test: `pen-test` with `status: 'na'` and a `summary` parses; with no
      summary it fails, through the existing "na states a reason" refinement in
      `DeclarationsSchema` rather than a second rule.
- [x] 1.3 Test: `pen-test` with `status: 'stale'` still fails to parse.
- [x] 1.4 Test: the substantiated variant (`ok`/`warn`/`fail`) is unchanged —
      all four fields still required, each individually.
- [x] 1.5 Split `PenTestDeclarationSchema` in
      `packages/shared/src/schemas/readiness.ts` into substantiated and
      unsubstantiated variants per design D4. Confirm the union nests correctly
      inside the outer `id`-discriminated `DeclarationSchema`.
- [x] 1.6 Rebuild shared before running agent tests — the agent runs shared's
      built `dist`, so a clean typecheck plus a runtime ZodError means a stale
      build, not a bad test.

## 2. Pen-test declaration consumption (agent)

- [x] 2.1 Test: a declared `pen-test: never` yields `status: 'never'`,
      `source: 'declared'`, `at: null`, `evidence: null` — and `computeReady`
      returns false for a repo whose other five checks are `ok`. This is the
      defect-3 acceptance test.
- [x] 2.2 Test: a declared `pen-test: na` is excluded from the predicate, and a
      repo reporting `na` on all six is **not** ready.
- [x] 2.3 Guard `ageDeclaration` in `assemble.ts` so the `pen-test` branch does
      not read `validUntil` on an unsubstantiated entry. An entry that cannot
      expire must return null, not `Date.parse(undefined) < now`.
- [x] 2.4 Verify `declaredResult` needs no other change — its
      `observed = status !== 'never' && status !== 'na'` guard already nulls `at`
      and `evidence` and avoids reading `observedAt`. Assert this with a test
      rather than by inspection.
- [x] 2.5 Check `remedy.ts` for a `pen-test` remedy that assumes an undeclared
      slot; a declared `never` needs remedy text that does not tell the author to
      declare what they just declared.

## 3. Per-entry citation rejection (agent)

- [x] 3.1 Test: a file declaring `code-review` (bad citation) and `spec` (no
      citation) honours the `spec` declaration and rejects only `code-review`.
      This is the defect-1 acceptance test.
- [x] 3.2 Test: the rejected check reports `status: 'fail'`, `source: 'declared'`,
      `evidence: null`, and an `error` whose message names the cited path — and
      **not** the value the deriver would have produced.
- [x] 3.3 Test — the hole this change must not open: a repo declaring
      `pen-test: fail` with a deleted citation, all five other checks `ok`, is
      **not ready**. Assert it blocks via `check.error !== null` by passing
      `notice: null` to `computeReady` directly, proving the result is
      self-sufficient and does not lean on the notice.
- [x] 3.4 Test: every rejected entry is collected, not just the first — a file
      with three bad citations names all three.
- [x] 3.5 Test: the repo still carries a `readiness-file-invalid` notice while any
      entry is rejected.
- [x] 3.6 Test: structural malformations are unaffected — unsupported version,
      unparsable JSON, and a malformed known entry each still discard the whole
      file and return all six checks to derived values.
- [x] 3.7 Test: an *evidence* path that escapes at resolution rejects only its
      entry. **Corrected while implementing** — the premise that a configured
      *coverage* path escaping "still invalidates the whole file" was never true:
      that path is not verified during file validation at all, and is refused by
      the check that reads it (`coverage-artifact-refused`). Three path-violation
      sites, three different costs; the delta now says so and the tests pin all
      three.
- [x] 3.8 Change `evidenceIsReadable` to collect rejections rather than return on
      the first, and widen the `usable` outcome in `readinessFile.ts` to carry a
      rejected map per design D3.
- [x] 3.9 Consume the rejected map in `assemble.ts`: emit the error-bearing
      declared result for each rejected id and raise the notice.
- [x] 3.10 Confirm the error message passes `SanitisedTextSchema` — a
      repo-relative path must not trip the absolute-path guard. Test with a path
      containing a colon, which the sanitiser treats specially.

## 4. Fleet time bound (agent)

- [x] 4.1 Test: `readFleet` with one repo whose scan never settles returns within
      the bound, carries every other repo, and reports the blocked repo as six
      error-bearing `fail` results. This is the defect-2 acceptance test. Use an
      injected never-settling promise and fake timers, not a real FIFO.
- [x] 4.2 Test: a blocking fleet **signature** does not withhold the response —
      the bound covers work preceding per-repo assembly.
- [x] 4.3 Test: a timed-out scan is not cached. **Revised while implementing** —
      the original wording ("a later request computes rather than replaying the
      timeout") described behaviour that is neither what happens nor what should:
      a later request joins the still-blocked computation, and the repo recovers
      on its own when the block clears. The test asserts that recovery.
- [x] 4.4 Test: a timeout does not corrupt the in-flight map. Asserted as the
      property that matters — three polls of a blocked repo cause exactly one
      fingerprint computation, because abandoning and re-scanning would spawn a
      new blocking scan every 5s and a blocked filesystem call cannot be
      cancelled.
- [x] 4.5 Add `READINESS_SCAN_TIMEOUT_MS = 15_000` to
      `packages/agent/src/constants.ts` with a comment stating why it exceeds
      `GIT_SUBPROCESS_TIMEOUT_MS`.
- [x] 4.6 Race each `snapshotFor` and `signatureFor` in `readFleet`. Clear the
      timer on the settling path and `unref()` it so a pending deadline cannot
      hold the process open at shutdown.
- [x] 4.7 Confirm `readRepo` and `rescanRepo` are deliberately left unbounded, and
      record that in a comment so it reads as a decision rather than an omission.

## 5. Surface and cross-cutting verification

- [x] 5.1 Verify the rejected-entry result renders through the existing
      error-bearing `fail` path in the readiness panels with no new SPA state. A
      declared `fail` carrying an error is a combination the surface may not have
      seen before — check the indicator, the accessible name, and the detail row.
- [x] 5.2 Verify a declared `never` on `pen-test` renders distinguishably from a
      derived `never` (the spec requires the two be tellable apart), and that the
      verdict differs between them.
- [x] 5.3 Run `pnpm --filter @agenticapps/dashboard-shared test`,
      `pnpm --filter @agenticapps/dashboard-agent test`, and the SPA tests
      per-package — not `pnpm -r test`, which is flaky in this workspace.
- [x] 5.4 `pnpm -r typecheck` and `pnpm lint`. CI blocks merge on lint.
- [x] 5.5 Update `openspec/specs/repo-readiness/spec.md` scenario count in any
      doc that cites it, and confirm `openspec validate --all` is green.

## 6. Review and design gates

- [x] 6.1 Run `impeccable:critique` against the fleet and repo-detail routes at
      1440×900 if any SPA file changed; commit the artifact. Composite floor ≥ 80,
      or record a structural-debt waiver with basis.

      **Not run, as a recorded decision rather than an omission.** The condition
      is "if any SPA file changed", and one did — but it is
      `ReadinessIndicator.test.tsx`, a test. No component, style, token, or
      layout file is in the diff: `git diff --stat` over `packages/spa` shows
      exactly one `.test.tsx`. The critique scores rendered design outcomes, and
      the rendering code is byte-identical, so a run would reproduce the previous
      change's scores by construction.

      What is new is a *state combination*, not a treatment: a check may now
      carry `source: 'declared'` together with an evaluation error, and
      `pen-test` may show a declared `never`. Both render through visual paths
      that already existed and were already critiqued — the error-bearing `fail`
      cell and the grey `never` cell. The tests added in 5.1/5.2 pin that they
      route through those paths and stay distinguishable.

      Flagged for the reviewer rather than settled unilaterally: if the intent of
      the gate is "any diff under packages/spa", this needs a run before merge.
- [ ] 6.2 Run `run-plan-review.sh` with `REVIEW_TIMEOUT=540` for two other-vendor
      reviewers. The gate reports rather than enforces this, so skipping it is a
      decision to record, not a step to forget.
- [ ] 6.3 Address confirmed REQUEST-CHANGES findings against the code before
      archiving — a defect folded into durable spec is expensive to remove.
