---
phase: 03-multi-project-home-page
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 64
files_reviewed_list:
  - packages/agent/src/lib/overviewCache.test.ts
  - packages/agent/src/lib/overviewCache.ts
  - packages/agent/src/lib/projectOverview.test.ts
  - packages/agent/src/lib/projectOverview.ts
  - packages/agent/src/lib/rateLimiter.test.ts
  - packages/agent/src/lib/rateLimiter.ts
  - packages/agent/src/lib/registerLog.test.ts
  - packages/agent/src/lib/registerLog.ts
  - packages/agent/src/lib/registerNonces.test.ts
  - packages/agent/src/lib/registerNonces.ts
  - packages/agent/src/lib/registry.ts
  - packages/agent/src/routes/overview.ts
  - packages/agent/src/routes/registry.ts
  - packages/agent/src/server/__tests__/overview.test.ts
  - packages/agent/src/server/__tests__/registry-prepare-confirm.test.ts
  - packages/agent/src/server/__tests__/registry.test.ts
  - packages/agent/src/server/app.ts
  - packages/shared/src/index.ts
  - packages/shared/src/schemas/overview.test.ts
  - packages/shared/src/schemas/overview.ts
  - packages/shared/src/schemas/registry.test.ts
  - packages/shared/src/schemas/registry.ts
  - packages/spa/src/__tests__/e2e-pair-flow.test.tsx
  - packages/spa/src/__tests__/register-optimistic.test.ts
  - packages/spa/src/components/AppShell.test.tsx
  - packages/spa/src/components/AppShell.tsx
  - packages/spa/src/components/CardContextMenu.test.tsx
  - packages/spa/src/components/CardContextMenu.tsx
  - packages/spa/src/components/CommandPalette.test.tsx
  - packages/spa/src/components/CommandPalette.tsx
  - packages/spa/src/components/Header.test.tsx
  - packages/spa/src/components/Header.tsx
  - packages/spa/src/components/HomeLayout.test.tsx
  - packages/spa/src/components/HomeLayout.tsx
  - packages/spa/src/components/HomeToolbar.test.tsx
  - packages/spa/src/components/HomeToolbar.tsx
  - packages/spa/src/components/MultiProjectHome.test.tsx
  - packages/spa/src/components/MultiProjectHome.tsx
  - packages/spa/src/components/ProjectCard.test.tsx
  - packages/spa/src/components/ProjectCard.tsx
  - packages/spa/src/components/RegisterButtonCard.test.tsx
  - packages/spa/src/components/RegisterButtonCard.tsx
  - packages/spa/src/components/RegisterModal.test.tsx
  - packages/spa/src/components/RegisterModal.tsx
  - packages/spa/src/components/RenameTagsForms.test.tsx
  - packages/spa/src/components/RenameTagsForms.tsx
  - packages/spa/src/lib/api.test.ts
  - packages/spa/src/lib/api.ts
  - packages/spa/src/lib/appShellWidth.test.ts
  - packages/spa/src/lib/appShellWidth.ts
  - packages/spa/src/lib/commandPaletteActions.test.ts
  - packages/spa/src/lib/commandPaletteActions.ts
  - packages/spa/src/lib/lastRefresh.test.ts
  - packages/spa/src/lib/lastRefresh.ts
  - packages/spa/src/lib/registry.test.ts
  - packages/spa/src/lib/registry.ts
  - packages/spa/src/lib/touchLongPress.test.tsx
  - packages/spa/src/lib/touchLongPress.ts
  - packages/spa/src/router.tsx
  - packages/spa/src/routes/index.lazy.tsx
  - packages/spa/src/routes/projects.$projectId.lazy.tsx
  - packages/spa/src/routes/projects.$projectId.test.tsx
  - packages/spa/vitest.subprocess.config.ts
  - README.md
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 64
**Status:** issues_found

## Summary

