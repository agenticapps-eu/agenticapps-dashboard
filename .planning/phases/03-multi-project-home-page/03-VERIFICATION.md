---
phase: 03-multi-project-home-page
verified: 2026-05-04T21:00:00Z
status: gaps_found
score: 5/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can open Register project modal from the command palette"
    status: failed
    reason: "commandPaletteActions.ts dispatches 'palette:open-register' CustomEvent but MultiProjectHome.tsx has no window.addEventListener for it. The event fires into the void — clicking 'Register project' in the palette closes the palette without opening the modal."
    artifacts:
      - path: "packages/spa/src/lib/commandPaletteActions.ts"
        issue: "Dispatch side exists (line 48: window.dispatchEvent(new CustomEvent('palette:open-register'))) but listener side is absent"
      - path: "packages/spa/src/components/MultiProjectHome.tsx"
        issue: "No window.addEventListener('palette:open-register', ...) event listener present; the register modal is only openable via RegisterButtonCard click"
    missing:
      - "Add useEffect in MultiProjectHome.tsx: window.addEventListener('palette:open-register', () => setRegisterOpen(true)) with cleanup on unmount"
  - truth: "Project card interactive element is valid HTML with no nested interactive elements"
    status: failed
    reason: "ProjectCard.tsx renders a <button> as the card container (line 130) with two nested <button> elements inside: the kebab options button (line 141) and the 'Unregister?' inline button in the unreachable state (line 178). Nested interactive elements are invalid HTML per spec and produce inconsistent browser behavior."
    artifacts:
      - path: "packages/spa/src/components/ProjectCard.tsx"
        issue: "Outer <button> (line 130) contains inner <button data-kebab> (line 141) and conditional inner <button>Unregister?</button> (line 178)"
    missing:
      - "Replace outer <button> with <article> or <div role='button' tabIndex={0}> and handle click/keydown navigation manually, OR extract the card-click affordance to a separate <a> overlay that sits behind the kebab button in z-order"
human_verification:
  - test: "Card hover-expand visual transition"
    expected: "Hovering a project card smoothly expands to show Stage 1/DB-AUDIT/TDD/Verification/Branch rows; transition is 120ms max-height+opacity ease-out with no bounce, shimmer, rotate, or glow (D-42/D-43)"
    why_human: "CSS animation quality cannot be verified programmatically"
  - test: "Touch long-press on real iPad via Tailscale"
    expected: "Long-press (500ms) on a project card opens the CardContextMenu portal"
    why_human: "Touch events and timing require physical touch device; cannot simulate reliably in automated tests"
  - test: "Cross-platform Cmd+K / Ctrl+K"
    expected: "Cmd+K opens palette on macOS; Ctrl+K opens palette on Windows/Linux; Esc closes it; ArrowDown/Up navigate actions; Enter activates; focus is restored to previously active element"
    why_human: "Cross-platform keyboard event behavior requires manual testing on each platform"
  - test: "Register flow end-to-end in browser"
    expected: "Clicking '+ Register project' card opens the modal; entering a path POSTs to /api/registry/register-prepare; Step 2 shows the nonce, detected markers, suggested name, and tags; clicking Confirm POSTs to /api/registry/register-confirm; the new project card appears in the grid within 5 seconds without page reload (acceptance criterion 4)"
    why_human: "Multi-step network flow with real filesystem I/O requires a running daemon and real project path"
  - test: "Per-card freshness display"
    expected: "Header shows '{N} projects · last refresh Ns ago'; the timestamp increments correctly and resets after each refetch cycle"
    why_human: "Real-time counter behavior requires a running dev server and waiting for tick intervals"
  - test: "Empty registry state"
    expected: "When no projects are registered, home page shows only the '+ Register project' card with no error or empty-state placeholder text beyond the card itself"
    why_human: "Requires a clean daemon state or ability to clear the registry"
  - test: "impeccable:critique baseline check"
    expected: "All Phase 3 UI surfaces score >= 90 on the impeccable:critique rubric (CLAUDE.md requirement)"
    why_human: "Subjective UI quality assessment requires human or dedicated AI critique pass"
---

# Phase 3: Multi-Project Home Page — Verification Report

