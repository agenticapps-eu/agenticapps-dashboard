## 1. Red — pin the defect before touching it

- [ ] 1.1 Add a schema-level table test in `packages/shared` over `SanitisedTextSchema`: the three legal citations (`docs/notes:/Users/x.md`, `assets/img:/Library/a.png`, `deep/nested/dir:/tmp/f`) must be accepted. Expect RED — all three are refused today.
- [ ] 1.2 In the same table, pin the full refusal matrix — `resolved to:/Users/donald/secret`, `failed at:/home/x/y`, `read /Users/donald/x failed`, `of "/var/db/x"`, `C:/Users/x is bad`, `scan at:/Volumes/ext/p`, UNC `\\server\share` — and the benign cases `GET:/api/v2/fleet returned 500` and `ratio 3:/4`. Expect GREEN now and after; this is the anti-regression half and MUST NOT be weakened later to make 1.1 pass.
- [ ] 1.3 Add an agent test: a repo whose readiness file cites `docs/notes:/Users/x.md` assembles a snapshot that parses against `RepoDetailResponseSchema`, and whose refused check's `error.message` names the path. Expect RED — the path is stripped by `wireSafeReason` today.
- [ ] 1.4 Add a route test asserting `GET /api/v2/readiness/fleet` returns **200** with such a repo registered, and that every other registered repo is still present in the body. Expect RED — 500 `schema_drift` today.
- [ ] 1.5 Add the residual-case agent test: a repo citing `ab:/Users/x.md` parses, its `error.message` names no path, and its `summary` still carries the full path. Expect RED (currently 500 at the notice site).
- [ ] 1.6 Record the four RED failures — command and output — before writing any implementation.

## 2. Green — the shared boundary

- [ ] 2.1 Narrow clause 3 of `ABSOLUTE_PATH` so it is anchored at a strong boundary and the token holding the colon may not contain a forward slash — the exact form is in `design.md` § Decisions 1. Leave clauses 1, 2 and 4 untouched.
- [ ] 2.2 Export `carriesAbsolutePath(text: string): boolean` from the same module and redefine `SanitisedTextSchema` to refine on `!carriesAbsolutePath(v)`, so the predicate and the boundary cannot drift.
- [ ] 2.3 Export `wireSafeText(text: string, fallback: string): string` returning `text` unless it carries an absolute path.
- [ ] 2.4 Rewrite the block comment: replace the residual-risk sentence ("no message this daemon constructs interpolates anything but a repo-relative path") with the true bound — a colon in the first path segment is indistinguishable from a leak and fails closed — and point callers at `wireSafeText`. Name the structural-`path`-field change as the fix that would remove the residual.
- [ ] 2.5 Confirm 1.1 and 1.2 are both GREEN. Rebuild `packages/shared` before running agent tests — the agent runs the built `dist`, so a stale build reads as a phantom failure.

## 3. Green — the two author-input sites

- [ ] 3.1 Route `citationNotice`'s message through `wireSafeText`, with a fallback naming the readiness file and the rejected count but no path. This is the unguarded site and the one that returns 500.
- [ ] 3.2 Delete `wireSafeReason` from `assemble.ts`; have `refusedResult` build the full reason including the path and pass it through `wireSafeText`.
- [ ] 3.3 Correct the `RejectedCitation.reason` doc comment — "Safe to put on the wire" is the defect stated as an invariant.
- [ ] 3.4 Confirm 1.3, 1.4 and 1.5 are GREEN, and that `summary` still carries the full path in every case.

## 4. Verify

- [ ] 4.1 `pnpm --filter @agenticapps/dashboard-shared test` — full pass, no skips.
- [ ] 4.2 `pnpm --filter @agenticapps/dashboard-agent test` — full pass; confirm no pre-existing readiness test regressed, especially those asserting paths are kept off the wire.
- [ ] 4.3 `pnpm -r typecheck` and `pnpm lint` — lint blocks merge in CI and no gate here runs it for us.
- [ ] 4.4 `openspec validate --all` green.
- [ ] 4.5 Manual check against a scratch repo citing a colon path: fleet answers 200, the detail panel shows the path, and no `schema_drift` line appears in the daemon log.

## 5. Review and ship

- [ ] 5.1 Record in this file that `impeccable:critique` does not apply — no file under `packages/spa` is touched and no rendered surface changes. If that stops being true, run it.
- [ ] 5.2 Run `run-plan-review.sh` with `REVIEW_TIMEOUT=540` and record the verdicts. Nothing enforces this; skipping it is a decision to record, not a step to forget.
- [ ] 5.3 Answer each REQUEST-CHANGES finding against the code before archiving — verify it, then fix it or record why it was refuted.
- [ ] 5.4 Open the PR to `main` from `fix/readiness-sanitiser-colon-hazard`, then archive the change once merged.
