# State-channel audit — §3 bullet 4

**Requirement:** `design-system` → *State Is Never Signalled By Colour Alone*.
Any element communicating a state encodes it through at least one channel
besides colour — shape, fill, pattern, glyph, or text — and no state is
identified only by its hue.

**Date:** 2026-08-05 · **Scope:** the four post-cutover surfaces (fleet, repo
detail, workflow conformance, agent-change board) plus the shell.

**Census method.** Every `.tsx` under `packages/spa/src` referencing
`status-success`, `status-warning`, `status-error`, `status-info` or
`accent-bg-strong` — 20 files — then each `ui/` primitive by hand, because a
primitive can bear state without naming a status token (`StatusPill` and
`Pill` both do, and neither would have surfaced from a status-token grep
alone).

## Findings

| Element | State it carries | Non-colour channel | Verdict |
|---|---|---|---|
| `ReadinessIndicator` | six check statuses | distinct lucide glyph per status | conformant — asserted, now in both appearances |
| `SidebarItem` | navigation-current | filled pill where inactive has no fill, plus `aria-current="page"` | conformant — asserted, now in both appearances |
| `ReadyVerdict` (fleet + detail) | ready / not ready | the words "Ready" / "Not ready" | conformant |
| `WorkflowPage` — `stateTextClass` | core, artifact and provenance states | `capitalized(state)` rendered beside every colour, all three call sites | conformant |
| `WorkflowPage` — `resultClass` | harness result | `resultLabel` — "Passed", "Failed", "Busy", "Refused", "Timed out", "Bound exceeded" | conformant |
| `ChangeCard` source badge | ready to archive | `●` glyph plus the words | conformant |
| `ChangeCard` reviewer line | changes requested | the words "Changes requested" | conformant |
| `ChangeDrawer` artifact list | present / missing | the words "present" / "missing"; the delta-spec row shows the count itself | conformant |
| `ChangeBoardPage` degradation notices | per-repository failure | `AlertTriangle` | conformant |
| `Toast` | success / error | `✓` / `✕` glyph, plus `role="status"` vs `role="alert"` | conformant |
| `RepairBanner`, `SchemaDriftState` | error | `AlertTriangle` | conformant |
| `RepoDetailPage` notices (editor, rescan, readiness) | error / warning | `AlertTriangle` | conformant |
| `RepoDetailPage` evidence failure | unreadable file | the sentence "Could not read {path}." | conformant |
| `StatusPill` | none — emphasis only | always renders `label · value` | not state-bearing |
| `FleetToolbar` chips | filter selected | `aria-pressed`, and a border differing in **lightness** (`border-accent` vs `border-border-subtle`), not only in hue | conformant |
| **`Pill`** | **`success` / `warning` / `error`** | **none — identical `bg-card-bg-hover`, differing only in text hue** | **violation (latent)** |

## The one finding, and why it was latent

`Pill`'s three status variants sat on the same background as `neutral` and
changed only the text colour. No glyph, no shape, no border, no fill
difference. A reader who does not separate the hues sees four identical tags.

It was **latent**, not live: `neutral` in `TopBar` is the only `<Pill>` in the
product, so no rendered element ever violated the requirement. What existed was
a primitive that made the violation a one-word change — and `Pill.test.tsx`'s
P1 pinned the arrangement in place as "5 variants each produce a distinct
className", where *distinct by hue* is the very thing the requirement forbids.

**Resolution: the three variants are removed** rather than given a glyph.
Adding a channel would be designing an API for callers that do not exist; a
pill that carries a state needs a second channel, and the shape of that channel
should be decided by whatever first needs one — as `ChangeCard`'s badge decided
on `●` and the readiness cells on six glyphs. Removing them changed no pixel.
`Pill.test.tsx` now asserts the variant set is exactly `neutral` and `accent`,
so they cannot return unaccompanied.

## Evidence

Three assertions added. One was RED; the two covering already-conformant
elements were proven by mutation instead, since a test never watched failing is
not evidence that it checks anything.

| Mutation | Result |
|---|---|
| active item's fill removed (`bg-accent-bg-strong` → `text-accent`) | 4 tests fail, both new sidebar cases among them |
| `dark:bg-transparent` added beside the fill | **only** the two new cases fail — `SI2` stays green, which is why "carries a `bg-` class" was not a sufficient check |
| readiness glyph unified in dark only | the new dark case fails; the existing light-only shape test stays green |

The third mutation also exposed test pollution: `.dark` set in a body that then
throws is inherited by every later test in the file. Removal moved to
`afterEach`.

**Limit of the sidebar assertion, stated so it is not over-read.** jsdom applies
no stylesheet, so it checks which utilities are *declared*, not what they
measure on screen. Legibility of the fill in each appearance is
`verify-contrast.test.ts`'s job and is asserted there against both palettes.
