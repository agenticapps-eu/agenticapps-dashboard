# Tasks — Phase 7: Help docs v1.0

All items are complete: this phase shipped on 2026-05-12. Reconstructed from the
PLAN checklists at `docs/legacy-planning/phases/07-help-docs-v1-0/`.

## 07-01

- [x] HELP-01: 5 anchor MDX pages (`/help`, `/help/workflow/overview`, `/help/repos/overview`, `/help/observability/overview`, `/help/operations/install`) render with frontmatter (slug/title/order/sectio...
- [x] HELP-02: 29 stub paths (workflow ×11 including rationalization-table + red-flags; repos ×6; observability ×7; operations ×4; reference ×4 minus the now-ready `shortcuts`) render `<ComingSoon sectio...
- [x] HELP-03: `HelpLayout` renders sidebar (collapsed-on-mobile drawer; sticky-on-desktop nav) + main `<article className="prose">` content; zero console errors on any anchor route
- [x] HELP-04: `<HelpWidget name="..." />` dispatches the 8 named widget stubs (RepoTopologyMap, WorkflowStateMachine, GatePicker, TraceVisualizer, ScanReportPlayground, ApplyConsentSimulator, MigrationD...
- [x] HELP-05: `<HelpHook topic="..." />` component compiles and exports cleanly; pure `topicToUrl()` returns expected `/help/<segments>` URLs with optional `#anchor` (consumer wiring deferred to v1.1)
- [x] HELP-06: existing `/help` keyboard-shortcuts page replaced by docs landing; shortcuts content lives at `/help/reference/shortcuts` MDX page rendering the `KbdHint` table; `?` keyboard shortcut stil...

## 07-05

- [x] All HELP-01..HELP-06 ✅
- [x] All ROADMAP S1..S8 met
- [x] Pre-flight green
- [x] Playwright green
- [x] Impeccable ≥ 90
- [x] /browse screenshots committed
- [x] 07-UAT.md filled
- [x] Two-stage review run (post-merge gate)