Phase 3 ships the multi-project home page (home grid, register modal, context menu, command palette) along with the daemon-side overview endpoint, nonce-based prepare/confirm flow, rate limiter, rename/tags routes, and the shared schemas. The implementation is architecturally sound and the decisions in the 03-CONTEXT.md are all honoured. Bearer-token auth, read-only filesystem invariant (INV-01), path allow-list, atomic writes, and the schema-drift defence are all in place.

Five warnings were found: three are correctness issues that are reachable under plausible runtime conditions (a `relativeTime` function that returns negative seconds for future timestamps, a `handleChipClick` dead-branch that gives misleading chip behaviour, a `button-inside-button` nesting in `ProjectCard` that is invalid HTML), one is a missing cleanup concern for the `rateLimiter` sweep interval in tests, and one is a potential unchecked `null!` non-null assertion in the registry route. Five info items flag minor quality concerns.

No critical (security/data-loss) issues were found.

---

## Warnings

### WR-01: `relativeTime` in ProjectCard returns negative seconds for future `lastCommitAt`

**File:** `packages/spa/src/components/ProjectCard.tsx:34-43`

**Issue:** The `relativeTime` helper computes `diffMs = Date.now() - new Date(iso).getTime()`. If `lastCommitAt` is a future ISO timestamp (clock skew between the user's machine and the project's git commit clock, or a test fixture), `diffMs` is negative, and the function returns `-1s ago` (and similar for minutes/hours/days). The daemon side stores `git log --format=%cI` and normalises to UTC ISO via `new Date(trimmed).toISOString()`, so skew is plausible in CI or VMs.

**Fix:**
```ts
function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime())
  // ... rest unchanged
}
```

### WR-02: Dead-branch in `HomeToolbar.handleChipClick` — 'all' re-click is always a no-op instead of deselect-all

**File:** `packages/spa/src/components/HomeToolbar.tsx:37-54`

**Issue:** When the user clicks the 'all' chip and it is already the sole selection, the function takes the `if` branch and calls `onChipsChange(new Set(['all']))` — producing the same state. The `else` branch is unreachable because both arms execute the identical call. The comment says "deselect (defaults to show-all)" but the code never deselects. This is a logic error: re-clicking 'all' when it is already selected should either be a no-op (acceptable) or toggle it off (if the intent is to show all when nothing is selected). The real issue is both branches of the `if/else` are identical, so the intent is obscured and the `else` dead-code path silently misleads future readers.

**Fix:** Remove the dead `else` arm and make the intent explicit:
```ts
if (chip === 'all') {
  // 'all' is always a no-op re-click: keep 'all' selected.
  onChipsChange(new Set(['all']))
} else {
  const next = new Set(selectedChips)
  next.delete('all')
  if (next.has(chip)) {
    next.delete(chip)
  } else {
    next.add(chip)
  }
  // If the last non-'all' chip was deselected, restore 'all'.
  if (next.size === 0) next.add('all')
  onChipsChange(next)
}
```
Note: if the spec intends "empty selection = show all" then the current behaviour for the `else` branch is also wrong (deselecting the last chip produces an empty Set, not `Set(['all'])`), so the `if (next.size === 0) next.add('all')` guard closes both issues.

### WR-03: `<button>` nested inside `<button>` in ProjectCard — invalid HTML, accessibility violation

**File:** `packages/spa/src/components/ProjectCard.tsx:130-302`

**Issue:** The outer element is a `<button>` (line 130, `ref={cardRef}`). Inside it, three child `<button>` elements are rendered:
1. The kebab button (line 141)
2. The "Unregister?" button (line 178)

Nesting `<button>` inside `<button>` is explicitly invalid HTML (the content model of `<button>` is phrasing content, which excludes interactive elements). Browsers handle this inconsistently — some silently extract inner buttons from the DOM, which breaks event propagation and assistive-technology focus order. The `stopPropagation()` calls on the inner buttons mitigate the click-bubble issue but do not fix the HTML validity or AT focus-order problem.

