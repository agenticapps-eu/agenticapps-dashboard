# Design critique — `/fleet` (add-repo-readiness §9)

**Date**: 2026-08-01
**Target**: `http://localhost:5174/fleet` at 1440×900, light and dark appearance
**Register**: product (PRODUCT.md `register: product`)
**Data**: real, from the local daemon over a temporary dev-server proxy — three
registered repos, one of which (`agenticapps-dashboard`) exercises five of the
six statuses. This is the first time the readiness palette has been rendered
against anything but fixtures.

## Method, and one deviation

`reference/critique.md` asks for two assessments run in isolated sub-agents, so
neither anchors to the other. **They were run sequentially in one context
instead**, because this session carries a standing instruction not to spawn
sub-agents unless asked. The isolation the reference is protecting is therefore
absent, and the LLM scores below should be read as one reviewer's, not two
independent ones converging. Recorded rather than papered over.

The browser-overlay half of Assessment B is also missing: the installed
`impeccable` CLI has no `live` subcommand (`Unknown command: "live"`). The
reference's stated fallback — "if injection fails, continue with CLI results
only" — was taken.

## Assessment B — deterministic detector

```
npx impeccable --json packages/spa/src/components/panels/readiness/   → []  exit 0
npx impeccable --json .../ui/Tooltip.tsx .../ui/Sidebar.tsx           → []  exit 0
```

Zero of the 27 patterns. No gradient text, no side-stripe borders, no
glassmorphism, no hero-metric block, no identical card grid.

## Anti-patterns verdict

**Would someone say "AI made this"? No — and for a structural reason rather than
a stylistic one.** The surface refuses the two moves that mark generated
dashboards: there is no aggregate score anywhere, and there are no cards. Both
refusals are load-bearing and documented (design.md §2, §5). The page helper
says the quiet part out loud — "Count the cells, there is no combined score" —
which reads as a product opinion, not decoration.

The category-reflex check passes at both altitudes. First-order: the obvious
reflex for "readiness dashboard" is a green/amber/red donut or a percentage per
repo, and this has neither. Second-order: the reflex one tier down is
severity-banded colour, and §8.2 explicitly rejected that in favour of colour
answering "is something wrong?" while the boolean carries blocking-ness.

## Design health — Nielsen's 10

Scored before the fixes below, then rescored after. Both are recorded because
the delta is what the gate is for.

| # | Heuristic | Before | After | Key issue |
|---|-----------|:---:|:---:|---|
| 1 | Visibility of system status | 2 | 4 | `generatedAt` was on the wire and never rendered — every reading looked equally current |
| 2 | Match system / real world | 3 | 3 | `Spec 4` still has no unit (carried open question); "Passing with caveats" is a long chip |
| 3 | User control and freedom | 2 | 4 | No way to clear filters, worst in the state where the table is gone |
| 4 | Consistency and standards | 4 | 4 | One status vocabulary drives cells, tooltips and chips from a single map |
| 5 | Error prevention | 3 | 3 | Unknown filter values dropped, not fatal; bounded `at` cannot crash the route |
| 6 | Recognition rather than recall | 3 | 3 | Six shapes have no legend; identity lives in headers and per-cell disclosure |
| 7 | Flexibility and efficiency | 3 | 4 | Filter state round-trips through the URL, so a narrowed view is shareable |
| 8 | Aesthetic and minimalist design | 3 | 3 | Six full-width tints per row is heavier than the information needs |
| 9 | Error recovery | 3 | 3 | Fleet error copy asserts "the daemon did not answer" even on a 401 |
| 10 | Help and documentation | 2 | 3 | No link to a help page for this surface; `/help` is still mostly stubs |
| | **Total** | **28/40** | **34/40** | |
| | **Composite** | **70** | **85** | floor is 80 |

**Before: 70, below the ≥ 80 floor. After the fixes below: 85.**

## What was fixed, and why each mattered

Three findings were acted on in `test(RED)` → `feat(GREEN)` pairs.

**`generatedAt` was never rendered.** The strongest finding, because the daemon
goes to deliberate trouble to make that field trustworthy: it dates a fleet
response by its *oldest* per-repo memo rather than by assembly time, so the
number never overstates freshness (design.md §8). The only client then dropped
it, which is exactly the "every response claims to be current" reading the spec
rules out. Now rendered as `Readings computed 2026-08-01 18:13 UTC`.

**Filters had no exit.** Heuristic 3 names clearing filters explicitly. The
no-match state was the worst case: with the table gone, even the implicit cue
that filtering is happening goes with it. One "Clear filters" control now
appears whenever a filter is active — deliberately *one*, in the toolbar meta
row. The first attempt put a second one in the empty state and a test caught two
identical controls a few pixels apart, which is worse than none.

**A filtered fleet never said what it was hiding.** `2 of 3 repositories` is the
difference between a narrowed list and a list that looks complete.

## Findings not acted on

- **No legend for the six shapes.** A first-time reader meets a dashed circle
  with no key. Left alone deliberately: PRODUCT.md's primary persona is the
  author of the tool, who knows the vocabulary, and every cell already discloses
  itself on hover and focus. A permanent legend would be clutter for the only
  user. Revisit if the audience widens.
- **The fleet error copy asserts too much.** "The daemon did not answer" is
  wrong for a 401, where it answered and refused. Not a stranding bug — a 401
  flips the global repair signal in `queryClient.ts` and the repair banner
  appears — so this is copy, not recovery. Belongs with §10's error work.
- **Six full-width tints per row.** The tint repeats what the glyph already
  says. Full width was chosen on purpose: it took the pointer target from about
  24×22 to 111×22. Density over restraint, knowingly.
- **`Spec 4` has no unit.** Carried open question, already recorded; the unit
  map likely belongs with the deriver, not the cell.
- **The row click is pointer-only.** `<tr onClick>` is not keyboard-operable,
  but the name link inside it reaches the same destination and is, so the
  function is never keyboard-unreachable. Convenience layer over an accessible
  control.

## Measured, not eyeballed

- **No horizontal scrolling at 1440.** `documentElement.scrollWidth === clientWidth === 1440`.
  The only elements reporting overflow are the three `sr-only` spans, 1 px by construction.
- **Header/cell alignment.** Header centre and cell centre agree within 1 px across
  all six check columns. Both fixed during this pass — the cell had `px-3`, so its
  six-fraction grid was 24 px narrower than the six table columns.
- **Cell target.** 111×22 px, up from roughly 24×22 before the Tooltip wrapper
  was allowed to fill its slot.
- **Tab stops.** Six per row, not twelve: `document.querySelectorAll('tbody tr:first-child [tabindex="0"]').length === 0`,
  so the Tooltip wrapper adds none.
- **Disclosure.** Focusing a cell opens the tooltip and the native `title` is
  gone. Real content, e.g. "Security review — stale evidence, 2026-08-01 16:05
  UTC, derived — The passing security review at …/SECURITY.md no longer covers
  the last commit touching production code."

## Artifacts

- `fleet-1440-dark-tooltip.png` — dark, cell focused, disclosure open
- `fleet-1440-light.png` — light, before the fixes
- `fleet-1440-light-final.png` — light, count and freshness line
- `fleet-1440-light-filtered.png` — family filter applied, "2 of 3", clear affordance
- `repo-detail-1440-light.png` — the detail header a row opens
