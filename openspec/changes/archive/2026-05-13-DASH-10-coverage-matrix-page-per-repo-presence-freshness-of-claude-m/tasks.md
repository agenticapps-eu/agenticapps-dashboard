# Tasks — Phase 10: Coverage Matrix Page

All items are complete: this phase shipped on 2026-05-13. Reconstructed from the
PLAN checklists at `docs/legacy-planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/`.

## 10-09

- [x] Page renders 3 family sections (agenticapps, factiv, neuroflash).
- [x] Each family header shows aggregate counts (worst-state-wins).
- [x] GitNexus column shows ⚪ Not installed for every row + per-family install hint inside header (current dev machine — gitnexus absent).
- [x] Click [✕ missing] chip → URL becomes `/coverage?status=missing`; matrix filters.
- [x] Type "agent" in search → URL becomes `?status=missing&q=agent` after 200ms; matrix filters further.
- [x] Click [all] chip → URL clears status; matrix unfilters.
- [x] Hover a row → refresh icon appears; click → popover with available remediations.
- [x] Click an option (e.g. "Copy /wiki-compile") → clipboard receives the string; toast appears (if implemented).
- [x] Press Esc → popover dismisses.
- [x] Click Refresh-all-stale → confirm dialog appears; click confirm → button text becomes "Refreshing 1 of N…", "Refreshing 2 of N…", etc.
- [x] Press Tab from page-header → focus reaches the toolbar → first family section → first row → override chip (if any) → refresh action.
- [x] No console errors during the walkthrough.
