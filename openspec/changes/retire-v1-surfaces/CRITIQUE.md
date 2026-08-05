# Design critique — the two-section sidebar

**Route:** `/fleet` (the shell is the subject; the fleet is where it was measured)
**Viewports:** 1440×900 (reference), compact
**Method:** `impeccable:critique` — live page, real fleet data (3 registered
repositories), light and dark, not mocks.
**Date:** 2026-08-05 · **Ratified floor:** composite ≥ 80 (32/40)

**Deviation from the method, recorded rather than hidden.** The skill requires
two assessments in isolated sub-agents so neither anchors to the other. This
session carries a standing instruction not to spawn agents unless asked, so the
design assessment and the deterministic scan were run sequentially in one head.
The scan is deterministic and cannot be anchored; the design assessment can be,
and a reader should discount it accordingly. Everything below that is stated as
a number was measured in the browser, which is the part that does not depend on
who ran it.

---

## Design health score

**Composite 82.5 (33/40).** Above the ratified floor of 80.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | **4** | Current entry carries `aria-current="page"` *and* a filled pill; `/repos/:id` marks Fleet readiness too |
| 2 | Match system / real world | 3 | "UTILITIES" is a systems word; "WORKSPACE" names no thing the user has |
| 3 | User control and freedom | 3 | Compact nav toggle announces expansion without naming what it opens |
| 4 | Consistency and standards | **4** | One primitive, identical padding and type across all five entries; detector clean |
| 5 | Error prevention | 3 | Near-vacuous for navigation — but nothing now points at an address that redirects |
| 6 | Recognition over recall | 3 | Nothing distinguishes what "Workflow" answers from what "Changes" answers |
| 7 | Flexibility and efficiency | **4** | ⌘K is advertised in the top bar and reaches any repo; five tab stops total |
| 8 | Aesthetic and minimalist | 3 | The reduction *is* the minimalism; it leaves 573px of empty column behind it |
| 9 | Error recovery | 3 | No error state of its own; the route's belong to the fleet |
| 10 | Help and documentation | 3 | Help is one click and always visible; nothing explains the two groups |

**Cognitive load: 0 of 8 failures — low.** Five options at the only decision
point, under the flag-at-four threshold, and one visual level throughout.

---

## Anti-patterns verdict

**Does this look AI-generated? No.**

**Deterministic scan.** `impeccable detect --json` over `Sidebar.tsx`,
`AppShellV2.tsx`, `SidebarItem.tsx`, `SidebarSection.tsx`, `TopBar.tsx` and
`FleetPage.tsx` returned `[]` on all six — exit 0. No side-stripe borders, no
gradient text, no glassmorphism, no hero-metric block, no identical card grid.

**Design assessment.** The absolute bans are absent and so are the subtler
tells. The sidebar is not a card, does not float, has no elevation it did not
earn, and carries one accent used once — on the entry you are actually on. The
type scale is flat by intent (11px section labels, 12px entries) and the
hierarchy is carried by case, weight and colour rather than size, which is the
right call in a 240px column.

The category-reflex check passes at both altitudes. First-order: a developer
fleet dashboard "should" be dark navy with a neon accent; this is warm off-white
`rgb(248, 246, 243)` in light and near-black `rgb(21, 18, 25)` in dark, with a
single violet. Second-order: having avoided dark-blue-SaaS, the next reflex is
terminal-native monospace-everything, and it avoids that too.

---

## What's working

**The keyboard result is the strongest evidence the change did what it claimed.**
Measured on the live page: 42 tab stops total, the skip link at index 0, and the
whole of navigation at indices **2–6, contiguous**. Before the reduction the
same sidebar was 13 nav stops with three repositories registered — one Projects
entry, three project sub-items, three content entries, three Observability
entries, one Code Intelligence entry, two account entries — and it grew by one
for every repository added. It is now five, and it is five at any registry size.
That is the requirement's own scenario ("the sidebar's height is unchanged by
their number") holding as a measurement rather than as a claim.

**Contrast passes everywhere, both themes, with room.** Minimum measured **4.71**
in light (the section labels, `rgb(112, 107, 133)` on `rgb(248, 246, 243)`) and
**5.18** in dark, against a 4.5 body floor. The active pill measures 6.42 light.
No entry depends on colour alone: `aria-current="page"` is on the current entry
and absent from every other, so the marking survives with colour removed.

**One primitive, and it is visible in the numbers.** Every entry: `8px 12px`
padding, 12px/500 type, 33px box. The `pl-9` indentation that the project
sub-list used is gone from the document. A reader cannot infer a hierarchy that
is not there, which is what the mixed-primitive version invited.

---

## Priority issues

### [P2] The sidebar is 68% empty

Measured: the nav column is 836px tall and its last entry ends at y=327 —
**573px of empty column** below Help at 1440×900. The page beside it ends 459px
short of the fold with three repositories. Better than half the reference
viewport is blank.

**Why it matters.** This is the honest shape of a five-destination product and
padding it out would be worse — inventing entries to fill a column is exactly
the failure the withdrawal was correcting. But an empty 240px rail still reads
as an unfinished panel rather than a deliberate one, and a first-time reader
cannot tell which it is. The question is not "what else goes here" but "should a
240px fixed rail be the shape at all when it holds five things".

