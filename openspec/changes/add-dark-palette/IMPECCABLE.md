---
change: add-dark-palette
artifact: IMPECCABLE
critique_date: 2026-08-01
appearance: dark (the appearance this change introduces)
routes:
  - / (daemon-unreachable + token-rejected states)
  - /settings
  - /help/workflow/overview
viewport: 1440x900
gate: impeccable:critique
floor: 80
composite: 88
nielsen: 31/40
cognitive_load: 0 failures (/ and /settings), 2 failures (/help) — worst reported
deterministic_scan: clean (5 raw findings, all false positives in .test.tsx negative assertions)
verdict: PASS (88 >= 80)
coverage_caveat: populated data surfaces not reviewed — daemon unreachable
isolation_caveat: assessments run sequentially in one context, not as isolated sub-agents
task: 7.4
---

# IMPECCABLE — the dark appearance

Design gate for `add-dark-palette`, which gives the product the dark appearance
it has claimed to default to since D-02 while rendering light in every theme.

## Two caveats on this score, stated before the numbers

**Isolation.** `critique.md` requires Assessment A (LLM design review) and
Assessment B (deterministic detection) to run as separate sub-agents that cannot
see each other's output, because running both in one head silently anchors them
to each other. This session operates under a no-subagent instruction, so the
documented sequential fallback was used. The combined score is therefore less
independent than the method intends. Read it accordingly.

**Coverage.** The daemon was unreachable (its bearer token had rotated, and
re-pairing requires entering a credential). Every data surface — the project
cards, the coverage matrix, the conformance tables — rendered as the
daemon-unreachable state. Those are exactly the surfaces where the four status
colours this change moved actually appear. **The status colours have been
verified by measurement (148 pairings, both appearances) but not by eye.** That
gap is the single biggest reason not to treat this PASS as complete.

## Result

**Composite 88** against the ratified floor of **>= 80** (CLAUDE.md, 2026-06-08).

| Metric | Value |
|---|---|
| Composite | **88** |
| Nielsen total | **31/40** |
| Cognitive load failures | 0 (`/`, `/settings`) · 2 (`/help`) |
| Deterministic findings (production) | **0** |

Discounted from ~90 for the two caveats above rather than scored as if the
review had been complete.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Error states name the URL and the exact command to run. Loading states unobservable with the daemon down. |
| 2 | Match System / Real World | 3 | "Agent URL", "Loopback or *.ts.net only" assume domain knowledge, but the persona is the tool's author. |
| 3 | User Control and Freedom | 3 | Appearance choice is reversible and persists; the token banner is dismissible. |
| 4 | Consistency and Standards | 4 | **Raised by this change.** Every filled control now draws from one fill-role token. |
| 5 | Error Prevention | 3 | Token masked by default; Copy is separate from Reveal, so it can be copied without being shown. |
| 6 | Recognition Rather Than Recall | 3 | Every sidebar entry carries icon and text; help stubs are marked "(soon)" before the click. |
| 7 | Flexibility and Efficiency | 3 | Command palette affordance and a keyboard-hint control are both present in the top bar. |
| 8 | Aesthetic and Minimalist Design | 4 | Zero production slop findings; restrained strategy; three-step surface elevation reads. |
| 9 | Error Recovery | 3 | Both observed error states offer a concrete recovery naming the command. |
| 10 | Help and Documentation | 2 | 11 of 12 Workflow entries are "(soon)"; the docs search input is disabled. Mostly dead ends. |
| **Total** | | **31/40** | |

## Anti-Patterns Verdict

**Does this look AI-generated? No.**

**LLM assessment.** The dark appearance avoids every tell the shared design laws
ban. No glassmorphism, no gradient text, no dark glow, no hero-metric card, no
identical card grid, no side-stripe accents. Colour strategy is Restrained and
stays there: one accent, semantic status colours held separate from it, neutrals
tinted toward the brand hue rather than pure grey (`#1A1721` is a purple-cast
near-black, not `#111`). The second-order category-reflex check also passes — the
obvious training-data answer for "developer dashboard, dark" is neutral slate
plus a neon accent, and this deliberately went the other way to warm ink, a
choice made by comparing two rendered candidates rather than by reflex.

**Deterministic scan.** `npx impeccable --json` over `components/`, `routes/` and
`help/` returned 5 findings, **all false positives**: 3 `bounce-easing` hits and 2
`broken-image` hits, every one inside a `.test.tsx` file asserting the pattern is
*absent* (`expect(el.className).not.toMatch(/animate-bounce/)`, and the D-43
anti-slop test that names the banned classes in its own title). Production code
is clean.

**Visual overlays.** Not injected — the `[Human]` overlay tab requires
`npx impeccable live`, and the browser-automation path available in this session
drives Chrome through the devtools MCP rather than the extension the overlay flow
assumes. Findings below come from direct inspection and measurement instead.

## Overall Impression

The appearance is quietly correct, which is the right ambition for an instrument
panel. The three-step surface elevation (sidebar `#151219` < page `#1A1721` <
card `#221E2B`) gives real depth without a single shadow doing the work, and it
measures *better* than the light appearance on every separation metric — card
against page is 1.084 in dark against 1.046 in light. The focus ring survived the
transition intact: `ring-offset-app-bg` correctly picks up the dark surface, so
the ring reads at 6.43:1 against the page.

The single biggest opportunity is not visual. It is that **PRODUCT.md and the
`design-system` spec disagree about which appearance is primary**, and this change
resolved that disagreement in code without anyone deciding it in prose.

## What's Working