D-37 specifies the card should be "a `<button>` (or `<a>` if we keep semantics simple)". D-37's own parenthetical "or `<a>`" is the fix path.

**Fix:** Change the outer element from `<button>` to a `<div>` with an explicit click handler, or use `<a>` with `href="/projects/{item.id}"` and intercept with `onClick`. The simplest correct pattern:
```tsx
<div
  ref={cardRef as React.RefObject<HTMLDivElement>}
  role="group"
  aria-label={`View ${item.name}`}
  className={containerClass}
  onClick={handleCardClick}
  onContextMenu={handleContextMenu}
  {...longPress}
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
>
  {/* kebab <button> and "Unregister?" <button> remain valid children */}
</div>
```
Alternatively, use `<a href={...}>` and call `navigate` in `onClick` while preventing default — preserves browser behaviours like middle-click to open in new tab.

### WR-04: Non-null assertion `reg.projects.find(...)!` after write in registry route — may panic if write then read races

**File:** `packages/agent/src/routes/registry.ts:263` and `287`

**Issue:** Both the rename and tags routes do:
```ts
const ok = renameProject(id, body.name, registryFile)
// ...
const reg = readRegistry(registryFile)
const updated = reg.projects.find((p) => p.id === id)!
```
`renameProject` writes the registry atomically and returns `true`, meaning the entry existed at write time. The subsequent `readRegistry` + `find` should always succeed in practice. However, the `!` suppresses a TypeScript check on a value that is `undefined` if something between the write and the re-read removes the entry (e.g., a concurrent `unregister` call between the two file reads). In the current single-process daemon this window is very narrow, but it is reachable under concurrent requests.

**Fix:** Add an explicit guard:
```ts
const updated = reg.projects.find((p) => p.id === id)
if (!updated) {
  return c.json({ ok: false, error: 'project_not_found', requestId: c.get('requestId') }, 404)
}
return outbound(c, RegistryEntrySchema.parse.bind(RegistryEntrySchema), updated)
```

### WR-05: `rateLimiter.ts` sweep interval is not cleared in tests — may leak between test suites

**File:** `packages/agent/src/lib/rateLimiter.ts:61-62`

**Issue:** The module-level `setInterval` (line 61) is started when the module is first imported. The `.unref()` prevents it from keeping Node alive, which is correct for production. However, `_resetForTests()` only clears the store; it does not stop the interval. In test environments (vitest with `vi.useFakeTimers()`), fake timers replace `setInterval`, meaning the sweep fires when `vi.advanceTimersByTime` crosses 60 000 ms. This is unlikely to cause failures in the current test suite, but it is a subtle coupling between module-level side effects and test time control. The same issue exists in `registerNonces.ts` (line 60).

**Fix:** Export a cleanup function or restructure as an injectable factory:
```ts
export function _resetForTests(): void {
  store.clear()
}
// Alternatively, expose the interval handle so tests can cancel it:
export let _sweepHandle: ReturnType<typeof setInterval> | null = sweepHandle
```
The `registerNonces.ts` counterpart should receive the same treatment if fake-timer tests ever advance past 60 s.

---

## Info

### IN-01: `AllowedResponse.expiresAt` typed as `string` in RegisterModal local types but the schema emits a `number`

**File:** `packages/spa/src/components/RegisterModal.tsx:22`

**Issue:** The local `AllowedResponse` interface (lines 13-27) declares `expiresAt: string`. The shared `RegisterPrepareAllowedSchema` in `packages/shared/src/schemas/registry.ts:72` defines `expiresAt: z.number().int()`. The modal never actually uses `expiresAt` beyond storing it in state, so this does not cause a runtime crash. But the type mismatch between the local mirror type and the canonical schema is a maintenance hazard — if `expiresAt` is later used for countdown display it will silently coerce.