**Phase Goal:** A multi-project home page rendering one card per registered project with current phase, finding counts, and last-commit time; supports filters, search, sort, and an in-UI "Register project" modal.
**Verified:** 2026-05-04T21:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Home page renders one card per registered project | ✓ VERIFIED | MultiProjectHome.tsx maps useRegistryList().data to ProjectCard components; index.lazy.tsx wired to MultiProjectHome |
| 2 | Cards display current phase, finding counts, and last-commit time | ✓ VERIFIED | ProjectCard.tsx renders phase line, Stage 2 findings, branch/lastCommit from useProjectOverview(); plan 03-03 added GET /api/projects/:id/overview |
| 3 | Cards refresh every 5s and per-card freshness is visible | ✓ VERIFIED | registry.ts: refetchInterval: 5_000, refetchIntervalInBackground: false; Header.tsx wired to useLastRefresh() showing "N projects · last refresh Ns ago" |
| 4 | Filter chips and search box filter the card grid | ✓ VERIFIED | HomeToolbar.tsx provides chips (all/active/client/internal + overflow), search input; filterAndSort pure function in registry.ts; MultiProjectHome passes filtered set to render |
| 5 | Sort by tag priority (active > client > internal), then last commit desc | ✓ VERIFIED | filterAndSort implements tag-priority then lastCommit desc then unreachable-last; 11 tests in registry.test.ts confirm behavior |
| 6 | "+ Register project" opens modal from all entry points | ✗ FAILED (PARTIAL) | RegisterButtonCard opens modal correctly; command palette "Register project" action dispatches palette:open-register CustomEvent but MultiProjectHome has no listener — modal does not open from palette (IN-04) |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/spa/src/components/MultiProjectHome.tsx` | Composition root — card grid, toolbar, modal state | ✓ VERIFIED | 5.5KB, wired to index.lazy.tsx |
| `packages/spa/src/components/ProjectCard.tsx` | Per-project card with hover-expand and 5 states | ⚠️ PARTIAL | Exists, substantive, rendered in MultiProjectHome — but contains nested button HTML validity issue (WR-03) |
| `packages/spa/src/components/HomeToolbar.tsx` | Filter chips, search, sort select | ✓ VERIFIED | Exists, substantive, used in MultiProjectHome |
| `packages/spa/src/components/CardContextMenu.tsx` | Portal context menu + unregister confirm | ✓ VERIFIED | Exists, substantive, triggered from ProjectCard and MultiProjectHome |
| `packages/spa/src/components/RegisterModal.tsx` | Two-step native dialog with prepare/confirm flow | ✓ VERIFIED | Exists, opened via RegisterButtonCard; D-10/D-13/D-19 branches implemented |
| `packages/spa/src/components/RegisterButtonCard.tsx` | Dashed CTA card that opens RegisterModal | ✓ VERIFIED | Exists, wired in MultiProjectHome card grid |
| `packages/spa/src/components/CommandPalette.tsx` | Native dialog + WAI-ARIA listbox + Cmd/Ctrl+K | ✓ VERIFIED | Exists, mounted in AppShell, keyboard listener wired |
| `packages/spa/src/lib/commandPaletteActions.ts` | Declarative action registry for palette | ✗ PARTIAL | Dispatch side of palette:open-register exists; listener side absent in MultiProjectHome |
| `packages/spa/src/lib/registry.ts` | TanStack Query hooks — useRegistryList, useProjectOverview, mutation hooks | ✓ VERIFIED | 12KB; all 9 exports present; polling config confirmed |
| `packages/agent/src/routes/overview.ts` | GET /api/projects/:id/overview daemon route | ✓ VERIFIED | 1.6KB; mounted via app.route in server/app.ts |
| `packages/agent/src/routes/registry.ts` | POST register-prepare + register-confirm routes | ✓ VERIFIED | Lines 117, 195 confirm route definitions; nonce TTL + rate limit implemented |
| `packages/spa/src/lib/lastRefresh.ts` | useLastRefresh hook for header freshness | ✓ VERIFIED | Imported in Header.tsx (line 4), used for count + refreshLabel |
| `packages/spa/src/__tests__/register-optimistic.test.ts` | Subprocess E2E test for daemon round-trip | ✓ VERIFIED | 9.2KB, 3 test cases, included in vitest.subprocess.config.ts |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.lazy.tsx` | `MultiProjectHome.tsx` | import + render | ✓ WIRED | Line 4 import, line 10 `<MultiProjectHome />` |
| `MultiProjectHome.tsx` | `useRegistryList()` | import from registry.ts | ✓ WIRED | Confirmed in component |
| `ProjectCard.tsx` | `useProjectOverview(id)` | import from registry.ts | ✓ WIRED | Per-card overview polling |
| `Header.tsx` | `useLastRefresh()` | import from lastRefresh.ts | ✓ WIRED | Lines 4, 9 |
| `AppShell.tsx` | `CommandPalette` | import + mount | ✓ WIRED | Line 5 import, line 26 `<CommandPalette />` |
| `commandPaletteActions.ts` | `MultiProjectHome.tsx` (register modal) | CustomEvent `palette:open-register` | ✗ NOT WIRED | Dispatch fires (line 48) but no addEventListener in MultiProjectHome — modal never opens from palette |
| `RegisterModal.tsx` | `/api/registry/register-prepare` | useRegisterPrepare mutation | ✓ WIRED | prepare/confirm hooks in registry.ts; daemon routes confirmed at lines 117, 195 |
| `SPA apiFetch` | `/api/registry/register` | D-12 guard throws | ✓ WIRED | api.ts throws if path matches `/api/registry/register` (direct registration blocked per D-12) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ProjectCard.tsx` | `overview.data` | `useProjectOverview(id)` → GET /api/projects/:id/overview → filesystem reads | Yes — daemon reads .planning/ and git log | ✓ FLOWING |
| `MultiProjectHome.tsx` | `list.data` | `useRegistryList()` → GET /api/registry → registry.json | Yes — daemon reads ~/.agenticapps/dashboard/registry.json | ✓ FLOWING |
| `Header.tsx` | `count`, `refreshLabel` | `useLastRefresh()` → subscribes to registry query state | Yes — derived from live query data | ✓ FLOWING |
| `CommandPalette.tsx` | `actions` (jump rows) | `useCommandPaletteActions()` → `useRegistryList().data` | Yes — one jump action per registered project | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running daemon + dev server to verify API responses and UI behavior. The subprocess E2E test (register-optimistic.test.ts) provides the closest equivalent for the daemon round-trip path.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HOME-01 | 03-03, 03-04 | GET /api/registry returns all projects with per-project status | ✓ SATISFIED | Phase 1 shipped /api/registry; Phase 3 Plan 03-04 added register-prepare/confirm routes; registry.ts hooks consume both |
| HOME-02 | 03-03 | GET /api/projects/{id}/overview returns summary card data | ✓ SATISFIED | packages/agent/src/routes/overview.ts; 7 tests in overview.test.ts; mounted in app.ts |
| HOME-03 | 03-06, 03-07, 03-08, 03-09 | Home page renders one card per project; cards refresh every 5s; per-card freshness visible | ✓ SATISFIED | MultiProjectHome.tsx + ProjectCard.tsx; refetchInterval: 5_000; useLastRefresh() in Header |
| HOME-04 | 03-06, 03-07 | Filter chips (all/active/client/internal) and search box filter the card grid | ✓ SATISFIED | HomeToolbar.tsx chips + search; filterAndSort in registry.ts; 11 passing tests |
| HOME-05 | 03-06 | Sort: tag priority then last commit desc | ✓ SATISFIED | filterAndSort implements tag-priority (active > client > internal > untagged), then lastCommit desc, then unreachable-last |
| HOME-06 | 03-04, 03-06, 03-08, 03-10 | "+ Register project" card opens modal that POSTs to /api/registry/register | ✓ PARTIAL | RegisterButtonCard → RegisterModal → useRegisterPrepare/Confirm works; command palette path broken (IN-04 above) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/spa/src/components/ProjectCard.tsx` | 130, 141, 178 | `<button>` nested inside `<button>` | ⚠️ Warning | Invalid HTML per spec; inconsistent browser handling of click events on inner buttons; accessibility violation (interactive element inside interactive element) — WR-03 |
| `packages/spa/src/components/RenameTagsForms.tsx` | 21, 118 | `react-hooks/set-state-in-effect` (setState in useEffect) | ℹ️ Info | Known pre-existing lint errors deferred to pre-PR cleanup; functional but lint gate will fail on PR if not addressed |
| `packages/spa/src/components/RegisterModal.tsx` | 106 | `react-hooks/set-state-in-effect` | ℹ️ Info | Same as above — deferred |
| `packages/spa/src/lib/api.test.ts` | 5 | `import/order` lint error | ℹ️ Info | Pre-existing from Plan 03-06; deferred |