1. **The fill/foreground split made the system more consistent, not just more
   correct.** Before this change `SidebarItem` used `bg-accent-bg-strong` while
   every other filled button used `bg-accent` — the same visual intent expressed
   two ways, which happened to look identical only because light's accent and
   fill values were the same hex. Dark forced the distinction into the open, and
   the result is one rule applied everywhere, held by `fillRole.test.ts`.

2. **The neutrals are tinted, not grey.** `#1A1721`, `#221E2B` and `#332D3E` all
   carry the brand's purple cast. The shared design laws call for exactly this and
   most dark palettes skip it; the surfaces read as a considered material rather
   than as an absence of light.

3. **Honest empty and error states.** "Daemon not running" names the URL it tried
   and the command that fixes it. "Agent token rejected" offers Re-pair inline.
   Neither invents a zero or a spinner to hide behind, which is what PRODUCT.md's
   honest-data principle asks for.

## Priority Issues

### [P1] PRODUCT.md says light is primary; the spec says dark is

**What.** `PRODUCT.md` states *"Warm paper aesthetic. Light theme primary."* and
lists *"No dark glassmorphism"* among its anti-references.
`openspec/specs/design-system/spec.md:141` states the product *"SHALL default to a
dark appearance and offer a light alternative."* Both are current. This change
made the spec true, which makes PRODUCT.md wrong.

**Why it matters.** PRODUCT.md is what every future critique, `$impeccable`
invocation and design decision loads as context. Leaving it saying "light theme
primary" means the next design pass optimises for the appearance most users will
never see. It is also the document a new contributor reads first.

**Fix.** Decide which is true, then make the other match. If dark is primary,
rewrite PRODUCT.md's brand section around warm ink and note warm paper as the
alternative. If light is primary, the `design-system` requirement needs a change
proposal, because the code now follows the spec.

**Suggested command**: `$impeccable teach` (to rewrite PRODUCT.md once decided).

### [P2] The dark elevation shadow is inert

**What.** `--shadow-card` in dark is `0 4px 12px rgba(0, 0, 0, 0.45)`. Black at
45% over `#1A1721` produces almost no visible edge, because there is nothing
darker than near-black to cast onto.

**Why it matters.** It is a token that claims to do a job it cannot do. Card
separation in dark comes entirely from the surface step and the border — which
measure fine — so nothing is broken, but the next person to tune elevation will
adjust a value that has no effect and conclude the system is unresponsive.

**Fix.** Either drop it to near-zero and let the surface step own elevation
honestly, or replace it with a top inset highlight (`inset 0 1px 0` at low alpha),
which is how depth actually reads on a dark ground.

**Suggested command**: `$impeccable polish`.

### [P2] The status colours have been measured but not seen

**What.** The four semantic colours this change moved — success, warning, error,
info — appear almost entirely on data surfaces, all of which were unreachable.
They are proven to clear their floors on every real pairing, including tinted
surfaces, but no human or model has looked at them in context.

**Why it matters.** Contrast is necessary, not sufficient. A warning colour can
clear 4.5:1 and still read as the wrong temperature next to its neighbours, and
the light warning moved a long way (`#C2802B` to `#8F5D18`) to clear its tint.

**Fix.** Re-run this critique against `/coverage` and `/conformance` with the
daemon paired and running. This is the reason the PASS above carries a coverage
caveat rather than standing on its own.

**Suggested command**: `$impeccable critique` (re-run, populated).

### [P3] `/help` is mostly dead ends

**What.** 11 of 12 Workflow entries are "(soon)". The docs search input is
present but disabled. Roughly 40 navigation options sit at a single decision
point.

**Why it matters.** It is the lowest heuristic score at 2/4 and the only route
with cognitive-load failures. Pre-existing and out of this change's scope — and
this change *improved* it, since without the restored `dark:prose-invert` those
pages would render dark text on a dark ground — but it caps the composite.

**Fix.** Hide or collapse stub entries until they have content, rather than
listing them as navigable.

**Suggested command**: `$impeccable distill`.

## Persona Red Flags

**Alex (Impatient Power User)** — the primary persona, and effectively the
product's only user.
- Nothing broke. Appearance switches instantly with no reload, persists across
  navigation, and the `⌘K` affordance is visible from every route.
- Minor: the theme control lives three clicks deep at `/settings`, while the top
  bar already has a sun/moon icon that could toggle directly. Alex will use the
  icon and never open Settings.

**Jordan (Confused First-Timer)** — weakly relevant here, since the product has
one user who wrote it, but the `/help` surface is aimed at exactly this reader.
- Clicks "Commitment ritual" in the docs sidebar, gets a stub. Repeats for 10 of
  the next 11 entries. There is no signal *before* the click beyond a small
  "(soon)", and the entries are not visually de-emphasised.
- The docs search box looks usable and is disabled. It accepts focus and returns
  nothing.

## Minor Observations

- `/settings` leaves roughly 40% of the viewport empty below the Theme card at
  1440x900. Pre-existing; the two cards do not fill the column.
- Light `status-info` at `#5B6FA8` now carries the tightest margin in the whole
  matrix, 4.54:1 on `sidebar-bg`. It passes, but it is the value most likely to
  fail if any light surface is ever darkened. Worth knowing before the next token
  edit.
- The unselected radio controls in dark render as the UA's dark-scheme circles
  only because `color-scheme` resolves correctly — which it did not until the
  `.dark` block was moved after `:root`. Cheap to regress, now asserted.

## Questions to Consider

- If dark is genuinely the default, is "warm paper" still the brand's centre of
  gravity, or is warm ink the identity and paper the accommodation?
- The top bar already has an appearance toggle. What is `/settings`' Theme card
  for, given the same control sits one click away on every route?
- The status colours are proven correct and unseen. What else in this system is
  proven correct and unseen?
