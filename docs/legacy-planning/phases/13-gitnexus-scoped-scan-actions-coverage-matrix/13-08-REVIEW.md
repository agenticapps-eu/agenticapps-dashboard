# Plan 13-08 — Two-Stage Code Review

**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Plan:** 13-08 (Codex Review Fix-up)
**Reviewed:** 2026-05-26
**Range:** `main..feat/phase-13-gitnexus-scoped-scan` filtered to fix commits `c2b1a1a..62725b5` (plus Stage-2 follow-up `d7a3cae`).

The two stages are intentionally NOT collapsed — Stage 1 catches spec/threat-model drift; Stage 2 catches code-quality drift. Different failure modes, different agents.

## Stage 1 — gstack `/review` (inline)

Reviewer: Claude (planning Claude, in-session) running the gstack `/review` role against the diff. Cross-referenced against project CLAUDE.md hard architectural constraints + Phase 13 threat model (T-13-02-NN) + Codex review findings.

### Findings

**None blocking.** All 9 Codex findings have a paired RED→GREEN commit:

| Codex finding | Commit | RED test exists | GREEN passes | Spec alignment |
|---|---|---|---|---|
| CRITICAL #1 (regex `..`) | `c2b1a1a` | yes (7 cases) | yes | T-13-02-01 now structurally enforced |
| CRITICAL #2 (symlink) | `0cd054c` | yes (7 cases) | yes | New defence; mirrors assertSnapshotDirInDaemonHome idiom |
| WARNING #1 (family FS) | `df07c29` | yes (4 cases) | yes | D-13-EXT-08 principle applied uniformly to per-family scan |
| WARNING #2 (subdir hijack) | `b53df74` | yes (6 cases) | yes | T-13-02-01 registration-side defence |
| WARNING #3 (family lock) | `cec41e9` | yes (3 cases) | yes | Coexists with global lock (D-13-EXT-01) |
| WARNING #4 (ScanPill error) | `4fbac9a` | yes (1 case) | yes | UX defect, no spec implication |
| WARNING #5 (shutdown disposer) | `c50e2b5` | yes (2 cases) | yes | Closes T-13-02-NEW orphaned-process surface |
| WARNING #6 (inRegistry optional) | `58a4900` | yes (4 cases) | yes | INV-04 schema-drift defence preserved |
| INFO #2 (BIND_REFUSED order) | `62725b5` | yes (1 case) | yes | T-13-02-02 wire-level enforcement |

### Spec compliance check

- **Daemon read-only on project filesystems** — preserved. `gitnexus analyze` writes only to `~/.gitnexus/`, unchanged.
- **Path allow-list per project** — preserved + strengthened (`assertRegistrationAllowed` now rejects subdir hijacks).
- **Bearer-token auth on every route** — preserved. New bind-mode middleware short-circuits BEFORE rate-limit and zValidator but AFTER bearer auth.
- **No native deps** — preserved. New code uses only Node built-ins + existing execa.
- **CORS lock** — preserved.
- **Frontend-touching phase IMPECCABLE artifact** — N/A for fix-up; the original Phase 13 IMPECCABLE.md (composite 87+) is unaffected by the SPA change (single sibling effect addition).

### Test discipline

- 9/9 fixes have RED→GREEN evidence (the test fails when the implementation hunk is reverted — verified locally per task).
- Atomic commits — each `fix(13-08):` commit closes exactly one Codex finding.
- TDD red-flag check: no test added after implementation, no test marked for later, no "just this once" reasoning.

### Stage 1 verdict

**PASS** — no spec drift, no test discipline violations, all Codex findings closed with structurally-enforced mitigations.

---

## Stage 2 — `pr-review-toolkit:code-reviewer` (independent agent)

Reviewer: dispatched agent with no prior context on this conversation. Reviewed the diff + paired tests + read the implementing code, including the two newly-created test files and the architectural decisions in `13-CONTEXT.md` Section F.

Agent verdict: **ship-with-fixes** (3 WARNINGs, 5 INFOs, none blocking).

### Findings raised by Stage 2

**W1 — `deterministicRepoRoot` dead-code `||` branch.**
> `gitnexusScan.ts:516` (pre-cleanup) — `realCandidate.startsWith(realFamilyPrefix) || realCandidate !== realFamilyPrefix.slice(0, -1)` was a defence-in-depth against the candidate equalling the bare family root. Dead code because the candidate is always `{familyPrefix}{repo}`, never the bare family root.
**Action:** Cleaned up in commit `d7a3cae`. Replaced with a comment explaining why the equality fallback is unnecessary.

**W2 — Legacy `deriveRepos(entries, family)` still imported (kept alive by `void deriveRepos`).**
> `gitnexusFamilyScan.ts` (pre-cleanup) — the registry-driven helper was retained "one release for grep history" but `void deriveRepos` would suppress unused-warnings forever; nothing would force its eventual removal.
**Action:** Cleaned up in commit `d7a3cae`. Deleted `deriveRepos` and its `void` suppression + dropped the now-unused `basename` import.

**W3 — `onSubprocess` cleanup chain comment imprecise.**
> The comment claimed "the primary await in `spawnGitNexusAnalyze` still observes the error" — true, but the reason is that `sp` is awaited TWICE (inside the spawn helper AND via the tracking-chain), each chain settling independently.
**Action:** Noted in 13-08-REVIEW.md (this file). Not blocking; will refine in a follow-up if a future reader stumbles on it.

### INFO from Stage 2

- **I1** — SIGKILL escalation timers stay armed for 2s even when the child has already died. Acceptable (`.unref()`'d); noted for future tuning.
- **I2** — `_registryDeprecated` positional-compat shim was lying via its type signature.
  **Action:** Cleaned up in commit `d7a3cae`. Removed the arg from `startFamilyScan` entirely; updated route + tests.
- **I3** — Bind-mode middleware reorder semantics are correct for Hono v4 (`async (c, next) => { if(…) return c.json(…); await next() }`).
- **I4** — `assertRegistrationAllowed` subdir check operates on the realpath'd canonical root (already realpath'd upstream); symlinks can't bypass.
- **I5** — `ScanPill` `useEffect` deps deliberately omit `qc`/`toast`/`progress.error`; matches the sibling success-path effect. Future refactor candidate.

### Stage 2 verdict

**ship-with-fixes** — three small cleanups applied as commit `d7a3cae` (W1 + W2 + I2). The remaining items (W3, I1, I3-I5) are observations, not blockers.

---

## Consolidated decision

**Both stages pass.** Stage 1 confirms no spec/threat-model drift. Stage 2 raised 3 cleanup items, all applied in `d7a3cae`. The remaining Stage-2 INFO/WARNING items are non-blocking observations.

Codex re-review (Task 11) is the final gate before merge — expected to flip the original HOLD verdict to ship-as-is.

---
*Plan 13-08 REVIEW.md*
