## 1. Red — pin the defect before touching it

- [x] 1.1 Add a schema-level table test in `packages/shared` over `SanitisedTextSchema`: the three legal citations (`docs/notes:/Users/x.md`, `assets/img:/Library/a.png`, `deep/nested/dir:/tmp/f`) must be accepted. Expect RED — all three are refused today.
- [x] 1.2 In the same table, pin the full refusal matrix — `resolved to:/Users/donald/secret`, `failed at:/home/x/y`, `read /Users/donald/x failed`, `of "/var/db/x"`, `C:/Users/x is bad`, `scan at:/Volumes/ext/p`, UNC `\\server\share` — and the benign cases `GET:/api/v2/fleet returned 500` and `ratio 3:/4`. Expect GREEN now and after; this is the anti-regression half and MUST NOT be weakened later to make 1.1 pass.
- [x] 1.3 Add an agent test: a repo whose readiness file cites `docs/notes:/Users/x.md` assembles a snapshot that parses against `RepoDetailResponseSchema`, and whose refused check's `error.message` names the path. Expect RED — the path is stripped by `wireSafeReason` today.
- [x] 1.4 Add a route test asserting `GET /api/v2/readiness/fleet` returns **200** with such a repo registered, and that every other registered repo is still present in the body. Expect RED — 500 `schema_drift` today.
- [x] 1.5 Add the residual-case agent test: a repo citing `ab:/Users/x.md` parses, its `error.message` names no path, and its `summary` still carries the full path. Expect RED (currently 500 at the notice site).
- [x] 1.6 Record the four RED failures — command and output — before writing any implementation.

## 2. Green — the shared boundary

- [x] 2.1 Narrow clause 3 of `ABSOLUTE_PATH` so it is anchored at a strong boundary and the token holding the colon may not contain a forward slash — the exact form is in `design.md` § Decisions 1. Leave clauses 1, 2 and 4 untouched.
- [x] 2.2 Export `carriesAbsolutePath(text: string): boolean` from the same module and redefine `SanitisedTextSchema` to refine on `!carriesAbsolutePath(v)`, so the predicate and the boundary cannot drift.
- [x] 2.3 Export `wireSafeText(text: string, fallback: string): string` returning `text` unless it carries an absolute path.
- [x] 2.4 Rewrite the block comment: replace the residual-risk sentence ("no message this daemon constructs interpolates anything but a repo-relative path") with the true bound — a colon in the first path segment is indistinguishable from a leak and fails closed — and point callers at `wireSafeText`. Name the structural-`path`-field change as the fix that would remove the residual.
- [x] 2.5 Confirm 1.1 and 1.2 are both GREEN. Rebuild `packages/shared` before running agent tests — the agent runs the built `dist`, so a stale build reads as a phantom failure.

## 3. Green — the two author-input sites

- [x] 3.1 Route `citationNotice`'s message through `wireSafeText`, with a fallback naming the readiness file and the rejected count but no path. This is the unguarded site and the one that returns 500.
- [x] 3.2 Delete `wireSafeReason` from `assemble.ts`; have `refusedResult` build the full reason including the path and pass it through `wireSafeText`.
- [x] 3.3 Correct the `RejectedCitation.reason` doc comment — "Safe to put on the wire" is the defect stated as an invariant.
- [x] 3.4 Confirm 1.3, 1.4 and 1.5 are GREEN, and that `summary` still carries the full path in every case.

## 4. Verify

- [x] 4.1 `pnpm --filter @agenticapps/dashboard-shared test` — full pass, no skips.
- [x] 4.2 `pnpm --filter @agenticapps/dashboard-agent test` — full pass; confirm no pre-existing readiness test regressed, especially those asserting paths are kept off the wire.
- [x] 4.3 `pnpm -r typecheck` and `pnpm lint` — lint blocks merge in CI and no gate here runs it for us.
- [x] 4.4 `openspec validate --all` green.
- [x] 4.5 End-to-end check through the real assembler and the real wire schema, added as `service.test.ts` → "answers the whole fleet when one repo cites a colon-bearing evidence path". Preferred over a manual daemon boot because the route test mocks the service, so nothing else proves the *real* service's output passes the *real* outbound validation. Confirmed RED against the pre-change regex before being accepted.

## 5. Review and ship

- [x] 5.1 `impeccable:critique` does not apply and was not run. Verified, not assumed: `git diff --name-only` touches nine files, none under `packages/spa`, and no wire field was added, removed or retyped — the SPA renders `error.message`, `summary` and `notice.message` exactly as before, only with better content in them.
- [x] 5.2 Run `run-plan-review.sh` with `REVIEW_TIMEOUT=540` and record the verdicts. Nothing enforces this; skipping it is a decision to record, not a step to forget.
- [x] 5.3 Answer each REQUEST-CHANGES finding against the code before archiving — verify it, then fix it or record why it was refuted.
- [x] 5.4 PR #96 opened to `main` from `fix/readiness-sanitiser-colon-hazard`. Archive the change once merged.