### Human Verification Required

#### 1. Card Hover-Expand Visual Transition

**Test:** Navigate to the home page with at least one registered project. Hover over a project card.
**Expected:** The card smoothly expands to reveal Stage 1 findings, DB-AUDIT, TDD pairs, Verification row, and Branch — at 120ms max-height+opacity ease-out with no bounce, shimmer, rotate, scale, or glow (D-42/D-43 anti-slop discipline).
**Why human:** CSS animation quality and motion design cannot be verified programmatically.

#### 2. Touch Long-Press on iPad via Tailscale

**Test:** On a real iPad, connect to the daemon via Tailscale hostname. Long-press (500ms) on any project card.
**Expected:** `CardContextMenu` portal appears at the touch position with Rename / Edit tags / Unregister options.
**Why human:** Touch event timing and portal positioning require physical touch device.

#### 3. Cross-Platform Cmd+K / Ctrl+K

**Test:** On macOS press Cmd+K; on Windows/Linux press Ctrl+K. Test Esc to close, ArrowDown/Up to navigate, Enter to activate, Tab to close.
**Expected:** Palette opens on all platforms, keyboard navigation works correctly, focus restores to previously active element after close.
**Why human:** Platform-specific keyboard events require testing on each OS.

#### 4. Register Flow End-to-End in Browser

