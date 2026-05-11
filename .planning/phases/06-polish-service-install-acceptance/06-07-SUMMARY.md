---
phase: 06
plan: 07
status: PARTIAL
wave: 3
started_at: 2026-05-11
updated: 2026-05-11
---

# SUMMARY — Plan 06-07: Closure ritual + review protocol + README + CF Access

## Objective

Land all remaining POLISH requirements + close all carry-forwards in a single composed plan:

1. POLISH-05 protocol doc (D-6-12..14) — docs/review-protocol.md.
2. POLISH-06 README (D-6-15..17) — README.md rewrite + structure test.
3. D-6-16 screenshots — docs/img/{home,project,onboarding}.png from live SPA.
4. D-6-18 CF Access doc — docs/deploy/cf-access-policy.md.
5. Closure ritual — open v1.0 PR (per D-6-24), Stage 1 + Stage 2 reviews, update STATE/ROADMAP/REQUIREMENTS.

## Commits

| Commit | Description |
|--------|-------------|
| `c8cf97f` | docs(06-07): two-stage review protocol + CF Access policy reference |
| `9638264` | test(06-07): readme-structure assertions per D-6-15 (RED) |
| `58a78f5` | feat(06-07): rewrite README per D-6-15 + commit live SPA screenshots (GREEN) |
| `8ceaa29` | chore(06-07): fix pre-existing lint errors blocking v1.0 CI |
| `8213695` | docs(06-07): seed 06-07-SUMMARY with deferral notes for POLISH-02/03 |
| `5061b71` | fix(06-07): align impeccable.yml step name + comment with D-6-09.v1 (Stage 1 F-001) |
| `289bfa8` | docs(06): close v1.0 — STATE + ROADMAP + REQUIREMENTS + VERIFICATION reflect Phase 6 completion (Step G) |
| `9f28cf3` | fix(ci): three pre-existing latent failures surfaced by first PR on phase-06 branch |
| `6b26bfd` | fix(06-07): Stage 2 mechanical fixes (3 warns from independent code review) |

## Manual UAT

### POLISH-02 reboot UAT — **DEFERRED** (D-6-22)

Per D-6-22 (Phase 6 CONTEXT.md): the launchd reboot survival test is **opt-in**. During Plan 06-07 closure (2026-05-11), the user elected to defer the live reboot validation.

Coverage in place without the live reboot:

- `packages/agent/src/cli/installLaunchd.test.ts` — unit-level vitest assertions on plist content + mode bits.
- `packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts` — subprocess test that spawns the built CLI in a tmpdir HOME and asserts the file written + permissions.

What is NOT covered without the live test:

- `launchctl load ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist` actually loading the agent on this user's Mac.
- Daemon being auto-started by launchd after a real reboot.
- `KeepAlive` actually restarting the daemon on crash.

This validation will happen when the developer first deploys the LaunchAgent in real use — tracked as a v1.x post-ship UAT item.

### POLISH-03 systemd UAT — **DEFERRED** (Linux required)

The systemd unit install logic is covered by `packages/agent/src/cli/installSystemd.test.ts` and `packages/agent/src/cli/__tests__/install-systemd.subprocess.test.ts`, which confirm the unit file content + path are correct.

Live `systemctl --user enable --now eu.agenticapps.dashboard` activation requires a Linux machine and is out of scope on a macOS dev box. Will be validated on the first Linux deploy (out-of-band).

## PR

**PR #15** — https://github.com/agenticapps-eu/agenticapps-dashboard/pull/15

One big PR per D-6-24: `phase-06-polish-service-install` → `main`. 137 commits, 218 files, +23,193 / −1,692. Contains all of Phase 5.1 + Phase 6 + Phase 06.1.

## Stage 1 — gstack /review (this session)

**Scope:** spec-compliance review per `docs/review-protocol.md`. Locked decisions D-6-XX, PROJECT.md hard constraints, plan-vs-shipped traceability.

**Findings:**

- `F-001` (info, Docs) — `.github/workflows/impeccable.yml` step name + inline comment said `< 90` but `DEFAULT_THRESHOLD = 87` per D-6-09.v1. Resolved by commit `5061b71`.

