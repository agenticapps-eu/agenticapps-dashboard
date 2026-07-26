# Phase 13: GitNexus scoped scan actions (Coverage matrix) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 13-gitnexus-scoped-scan-actions-coverage-matrix
**Areas discussed:** A. UI states & placement, B. Daemon impl, C. Scan semantics, D. Security posture

---

## A. UI states & placement

### D-13-06 — Page-header CTA disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely | Per-family is the highest scope needed; "scan all" is rare and achievable by clicking each header. Cleanest header. | ✓ |
| Reframe as "Scan all families" | Keep slot, change semantics. Risk: dangerous-by-default — hammers disk and may take minutes. | |
| Keep clipboard copy | Status quo. Loses click-to-scan win at page level. | |

**User's choice:** Remove entirely
**Notes:** User explicitly called the current button "weird, not clear what it does" in the session that motivated this phase.

### D-13-08 — Per-repo cell placement

| Option | Description | Selected |
|--------|-------------|----------|
| Replace ✗ with "Scan" pill | "Row has a Scan affordance" implies the status. Cuts duplicate signal. Cell stays compact. | ✓ |
| ✗ + inline "Scan" icon | Keeps status icon, adds small action. More info per cell but noisier; harder on mobile. | |
| Hover-only reveal | ✗ always visible; Scan reveals on hover/focus. Breaks Phase 11 D-11-02 (no hover-only disclosure). | |

**User's choice:** Replace ✗ with "Scan" pill

### D-13-07 — Binary-not-installed UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hide Scan; show existing install CTA | Daemon detects gitnexus at startup, gates Scan on `installed === true`. Existing `InstallGitNexusButton` (clipboard) used otherwise. Symmetric with Phase 12. | ✓ |
| Show Scan, fail with toast | Always show button; on click, fail with ENOENT, toast. Punishes user with a click before learning the truth. | |
| Show Scan that morphs to install CTA | Same cell does double duty. Conflates two semantics into one affordance. | |

**User's choice:** Hide Scan; show existing install CTA

---

## B. Daemon implementation

### D-13-01 — Daemon invocation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Spawn `gitnexus analyze` subprocess | execa already a dep. Zero new native deps. Version-skew-safe — runs whatever's on PATH. Matches Phase 12 `coverageSpawn.ts` precedent. | ✓ |
| Import gitnexus as a library dep | Tighter integration, programmatic events. Pulls gitnexus into dep tree; version skew with user's CLI. | |
| Skill-based invocation | Daemon writes instruction file for separate process. Premature indirection. | |

**User's choice:** Spawn `gitnexus analyze` subprocess

### D-13-02 — Progress transport

| Option | Description | Selected |
|--------|-------------|----------|
| Short-poll `GET /api/gitnexus/scan/{id}` | Matches Phase 12 discipline (cache + manual refetch + inflight Set). SPA polls 1–2s while in-flight. No new transport infra. | ✓ |
| SSE stream | Real-time progress; could stream stderr. New infra in daemon + browser EventSource. Conflicts with Phase 12's "no SSE yet" stance. | |
| Fire-and-forget + auto-refetch | POST returns immediately; SPA invalidates after fixed delay. Simplest but no per-row spinner state. | |

**User's choice:** Short-poll

### D-13-03 — Concurrency model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-repo lock; family = orchestrated sequence | One scan in flight per repo (409 if collision). Family scan reuses per-repo lock — locks compose. | ✓ |
| Global lock | Simplest. But: single "scan family" ties up dashboard for minutes with 22 repos. | |
| No locks; client coordinates | Race on gitnexus registry writes. Not safe. | |

**User's choice:** Per-repo lock

### D-13-10 — Command shape reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the shared builder | Single source of truth for gitnexus invocation. Clipboard fallback + daemon scan stay in lockstep. | ✓ |
| Daemon-side independent construction | Daemon builds own argv. Two places to update if canonical command changes. | |
| Hybrid: shared builder for clipboard, argv-list for daemon | Both representations live in shared, `{string, argv}` shape. Best of both, costs one helper function. | |

**User's choice:** Reuse the shared builder
**Notes:** CONTEXT.md adopts the spirit of the hybrid option — shared builder extended to return `argv` as well so daemon doesn't re-quote. Single function, two consumers.

---

## C. Scan semantics

### D-13-04 — Family scan ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential | Predictable disk/git/CPU load. Easy progress UI. v1.3.x can revisit. | ✓ |
| Bounded parallel | Faster wall-clock. Need to verify gitnexus registry lock-safety; disk thrash; harder progress UI. | |
| User chooses (toggle) | Setting in header. Premature — we don't know if users care. | |

**User's choice:** Sequential

### D-13-05 — Failure semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Partial success | Each row ends with its own final state. Family toast: "6/9 scanned, 3 failed — retry?". | ✓ |
| All-or-nothing | Family scan reports single result. Wastes earlier work on late failures. | |
| Stop on first failure | Abort rest of family. D-13-07 already handles cascading cause (binary missing). | |

**User's choice:** Partial success

### D-13-09 — Post-scan refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-invalidate Coverage query | SPA invalidates `useCoverage`/`useConformance`, TanStack refetches, cell flips green. Matches Phase 12 `useRegistryFixPath`. | ✓ |
| Manual user refresh | Toast says "refresh to see updated status". User just clicked — shouldn't need to click again. | |
| Optimistic update + reconcile | Flip green immediately, then refetch. Snappy but risks flicker. | |

**User's choice:** Auto-invalidate

---

## D. Security posture

### D-13-11 — Bind-mode posture

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse scan over non-loopback | Daemon returns 403 on scan routes when bind ≠ 127.0.0.1, regardless of bearer. Safest default. | ✓ |
| Refuse by default, allow via flag | `--allow-remote-scan` flag opens it up. Adds a flag that's easy to forget you flipped on. | |
| Allow with bearer token | Trust the bearer-auth model. Risk: subprocess execution is higher-impact than reads. | |
| Allow but log/notify | Allow scan over Tailscale, log + notify. Premature — no notification surface yet. | |

**User's choice:** Refuse scan over non-loopback
**Notes:** User context — Starlink + CGNAT means Tailscale is the only remote-device path. Refusal preserves the user's existing remote-read use case while keeping subprocess execution local-only.

### D-13-11b — UX of bind refusal

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled Scan + tooltip | SPA reads `gitnexus.canScan` from health response (daemon-computed). Pills render disabled with tooltip. No click-then-fail. | ✓ |
| Enabled, fails with toast | Show buttons normally; on click, 403, toast. Discoverable but punishes the click. | |
| Hidden entirely | If `canScan` false, pill simply doesn't render — row falls back to ✗. Hard to discover the feature. | |

**User's choice:** Disabled Scan + tooltip

---

## Claude's Discretion

The user explicitly trusted the planner/researcher to resolve:

- Scan job id format (UUID v4 vs ULID)
- In-memory vs on-disk scan job state (in-memory chosen by CONTEXT.md based on ~30s scan lifetime)
- Polling cadence (start at 1500ms; planner can adjust)
- Error code taxonomy for `/api/gitnexus/scan` failures
- Exact toast copy strings (UI-Spec phase will refine)

## Deferred Ideas

- Bounded-parallel family scans (v1.3.x candidate)
- Scan-all-families action (v1.3.x if dogfooding shows friction)
- Scan over Tailscale (flag-based opt-in if user later asks)
- Cancelable scans
- Streaming gitnexus stderr to UI
- Scan scheduling / cron from dashboard
- Per-skill / per-language scan targeting
