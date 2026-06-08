# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Cross-family observability

**Shipped:** 2026-06-08
**Phases:** 9 (10, 10.5, 10.6, 11, 11.1, 11.2, 12, 13, 14) | **Plans:** ~55 | **Span:** 2026-05-13 → 2026-06-08

### What Was Built
- `/coverage` matrix across three client families (CLAUDE.md / GitNexus / wiki / workflow freshness) + three-state GitNexus detection (Phase 10/10.6); ships as migration 0008.
- Coverage trends (local NDJSON snapshots + per-cell drift badges) and a cross-repo `/observability/skill-drift` matrix (Phase 11).
- `/observability/conformance` — pure-SVG 90-day fleet trend chart, per-family conformance scores, registry path-drift fix affordance (Phase 12).
- GitNexus scoped scan actions — per-family/per-repo daemon-driven `gitnexus analyze` from the matrix (Phase 13).
- Daemon-hosted understand-anything knowledge-graph viewer with scoped HMAC v2 tokens + Code Intelligence sidebar section (Phase 14).
- Skill-driven impeccable gate replacing the broken CI gate; floor recalibrated to ≥ 80 + structural-debt waiver (Phase 10.5).

### What Worked
- **Wire-schema-first discipline** (`packages/shared` Zod barrel) kept daemon↔SPA contracts honest across 9 phases; "schema drift" surfaced mismatches at runtime instead of in production.
- **Reusing the Phase 10 scanner architecture** (Promise.allSettled partial-failure isolation, 30s daemon cache, the coverage orchestrator) made Phases 11–14 additive rather than rearchitecting.
- **Zero-third-party-JS stance held** — pure-SVG fleet chart (≤120 LOC), in-house Tooltip/Toast primitives, no chart library, no native deps.
- **Inserted polish phases (10.5, 10.6, 11.1, 11.2)** let impeccable debt be paid in tight, reviewable bundles instead of accreting.

### What Was Inefficient
- **Phase 12 and 13 shipped their implementation but never ran their close-out gate plans** (12-06, 13-04) — no 12-VERIFICATION.md. Easy to lose track of "impl done" vs "phase closed" when momentum carries to the next phase.
- **Milestone bookkeeping drifted** — ROADMAP/REQUIREMENTS labeled Phases 12–14 "v1.2" while STATE.md said "v1.1"; reconciled only at close.
- **CI lint was not part of the local phase gate** — Phase 14 failed CI on 11 eslint errors after merge-readiness (the gate ran typecheck/build/test, not `pnpm lint`).
- **`gsd-sdk` milestone tooling mis-parsed this ROADMAP** (returned 0 phases; scraped junk "One-liner:" accomplishments) — MILESTONES.md had to be authored by hand.

### Patterns Established
- Per-phase `<N>-IMPECCABLE.md` artifact as the design-quality gate (D-10.5-02), with an empirically calibrated composite floor (≥ 80) + structural-debt waiver clause.
- Daemon write affordances follow a single discipline: bearer-auth → rate-limit → Zod `.strict()` → realpath/blocklist containment → atomic write, with structured error codes (no FS path leakage). Reused across registry-fix-path, gitnexus-scan, and understand-viewer.
- New sidebar capabilities grow the Observability/Code-Intelligence sections additively (peer `SidebarItem`, never reorder) per the user's sidebar-architecture preference.

### Key Lessons
1. **Run `pnpm lint` before shipping** — CI enforces it as a hard gate but the GSD phase gate skips it. (Saved as a memory.)
2. **Close phases, don't just ship them** — run the gate/verification plan before moving on, or the milestone close inherits a pile of "impl done, not closed" debt.
3. **Keep one authoritative milestone pointer** — when phase bodies and STATE.md disagree on version, reconcile immediately, not at close.
4. **Don't trust `gsd-sdk milestone.complete` accomplishments blindly** on a large/non-standard ROADMAP — verify the generated MILESTONES.md.

### Cost Observations
- Model mix: predominantly Opus (Opus 4.7/4.8 1M context) for planning + execution; parallel executor/worktree agents during wave execution.
- Notable: worktree-based parallel execution + two-stage review (gstack `/review` + superpowers fresh-context review) per phase was the steady cadence.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 10 (0–7 incl. 5.1/6.1) | Established workspace, daemon, SPA, two-stage review + impeccable CI gate |
| v1.1 | 9 (10–14) | Retired CI impeccable gate → skill-driven per-phase artifact; cross-family observability surface; daemon write affordances |

### Cumulative Quality

| Milestone | Tests (approx) | Zero-Dep Additions |
|-----------|----------------|--------------------|
| v1.0 | ~1,380 | maintained (no native deps) |
| v1.1 | ~2,600+ | maintained (pure-SVG chart, in-house Tooltip/Toast, no chart lib) |

### Top Lessons (Verified Across Milestones)
1. Wire-schema-first (shared Zod barrel) is the backbone — every phase that respected it integrated cleanly.
2. Tight inserted polish phases beat letting design/impeccable debt accrete.
