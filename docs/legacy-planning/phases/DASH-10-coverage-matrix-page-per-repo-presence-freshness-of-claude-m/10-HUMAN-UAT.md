# Phase 10 Human UAT — Coverage Matrix Page

**Phase:** 10 — coverage-matrix-page-per-repo-presence-freshness-of-claude-m  
**Prepared by:** plan executor (claude-sonnet-4-6) — 10-09-PLAN.md Task 6  
**Sign-off required by:** Donald Vlahovic (donald.vlahovic@neuro-flash.com)  
**When to run:** Before opening the merge PR from `phase-10-coverage-matrix` → `main`.

**Prerequisites:**

- Branch `phase-10-coverage-matrix` checked out.
- Daemon built and running: `pnpm --filter @agenticapps/dashboard-agent build && agentic-dashboard start`
- SPA dev server running: `pnpm --filter @agenticapps/dashboard-spa dev`
- Browser open at `http://localhost:5174` — pair flow completed.

---

## Scenario 1: Cross-family read happens daemon-side; no project FS writes during scan/refresh (INV-01)

**Requirement mapped:** INV-01 — No daemon route writes to a registered project's filesystem.  
**Why this is manual:** Filesystem-write absence is a negative property; a unit test cannot exhaustively prove that no file was written without watching the entire FS during the operation.

**Steps:**

1. Stage a clean checkout of any registered project (e.g. `agenticapps-dashboard` itself):
   ```bash
   cd ~/Sourcecode/agenticapps/agenticapps-dashboard
   git status   # record baseline — should be clean
   ```