**Stage 1 stats:** 1 info, 0 warn, 0 block — all resolved before merge. All locked decisions honored.

Stage 1 block appended to PR description.

## Stage 2 — superpowers:requesting-code-review (executed 2026-05-11)

Per project memory `feedback_code-review-vs-context.md`, Stage 2 wants a context-blind reviewer. Executed in a fresh post-`/clear` session as **three parallel `general-purpose` reviewer agents**, each scoped to a slice of the 23k-line diff:

- **Slice A (security/daemon):** `packages/agent/` + `scripts/install-*`. 11 files / +1,063 lines.
- **Slice B (frontend):** `packages/spa/`. 125 files / +4,286 / −1,646 lines.
- **Slice C (integration):** `packages/shared/` + `.github/` + `docs/` + `tests/`. 10 files / +395 lines.

**Findings (F-002 through F-014, continuing Stage 1's F-001 numbering):**

| Severity | Total | Resolved | Deferred |
|----------|-------|----------|----------|
| `block` | 0 | — | — |
| `warn` | 8 | 3 (commit `6b26bfd`) | 5 (Phase 6.x v1.1 backlog) |
| `info` | 5 | 1 (commit `6b26bfd`) | 4 (deferred polish) |

**Resolved by commit `6b26bfd` (Stage 2 mechanical fixes):**

- `F-002` (warn, CI) — `check-impeccable-score.mjs:72` hardcoded `'BELOW 90'` contradicted D-6-09.v1's 87 floor. Replaced with `\`BELOW ${threshold}\``.
- `F-003` (warn, CI) — `.github/workflows/{impeccable,ci}.yml` had no `concurrency:` blocks. Added `cancel-in-progress` for non-main refs.
- `F-004` (info, DX) — `tests/docs/readme-structure.test.ts:6` used `__dirname` in ESM. Switched to `dirname(fileURLToPath(import.meta.url))` for symmetry with the 9f28cf3 SPA fix.

**Deferred to v1.1 backlog (5 warns + 4 infos — all surfaced in PR description for explicit user decision before merge):**

- `F-005` (warn, Security) — legacy `POST /api/registry/register` has no rate-limit. Bounded threat (loopback + valid token); A-01 pattern can be applied in v1.1.
- `F-006` (warn, DX) — CLI `rotate-token` doesn't sync the running daemon's in-memory token. Cross-process coordination work.
- `F-007` (warn, Correctness) — Plist/systemd unit template literals don't XML/whitespace-escape interpolation. Edge-case for unusual home dirs.
- `F-008` (warn, Correctness) — `RegisterModal` `as unknown as PrepareResponse` cast defeats schema validation. Type-import fix is trivial; deferred to keep this PR scope-locked.
- `F-009` (warn, Correctness) — `impeccable.yml` aggregation has vacuous-pass risk on empty routes. Gate currently works empirically (latest run: 89/87/90/90/90/88).
- `F-010` through `F-014` (info) — daemon install-script robustness gaps, KbdHint screen-reader parity, motion-class invariant drift, `MultiProjectHome.test.tsx` wall-clock budget fragility, bundle of trivial polish.

**Stage 2 stats:** 8 warn / 5 info / **0 block** across all three slices. Merge-gate per the protocol is satisfied.

## Closure tasks remaining

- [x] Stage 1 (gstack /review) — done (1 info F-001 resolved by `5061b71`)
- [x] Stage 2 (superpowers:requesting-code-review) — done (3 warns + 1 info auto-resolved by `6b26bfd`; 5 warns + 4 infos deferred to v1.1 backlog with explicit rationale)
- [x] PR Impeccable Critique Gate CI check — green (89/87/90/90/90/88 at 1440x900)
- [x] PR CI workflow (lint + typecheck + build + test) — green
- [x] STATE.md / ROADMAP.md / REQUIREMENTS.md updated for v1.0 closure
- [x] VERIFICATION.md (06-VERIFICATION.md) authored — status `human_needed` pending Stage 2 + merge
- [ ] Merge + tag v1.0 (HUMAN gate — pause for explicit approval per user election)
- [ ] Open Phase 6.x v1.1 backlog issues for F-005..F-009 + the substantive infos before tagging