**Fix:** Either remove the local mirror types and import `RegisterPrepareResponse` directly from `@agenticapps/dashboard-shared`, or correct the field to `expiresAt: number`.

### IN-02: `parseReviewFile` frontmatter detection uses `?? ` (nullish coalescing) instead of `||` — silently treats zero-count matches as "no frontmatter"

**File:** `packages/agent/src/lib/projectOverview.ts:88`

**Issue:** The condition `if (criticalMatch ?? warningMatch ?? infoMatch)` is truthy only when at least one match is non-null. This is correct. However, using `??` (which only short-circuits on `null`/`undefined`) versus `||` (which also short-circuits on `false`, `0`, empty string) is subtly confusing here: the regex `.match()` returns `null` on no match or a `RegExpMatchArray` on a match, so `??` behaves identically to `||` in this specific case. No bug, but the intent would be clearer as `if (criticalMatch !== null || warningMatch !== null || infoMatch !== null)`.

**Fix:**
```ts
if (criticalMatch !== null || warningMatch !== null || infoMatch !== null) {
```

### IN-03: `HomeToolbar` chip click deselects 'all' but does not restore it when the last chip is deselected — leaves an empty selection

**File:** `packages/spa/src/components/HomeToolbar.tsx:44-55`

**Issue:** (Related to WR-02.) When the user selects 'active' (removing 'all') and then deselects 'active', `next` becomes an empty `Set`. `onChipsChange(new Set())` is emitted. `filterAndSort` treats `selectedChips.size === 0` as "no filter", so functionally this is equivalent to 'all' selected. However, the UI will show no chip as highlighted — confusing, since "all" chip is still present but not aria-pressed. This is purely a UI inconsistency rather than a data bug, but it is worth fixing for clarity.

**Fix:** (Covered by WR-02's fix — add `if (next.size === 0) next.add('all')` after the chip toggle.)

### IN-04: `commandPaletteActions.ts` — `Register project` action dispatches a CustomEvent but `MultiProjectHome` has no listener for `palette:open-register`

**File:** `packages/spa/src/lib/commandPaletteActions.ts:48` and `packages/spa/src/components/MultiProjectHome.tsx`

**Issue:** The Register action fires `window.dispatchEvent(new CustomEvent('palette:open-register'))`. This is a reasonable decoupled pattern for the command palette to trigger the register modal without a prop-drilling callback. However, `MultiProjectHome.tsx` has no `useEffect` or event listener for `'palette:open-register'` — so clicking "Register project" in the palette closes the palette but does not open the register modal. The test for this action (`commandPaletteActions.test.ts:107-124`) only verifies that the event is dispatched; it does not verify the modal opens.

**Fix:** Add a `useEffect` in `MultiProjectHome` (or in a dedicated hook) to listen for `palette:open-register` and call `setRegisterOpen(true)`:
```ts
useEffect(() => {
  function onPaletteRegister() { setRegisterOpen(true) }
  window.addEventListener('palette:open-register', onPaletteRegister)
  return () => window.removeEventListener('palette:open-register', onPaletteRegister)
}, [])
```

### IN-05: `logBlocked` only sanitises `\n` but not `\r` — CRLF log injection still possible

**File:** `packages/agent/src/lib/registerLog.ts:14-15`

**Issue:** `root.replace(/\n/g, '\\n')` and `reason.replace(/\n/g, '\\n')` guard against LF line injection. A carriage return (`\r`) alone can move a terminal cursor to column 0 and overwrite the beginning of the log line. While the daemon's stderr stream is consumed by Donald's own terminal (not a log aggregator with structured parsing), it is good practice.

**Fix:**
```ts
const safeRoot = root.replace(/[\r\n]/g, (c) => c === '\r' ? '\\r' : '\\n')
const safeReason = reason.replace(/[\r\n]/g, (c) => c === '\r' ? '\\r' : '\\n')
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