2. Open `http://localhost:5174/coverage` in the dashboard.
3. Click the **Refresh all stale** button in the page header. Confirm dialog → click Confirm.
4. Wait for the refresh loop to complete (button text returns to non-"Refreshing" state).
5. Return to each registered project root and run:
   ```bash
   git status
   ```
   Expected: **0 modifications** in ALL projects. `~/.gitnexus/` may have changed (gitnexus writes there — that's its own storage, not a registered project), but no project's `.planning/`, source files, or any other file should be touched.
6. Optionally: repeat with a single-row refresh (hover over a row → refresh icon → click an action).

**Expected:** `git status` returns "nothing to commit, working tree clean" in every registered project. The daemon's only filesystem writes during Phase 10 are to `~/.gitnexus/` when gitnexus is installed and a gitnexus-analyze action is dispatched.

## Result

Pass / Fail / Notes: _______________________

---

## Scenario 2: ~/.agenticapps/dashboard/ permissions remain 0600 post-Phase-10 (INV-02)

**Requirement mapped:** INV-02 — Registry, auth, env files in `~/.agenticapps/dashboard/` enforce mode 0600.  
**Why this is manual:** File mode inheritance is not reliably observable from a unit test in the agent's test harness.

**Steps:**

1. After Phase 10 lands (daemon started at least once post-merge), run:
   ```bash
   stat -f "%p %N" ~/.agenticapps/dashboard/auth.json
   stat -f "%p %N" ~/.agenticapps/dashboard/registry.json
   ```
2. Expected output for each: last 3 digits of the mode field = `600`. Example:
   ```
   100600 /Users/donald/.agenticapps/dashboard/auth.json
   ```
3. If any file shows `644` or `755`, the Phase 1 permission guard has regressed — stop and investigate before merging.

**Expected:** All files in `~/.agenticapps/dashboard/` have mode `0600`. Phase 10 adds no new files to this directory; the check confirms no regression.

## Result

Pass / Fail / Notes: _______________________

---

## Scenario 3: D-10-01 pull-with-30s-cache UX feels right

**Requirement mapped:** D-10-01 — 30s daemon-side memo cache; COV-03 — cold-load < 1s.  
**Why this is manual:** Cache timing and perceived latency require a live human judgment call.

**Steps:**

1. Visit `http://localhost:5174/coverage`.
2. Note how quickly the page loads. Expected: matrix appears within 1 second on first load (cold scan of ~45 repos via file-stat only).
3. Reload the page (Cmd+R). Expected: the response should be near-instant (sub-100ms, noticeably faster than the first load) — the 30s cache is in effect.
4. Wait 30 seconds (use a timer), then reload again. Expected: a brief pause (the cold scan runs again, re-populating the cache). This is the cache expiry being hit.
5. Check the `generatedAtIso` field visible in the Network tab (or in the JSON response from `GET /api/coverage`) — it should advance to the current time on the post-30s reload and stay the same on repeated reloads within the window.

**Expected:** Cold load ≤ 1s; cached reload noticeably faster; after 30s cache expiry, a fresh scan runs.

## Result

Pass / Fail / Notes: _______________________

---

## Scenario 4: D-10-02 per-row refresh + clipboard for unsafe (D-10-09 amendment)

**Requirement mapped:** D-10-02 (per-row refresh), D-10-09 (clipboard-only for unsafe), COV-04 (refresh contract).  
**Why this is manual:** Clipboard write and popover interaction require a live browser and human verification.

**Steps:**

**Part A — Clipboard action for wiki-stale row:**
1. Find a row where the Wiki column shows stale or missing (most neuroflash repos will have wiki = missing since the neuroflash wiki only references 8 of 33 repos).
2. Hover over the row → a refresh icon (↻) appears at the far right.
3. Click the refresh icon → a popover appears with available remediation options.
4. Click **"Copy /wiki-compile command"** (or similar label).
5. Expected: clipboard receives `cd ~/Sourcecode/<family> && claude /wiki-compile`. Paste into terminal and verify the string is valid (don't run it — just confirm the format).
6. Expected: a toast notification appears confirming copy (or fallback behavior if Clipboard API is unavailable).
7. Press **Escape** → popover dismisses.

**Part B — Daemon-spawnable action (requires gitnexus installed):**

*Skip this sub-section if gitnexus is not installed — Scenario 4 passes on clipboard action alone.*

If gitnexus IS installed (`which gitnexus` returns a path):
1. Find a row where GitNexus = stale or missing.
2. Click refresh icon → popover → click **"Run gitnexus analyze for this repo"**.
3. Expected: popover closes; a brief loading indicator appears on the row (or the page refreshes data after a delay); after completion the row's GitNexus cell updates to `fresh` (or `stale` if the analysis determined it is still within the 14-day window).
4. Check `~/.gitnexus/` — `gitnexus analyze` should have updated the registry entry.

**Expected:** Clipboard actions deliver correct strings; daemon-spawn action (when gitnexus is installed) triggers analysis and updates the row.

## Result

Pass / Fail / Notes: _______________________

---

## Scenario 5: D-10-03 grouped sections + filter-aware aggregate counts

**Requirement mapped:** D-10-03 (grouped sections), COV-05 (sticky headers + aggregate), COV-06 (filter state + aggregate reflects filtered view).  
**Why this is manual:** Aggregate count correctness under filtering is a visual contract that requires live browser state inspection.

**Steps:**

1. Visit `http://localhost:5174/coverage`. Confirm 3 family sections render (agenticapps, factiv, neuroflash), each with a sticky header showing `✕ N missing · ⚠ N stale · ✓ N fresh`.
2. Record the unfiltered aggregate counts for each family section.
3. Click the **[✕ missing]** filter chip in the toolbar.
4. Expected:
   - URL becomes `/coverage?status=missing`.
   - Each family section shows only rows that have at least one `missing` cell.
   - The aggregate counts in each family sticky header update to reflect the FILTERED rows only (not the unfiltered totals from step 2).
5. Click the **[⚠ stale]** chip to add it to the selection.
6. Expected:
   - URL becomes `/coverage?status=missing,stale` (or similar multi-value form).
   - Both missing and stale rows visible; aggregate counts reflect the union.
7. Click the **[all]** chip.
8. Expected: filter clears; URL drops the status param; all rows return; aggregate counts return to the step 2 values.
9. Click the **collapse toggle** (▼) on the agenticapps family header.
10. Expected: agenticapps rows collapse. Reload the page.
11. Expected: agenticapps remains collapsed — localStorage persistence (`coverage:section-collapsed:agenticapps`) working.

**Expected:** Filter chips affect all family sections simultaneously. Aggregate counts in each family header reflect the filtered view (not the total). Collapse state persists across reload.

## Result

Pass / Fail / Notes: _______________________

---

## Scenario 6: D-10-04 override chip — graceful empty state when no sentinels exist (Pitfall 5)

**Requirement mapped:** D-10-04 (override chip), COV-07 (chip absent when count 0; git-log timestamp).  
**Why this is manual:** Requires creating a real sentinel file in a real git repo and verifying the chip reflects the exact git commit date.

**Steps:**

**Part A — Confirm empty state on current machine:**

1. On the current dev machine (0 sentinels across all repos), visit `/coverage`.
2. Confirm: **NO override chip renders on any row.** There should be no "0 overrides" text — literally no chip element visible. (The OverrideChip component renders nothing when `count === 0`.)

**Part B — Create a sentinel and verify the chip:**

1. Choose a small registered repo (e.g. `agenticapps-dashboard` itself or a factiv repo).
2. Create a sentinel file:
   ```bash
   cd ~/Sourcecode/<family>/<repo>
   mkdir -p .planning/phases/TEST-override-scenario
   touch .planning/phases/TEST-override-scenario/multi-ai-review-skipped
   git add .planning/phases/TEST-override-scenario/multi-ai-review-skipped
   git commit -m "test: add override sentinel for UAT scenario 6"
   ```
3. Record the exact commit ISO timestamp:
   ```bash
   git log -1 --format=%aI -- .planning/phases/TEST-override-scenario/multi-ai-review-skipped
   ```
   Example: `2026-05-13T15:00:00+02:00`
4. Reload `/coverage` (or wait for the 30s cache to expire, then reload).
5. Find the row for the repo you modified. Expected:
   - An **"⚠ 1 override"** chip appears next to the repo name.
   - Click the chip → an inline list expands showing: `TEST-override-scenario — sentinel since 2026-05-13` (or the date from step 3).
   - The date **MUST match** the `git log` output from step 3 — NOT the file mtime (which may differ).
6. Clean up:
   ```bash
   cd ~/Sourcecode/<family>/<repo>
   rm -rf .planning/phases/TEST-override-scenario
   git add -A
   git commit -m "test: remove override sentinel (UAT cleanup)"
   ```

**Expected Part A:** No override chip anywhere when count = 0. **Expected Part B:** Override chip appears with correct count; expanded list shows git commit date matching `git log -1 --format=%aI`, not file mtime.

## Result

Pass / Fail / Notes: _______________________

---

## UAT Sign-Off

| Scenario | Description | Pass/Fail | Date | Notes |
|----------|-------------|-----------|------|-------|
| 1 | INV-01 — No project FS writes during scan/refresh | | | |
| 2 | INV-02 — ~/.agenticapps/dashboard/ permissions 0600 | | | |
| 3 | D-10-01 — 30s cache UX; cold-load < 1s | | | |
| 4 | D-10-02/D-10-09 — per-row refresh + clipboard | | | |
| 5 | D-10-03/COV-05/COV-06 — grouped sections + filter-aware counts | | | |
| 6 | D-10-04/COV-07 — override chip; git-log timestamp | | | |

**Overall UAT result:** PASS / FAIL (circle one)

**Sign-off:** _________________________ Date: _____________

**Known gaps (documented by Phase 10 scope decisions):**

- `GSD_SKIP_REVIEWS=1` env-var override is undetectable (no on-disk trace). Not surfaced by the override chip. Documented in CONTEXT.md deferred section.
- Refresh-all-stale serialization (D-10-02 "sequential to avoid concurrent index writes") can only be verified when gitnexus is installed and multiple repos are stale simultaneously — deferred to post-install verification.
- Live impeccable critique score (gate ≥ 90 at 1440x900) — covered separately in 10-IMPECCABLE.md (Tasks 4 + 5 of 10-09 plan, deferred to user execution with dev server).

---

*Scaffold authored by plan executor (claude-sonnet-4-6) as part of 10-09-PLAN.md Task 6.*  
*Actual walkthrough sign-off happens before opening the merge PR.*
