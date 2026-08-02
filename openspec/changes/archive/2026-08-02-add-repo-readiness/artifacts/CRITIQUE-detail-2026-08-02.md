# Design critique — `/repos/:repoId` and `/fleet`

**Change:** `add-repo-readiness` §10 (repo detail surface, AGE-466), with §9's fleet
re-reviewed because §10 is only reachable through it.
**Date:** 2026-08-02.
**Viewport:** 1440×900, light (stored default) and dark (PRODUCT.md's stated primary).
**Data:** the live daemon on `127.0.0.1:5193`, three registered repos
(`agenticapps-dashboard`, `cparx`, `fx-signal-agent`). Not fixtures.

## Procedure, and two corrections to it

Both assessments ran in **separate sub-agent contexts**, neither able to see the
other. That isolation is what makes the combined score worth anything, and it is
the first time this change has had it — §9's critique and §7's security review
both ran sequentially in one head under a no-subagent policy, and both said so.

Two corrections to how this gate has been run before:

1. **`npx impeccable --json <path>` is not a scan.** It prints `[]` and exits 0
   regardless of input. The real command is `impeccable detect --json <path>`.
   §9's critique used the bare form, so **its "static scan clean" result
   established nothing** — it was a no-op reported as a pass. This run used
   `detect`, and validated it first against a canary file containing a purple
   gradient and `animate-bounce`, which correctly returned exit 2 with two
   findings. The clean results below are real.
2. **`impeccable live` does not exist** in the installed CLI (3.5.0). Its
   subcommands are `detect`, `ignores`, `help`, `install`, `link`, `update`,
   `check`. §9's critique recorded this too. The overlay half was **not** simply
   skipped this time: `detect` accepts URLs and renders through Puppeteer, which
   is the rendered-DOM pass the overlay was for, and every finding was then
   verified against the live DOM.

One environment note: the `claude-in-chrome` extension was not connected, so both
assessments drove Chrome through the chrome-devtools MCP instead. The stored
pairing in that profile was a placeholder pointing at the SPA rather than the
daemon, so the first load showed the fleet error state; it was re-paired with
`agentic-dashboard pair` before review.

## Design health — Nielsen's 10

Scored on the surfaces as found, then rescored after the fixes below.

| # | Heuristic | Before | After | Key issue |
|---|-----------|:---:|:---:|---|
| 1 | Visibility of system status | 3 | 3 | `generatedAt` is rendered on both routes, which is rare and right. Rows are sorted by a five-key severity comparison and **nothing on screen says so** — "Repository" reads as a sortable header and is not one |
| 2 | Match system / real world | 4 | 4 | Status words are domain-true; the threshold renders as "66.42 of 80", not a bare number |
| 3 | User control and freedom | 2 | 4 | Breadcrumb said "All Projects" on the detail, no sidebar item was active, no way back — the bottom of the triage loop was a dead end |
| 4 | Consistency and standards | 2 | 3 | Pen test contradicted itself (fixed). Four vocabularies for time across two screens remain: "Last change (UTC)", "Readings computed", "Readiness as of", "Observed" |
| 5 | Error prevention | 3 | 3 | `neuroflash` and `other` chips are offered against a registry containing none — a control whose only outcome is the empty state |
| 6 | Recognition rather than recall | 3 | 3 | Filter `<legend>`s are `sr-only`, so a sighted reader sees two unlabelled chip clusters distinguished only by gap width |
| 7 | Flexibility and efficiency | 3 | 4 | The detail header's six pills were inert on a 1648px page with six anchored blocks; they are the jump nav now |
| 8 | Aesthetic and minimalist design | 3 | 3 | Cells no longer read as skeletons, but light theme still washes out the tints and the Readiness column is a permanent constant |
| 9 | Error recovery | 4 | 4 | Eight distinct states, each with a distinct cause and sentence. `ErrorState` says *why* there is no cached fallback |
| 10 | Help and documentation | 3 | 3 | Every check carries a remedy naming the exact file to write. Still no link to help from either surface; `/help` remains 11-of-12 stubs |
| | **Total** | **30/40** | **34/40** | |
| | **Composite** | **75** | **85** | floor is 80 |

**Before: 75, below the ≥ 80 floor. After the fixes below: 85.**

## Anti-patterns verdict

**Not AI-generated, and the copy is why.** Against the explicit bans: no
side-stripe borders (only 1px neutral row rules), no gradient text, no
decorative glassmorphism (depth is one surface step, which is exactly what
PRODUCT.md's Vercel/Netlify anti-reference asks for), no hero-metric template —
the page helper says outright "there is no combined score" — and evidence opens
inline rather than in a modal.

The tell that a model did not write this unprompted: "Derived by the daemon from
this repo, with no single file behind it." "Every registered repository was
excluded by the current selection." "1 repository / 3 repositories" with a code
comment explaining why the plural matters.

One slop-adjacent surface was found and fixed — see the first P1 below.

**Deterministic scan.** `detect` over the readiness panel, `Tooltip.tsx` and
`SchemaDriftState.tsx`: `[]`, exit 0, genuinely clean. Widened to all of
`packages/spa/src`, five findings, **all five false positives of the same kind**
— the detector's regex matching *negative assertions* inside test files
(`expect(cardContent).not.toContain('animate-bounce')`). The codebase is being
flagged for the tests that enforce the rules the detector checks.

Rendered scan, six findings across the two routes: one true positive (below),
three false positives verified against the live DOM (`elementsAnimatingBounce`
and `elementsTransitioningMaxHeight` are both empty on both routes), and one
misdiagnosis — `flat-type-hierarchy` claimed sizes 11/12/13/16px and missed the
24px `<h1>`, so its 1.5:1 ratio claim is wrong.

## What was fixed, and why each mattered

Four findings acted on, each `test(RED)` → `feat(GREEN)` or `fix:`.

### P0 — the Pen test block contradicted itself, and this critique caught my own regression

Provenance read *"Derived by the daemon from this repo, with no single file
behind it"* four lines above a remedy reading *"This check is never derived."*

That fallback string was added **the same day**, fixing a different real defect:
a derived check with no evidence used to render a bare "Derived", naming
nothing, which failed the spec scenario "Provenance is stated" on every healthy
repo. The fix branched on shape (`source !== 'declared' && evidence === null`),
which is exactly the shape a never-run declaration-only check presents.

Pen-test sits at `never` across the whole fleet until someone declares one, so
this was the most-read block on the page — on the surface whose entire job is
provenance. `never` is now answered first and on its own: **Nothing observed
yet**.

### P0 — `/repos/:id` represented the reader as being nowhere

Breadcrumb read "All Projects". No sidebar item highlighted. No back link. The
route was reachable only from `/fleet` and offered no way back to it, which
breaks the one navigational promise the feature makes: cell → detail → back.

The crumb now reads `Fleet readiness / <repo>` with the first segment linking to
`/fleet`, and `SidebarItem` gained `alsoActiveFor` so `/fleet` owns the
`/repos` subtree.

### P1 — the fleet's status cells read as loading skeletons

Each compact cell was a 111×22px tinted bar carrying a single 14px glyph — an 8%
ink-to-surface ratio — and `never` used `CircleDashed`, the lucide spinner
silhouette. The page's own `LoadingState` is the same grey rounded bar with an
animation added. So the most common status across a young fleet rendered as "not
loaded yet", and at fifteen repos the table would be a field of ninety
placeholders.

Capped to a 32px chip (`mx-auto w-8`), which leaves the six-track grid — and
therefore the column-header alignment measured at 1440 — untouched. `Minus`
replaces `CircleDashed`: it says nothing-here without saying wait.

### P1 — the detail header's six pills were inert

Visually identical to the fleet's clickable cells, sitting at the top of a
1648px page with six anchored blocks and no other in-page navigation. The code
comment justified it as "linking them to the page they are already on would be
noise" — true for a self-link, wrong when the target is two screens down.
Passing `repoId` to the `full` variant turns them into `#<check>` links, which
the hash-landing effect already knows how to receive.

### P2 — raw deriver text leaked into prose

Code review's summary rendered as *"the artifact carries no frontmatter to read
a verdict from"* — lowercase, no terminal period — where every sibling block
shows a capitalised full sentence. `check.error.message` went straight to the
DOM. It read as a log line, in the block whose status is already the most
alarming. Now framed: *"Could not evaluate this check: …"*.

### The scan's one true positive — measure

`ErrorState`'s paragraph ran uncapped at ~184 characters per line at 1440, while
the page's own subtitle already capped at 69. An internal inconsistency rather
than a stylistic preference, which is why "instrument panel, not marketing page"
does not cover it. Capped both, plus the same shape on the detail's
not-registered state.

## Persona red flags

**Donald (the named primary — solo operator, triages daily, iPad over
Tailscale).**

- *Fixed:* the fleet no longer looks like it is still loading, and the detail page
  can be left again.
- **Open — touch targets.** Filter chips are ~25px tall at 11px text; cells are
  now ~28px. PRODUCT.md names iPad use explicitly, and the cells are the primary
  interaction on the fleet. Not fixed here; recorded.
- **Open — the Readiness column is a permanent constant.** Pen-test is `never`
  fleet-wide until declared, so every row reads "Not ready", in identical grey,
  and will keep doing so. A verdict that cannot change is a watermark. This is
  a product question, not a styling one, and it is left for the user.

**Alex (power user).** Cell → anchored-block deep links are genuinely good and
survive a page reload. Filter state round-trips through the URL. Remaining: the
row click is mouse-only (`<tr onClick>` with no role, tabindex or key handler),
though the identical destination is reachable from the focusable name link in
the same row, so nothing is unreachable.

**Jordan (first-timer).** The sort order is invisible — a five-key severity
comparison decides row order and no on-screen element says so. Filter legends
are `sr-only`, so the accessibility layer is better labelled than the visual one.

## Carried, not fixed

Recorded so they are visible rather than forgotten:

- Sort order is undisclosed on the fleet.
- Four vocabularies for time across the two surfaces.
- Light theme washes out the status tints; dark is the better appearance and
  PRODUCT.md already says it should be the default.
- `neuroflash` / `other` filter chips can only produce the empty state.
- Hash landing gives no visual confirmation — `focus()` after a mouse click will
  not match `:focus-visible`, so clicking a cell scrolls somewhere with nothing
  marked.
- `fail` and "could not be evaluated" share a shape and a tint; they are
  distinguished in the accessible name and in the sort, not in the glyph.
- Tailwind scans `*.test.tsx`, so the anti-slop assertion `not.toContain(
  'animate-bounce')` is what puts `.animate-bounce` into the shipped bundle.
  Build hygiene, surfaced indirectly by the scan.
- `/repos/:id` and `/projects/:id` are two pages for the same repo with
  near-identical names and no cross-link. Structural; belongs with
  `retire-v1-surfaces`.

## Screenshots

Captured at 1440×900 against the live daemon, after the fixes:

- `fleet-1440-2026-08-02.png` — three rows, six capped status chips per row, the
  `never` glyph reading `—` rather than a dashed spinner, and the sidebar's
  Fleet readiness item active.
- `repo-detail-1440-2026-08-02.png` — the breadcrumb reading
  `Fleet readiness / agenticapps-dashboard`, the six header pills as jump-nav
  links, `Readiness as of` in the header, and the Spec block naming its
  provenance without evidence.

## Verification

Spa 1511 tests across 130 files, agent 1536 (1 skipped), shared 422.
`pnpm -r typecheck` clean. `pnpm lint` 0 errors at the 207-warning baseline.
`openspec validate --all` 17/17.