## 6. Record

- [x] 6.1 **The RED evidence.** Six tests written first, all failing: three in
  `shared` (legal colon-bearing citations refused) and three in `agent`. The
  route test failed with `AssertionError: expected 500 to be 200` and the daemon
  logged `schema_drift` — the outage reproduced exactly, not inferred.
- [x] 6.2 **One pre-existing test was reversed, deliberately.** `assemble.test.ts`
  → "produces a refusal message the outbound sanitiser accepts" asserted
  `error.message` did **not** contain the path. That assertion encoded the
  workaround, not a requirement, and the delta states the opposite. It now
  asserts the path is present. No other existing test changed.
- [x] 6.3 **`start.subprocess.test.ts` failed once under the parallel run and
  passed in isolation and on every later full run.** A boot-timing flake,
  unrelated to this change — recorded rather than silently re-run.
- [x] 6.4 **The two layers were verified independently.** Reverting only the
  regex, with `wireSafeText` left in place, turned the end-to-end test from a
  500 into a *degraded but valid* response — the path missing from the notice,
  the fleet still answered. Fail-soft prevents the outage; the narrowing
  restores the information. Neither was assumed to be doing the other's job.

## 7. Reviewer disposition

Three reviewers counted: **gemini APPROVE**, **codex REQUEST-CHANGES** (6),
**opencode REQUEST-CHANGES** (5). `claude` excluded as the implementing host.
Every finding was checked against the code before being acted on.

**Confirmed and fixed — two of them falsified this change's own guarantee.**

- [x] 7.1 **codex: `wireSafeText` certified the path rule, not the field.** A
  512-character citation renders a 622-character notice against a 600-character
  maximum — *no colon required* — and the response died on length exactly as it
  had on shape. Measured, not argued. `wireSafeText` now certifies against
  `SanitisedTextSchema` itself, which is the only bound that cannot drift from
  what the boundary enforces. Pinned by "survives a citation at the path length
  limit, which carries no colon at all", verified RED against the old helper.
- [x] 7.2 **codex: "exactly two author-input sites" was false.**
  `coverage.path` is author input and reaches five `readArtifact` error
  messages. Guarded at `failure()`, the single point where they become wire
  text. Pinned and verified RED against the unguarded version.
- [x] 7.3 **codex + opencode: "the complete reference SHALL remain" was false.**
  `summary` clamps at 600, so a maximal citation truncates there too. The
  requirement now says the summary retains it *so far as its length bound
  permits*, and states that the guarantee is that the response survives.
- [x] 7.4 **opencode: the notice is not a check and has no summary sibling.**
  "On the same result" was undefined for a repo-level notice. The text now says
  the reference it withholds remains on the result of the check that declared it.
- [x] 7.5 **codex: the survival obligation contradicted its own exception.**
  The first-segment case is now stated in the normative paragraph rather than
  implied by a following sentence.
- [x] 7.6 **opencode: the residual was understated.** Corrected in the code
  comment: a leak later in a whitespace-delimited token that already contains a
  `/` is no longer caught — `docs/x.md,next:/home/b` and `a/b;c:/Users/x` both
  regressed. "Token" is spelled out, since commas and semicolons do not break it.
- [x] 7.7 **opencode: reduction vs substitution read as one mechanism.** They are
  now distinguished in the requirement: reduction rewrites a known absolute path
  to a repo-relative one; substitution replaces text that cannot be certified.
- [x] 7.8 **codex: secret precedence was unspecified.** The credential-material
  prohibition is now stated to take precedence over the survival obligation, on
  any field, restricted or not.

**Refuted, with the check that refuted them.**

- [x] 7.9 **opencode: shared `lastIndex` makes the predicate non-deterministic.**
  Only true of a `/g` regex. `ABSOLUTE_PATH` is built with no flags, so `.test`
  is stateless. No change.
- [x] 7.10 **opencode's worked example was wrong**, though its point was not.
  `…to:/Users/a,next:/home/b` is *still refused* — the first path sits after a
  space and is caught by the strong-boundary clause. The regression needs a
  slash inside the token, which is why 7.6 restates the residual instead.
- [x] 7.11 **codex: the narrowing "contradicts the unchanged MUST".** Partly
  accepted, partly refuted. The detector was always a heuristic — `/mycustomroot/x`
  was never caught, and the pre-existing comment said so — so this is not a newly
  introduced class of violation. The weakening is real and is now stated
  precisely under 7.6 rather than described as a comment-level acknowledgement.

- [x] 7.12 **Two fixture defects found while verifying, both mine.** The first
  coverage test asserted only schema validity and passed with the guard removed —
  the path did not exist, so `readArtifact` returned `absent` and the message
  under test was never built. The second used `coverage/out:` , which the
  narrowed regex accepts outright. Both were rewritten until they failed without
  the fix. A reviewer finding that survives verification is worth more than a
  test that never went red.