**Fix.** Not more entries. Either let the rail earn its width (a persistent
fleet summary under the nav — counts of repositories not ready, which the fleet
query already has in hand), or let the shell reclaim the space. Both are real
design changes and neither belongs in a withdrawal commit.

**Suggested command:** `$impeccable layout`

### [P2] "Fleet readiness" appears three times in the top-left quadrant

Measured occurrences on one screen: the sidebar entry at (48, 148), a top-bar
label at (264, 21), and the `<h1>` at (264, 62). The second and third are the
same words, same x, **41 pixels apart vertically**.

**Why it matters.** The top-bar label restates the heading directly beneath it
and tells the reader nothing the heading does not. It was easier to overlook
when four sections and a project list competed for attention; with the sidebar
reduced, this repetition is the most conspicuous text pattern left on the page.

**Pre-existing.** `TopBar` is untouched by this change. The reduction did not
create it, it exposed it.

**Fix.** The top-bar slot should carry what the heading cannot — the fleet's
freshness stamp, or nothing.

**Suggested command:** `$impeccable clarify`

### [P2] The compact nav toggle announces a state without naming what has it

Measured at compact width: the button labelled "Open navigation" carries
`aria-expanded="false"` and `aria-controls` **null**. The panel it opens has
`id="shell-navigation-panel"` — an id whose only purpose is to be referenced —
and a document-wide sweep found **zero** elements using `aria-controls` at all.

**Why it matters.** A screen-reader user is told something is collapsed and not
told what. The id's existence is good evidence the wiring was intended and
dropped rather than declined.

**Pre-existing**, and one attribute to fix.

**Suggested command:** `$impeccable harden`

### [P3] "WORKSPACE" names nothing the reader has

The label survived from the four-section IA, where it distinguished project work
from observability. With observability gone it distinguishes its three entries
from Settings and Help — which "UTILITIES" already does from the other side. It
now carries no information.

**Why it matters.** Small. A first-timer cannot predict from "WORKSPACE" that
Workflow, Fleet readiness and Changes are all fleet-wide rather than
per-project, which is the single most useful thing a label could say here.

**Fix.** A word that names the scope — the surfaces answer questions *about the
fleet*. Deliberately not changed in this commit: the requirement fixes peer
order and section count, and renaming a group is an IA decision that wants its
own reasoning.

**Suggested command:** `$impeccable clarify`

---

## Persona red flags

**Donald (primary persona — solo operator, power user of his own tool).** No red
flags in the navigation itself. ⌘K is advertised in the top bar and jumps to any
repo in two keystrokes plus a name; the sidebar is five tab stops; the current
surface is marked at `/repos/:id` as well as `/fleet`, so mid-triage he is never
represented as being nowhere. One friction worth naming: the sub-list he used to
scan — three repositories with reachability dots, visible without navigating —
is gone, and the fleet table is now the only place that answers "which of these
is reachable". That is the requirement's intent, and it costs him a glance he
used to get for free from any page.

**Jordan (first-timer).** Reaches the fleet from `/` and sees five labelled
destinations, all with icons and words, none icon-only. Two failures: nothing on
screen distinguishes what "Workflow" answers from what "Changes" answers, and
"WORKSPACE" does not help; and Help is present but nothing points at it at the
moment of confusion. Will not abandon — the labels are plain English and the
page beside them is legible — but will click two wrong entries first.

**Alex (power user, not this product's user).** Would want the rail collapsible
at desk width, which it is not: below the compact boundary it becomes a panel,
above it the 240px track is unconditional. With 68% of it empty, that is 240px
of permanent chrome for five links.

---

## Minor observations

- The logo now targets `/fleet` rather than `/`. `/` still answers by
  redirecting, so this was invisible to every test — it is asserted explicitly
  now, because the product should not route its own chrome through a location it
  withdrew.
- `RegisterModal` is mounted unconditionally on the fleet. Verified it is inert
  when closed: `dialog.open === false`, `display: none`, close button not
  tabbable and `offsetParent === null`. This was a real risk of the
  always-mounted shape and it did not materialise.
- One measurement in the first probe read 1.08:1 for the active entry's inner
  `<span>`. False positive of the probe, not a finding: the span inherits white
  and the pill background sits on the parent `<a>`, which measures 6.42.
- Section labels are 11px. That is inside the bounded scale and legible at
  4.71:1, but it is the smallest type in the product.
- **The top bar builds a confident breadcrumb for a page that does not exist.**
  At `/projects/agenticapps-dashboard/coverage` — an address the product never
  served — `#main` correctly reads exactly "Not Found", while the bar above it
  reads "All Projects › agenticapps-dashboard › Changes · 3", complete with a
  count. It is deriving context from URL segments without asking whether a route
  matched. Pre-existing, and the least trustworthy thing on a not-found screen:
  every word of it is invented.

---

## Questions to consider

- If the rail holds five links and 573px of nothing, is a fixed 240px rail still
  the right shell, or is this the moment the shell should change shape?
- "WORKSPACE" and "UTILITIES" are both labels about the *product's* structure.
  What would they be if they named what the reader is trying to do?
- The top bar repeats the page heading. What would it carry if it were allowed
  to say something the heading cannot?