**Test:** Click "+ Register project" card. Enter a valid local path in Step 1. Confirm in Step 2. Observe the card grid.
**Expected:** Step 1 calls /api/registry/register-prepare and returns a nonce. Step 2 shows nonce, detected markers, suggested name. Confirm calls /api/registry/register-confirm. New card appears in grid within 5 seconds without page reload. Second confirm of same nonce returns 410 (D-10 single-use enforcement — browser-visible only via re-prepare auto-trigger in D-19).
**Why human:** Multi-step network flow with real filesystem I/O requires running daemon with a real project path.

#### 5. Per-Card Freshness Display

**Test:** Load the home page, wait 10+ seconds while watching the Header.
**Expected:** Header shows "{N} projects · last refresh Ns ago" where N increments from 0 and resets after each 5s refetch. The count reflects the actual number of registered projects.
**Why human:** Real-time timer requires running dev server; tick interval behavior not simulable in static checks.

#### 6. Empty Registry State

**Test:** Stop the daemon, clear registry.json, restart, load home page.
**Expected:** Home page shows only the dashed "+" RegisterButtonCard with no error overlay, empty-list text, or broken UI. Toolbar shows "all (0)".
**Why human:** Requires a clean daemon state.

#### 7. impeccable:critique Baseline

**Test:** Run `superpowers:impeccable:critique` against the Phase 3 UI surfaces.
**Expected:** Score >= 90 (hard requirement per CLAUDE.md).
**Why human:** Subjective UI quality and anti-AI-slop assessment requires dedicated critique pass.

### Gaps Summary

Two gaps prevent full phase goal achievement:

**Gap 1 (Blocking — IN-04): Command palette "Register project" action is non-functional.**

`commandPaletteActions.ts` dispatches `window.dispatchEvent(new CustomEvent('palette:open-register'))` when the Register action is activated in the command palette. However, `MultiProjectHome.tsx` has no `window.addEventListener('palette:open-register', ...)` handler. The Plan 10 SUMMARY incorrectly claimed this was "fully wired" by referencing Plan 03-08's work — but that listener was never added. The fix is a one-line `useEffect` in `MultiProjectHome.tsx`:

```typescript
useEffect(() => {
  const handler = () => setRegisterOpen(true)
  window.addEventListener('palette:open-register', handler)
  return () => window.removeEventListener('palette:open-register', handler)
}, [])
```

This gap affects HOME-06 (partial) and blocks the D-32 acceptance criterion for the command palette register action.

**Gap 2 (Warning — WR-03): Nested `<button>` elements in ProjectCard.**

`ProjectCard.tsx` uses `<button>` as the outer card container and places two `<button>` elements inside it (kebab button, "Unregister?" button). This is invalid HTML per the HTML5 spec (interactive content model forbids nested interactive elements). Browsers handle this inconsistently — some silently close the outer button before the inner, breaking the layout. The kebab button has `e.stopPropagation()` which mitigates the click-event issue but not the HTML validity or screen-reader traversal problem.

The structured YAML above contains the `gaps` for `/gsd-plan-phase --gaps` to consume.

---

_Verified: 2026-05-04T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
