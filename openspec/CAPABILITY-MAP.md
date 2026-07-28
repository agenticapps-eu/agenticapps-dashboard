# Capability map — agenticapps-dashboard

**Status:** ✅ RATIFIED 2026-07-26 — 12 capabilities, as proposed.

Derived from `docs/spec/dashboard-prompt.md` (binding), the v1.1/v1.2 requirement
archives, `docs/legacy-planning/ROADMAP.md`, and the shipped route/schema surface
under `packages/`.

**Principle:** capabilities are *product capabilities*, not phases. 21 phases merge
into 12 capabilities. Phase numbers are deliberately not mirrored.

## Proposed capabilities

| # | `specs/<capability>/` | What it owns | Merged from phases |
|---|---|---|---|
| 1 | `project-registry` | Registry as source of truth: register (CLI + SPA), unregister, rename, tag, ID generation + collision suffixes, reachability, path-drift detection and repair | 1 (REG-*), 3 (register modal), 12 (RPD-*) |
| 2 | `daemon-runtime` | Local daemon lifecycle: Hono server, start/stop/status, bind modes (loopback / Tailscale / 0.0.0.0), CIDR enforcement, `/health`, caching cadences, launchd/systemd install, CLI surface | 1 (DAEMON-*), 6 |
| 3 | `auth-and-pairing` | Bearer token on every route, `auth.json` 0600 + startup permission refusal, rotation (manual / version / 30d), CORS origin lock, pair URL + SPA pair flow, re-pair on unreachable | 1 (AUTH-*), 2 (SPA-*) |
| 4 | `filesystem-access-policy` | **The security spine.** Read-only on project filesystems, `/read` allow-list under `.planning/`+`.claude/`, `..`/absolute/realpath rejection, named allowed roots for fleet scanners, 0600/0700 mode discipline, git-command allow-list, the single `/open` `$EDITOR` exception | 1 (API-*), cross-cutting INV-01/INV-02 |
| 5 | `project-dashboard` | Viewing a registered project's pipeline state: multi-project home cards (filter/search/sort/freshness), and the single-project three-column view — phase progress, execution timeline, review + security + verification status, commitment block, hook firings, observations | 3 (HOME-*), 4 (DISC-*, PHASE-*) |
| 6 | `skills-and-linting` | Installed skills (global `~/.claude/skills/` + project-local), AgentLinter subprocess + 1h cache + Position Risk, cross-repo skill-drift matrix | 5, 11 (SKD-*) |
| 7 | `fleet-coverage` | Coverage matrix across `~/Sourcecode/{agenticapps,factiv,neuroflash}`: per-repo columns, 4-state freshness, family grouping + aggregates, filters/search, override chips, daily NDJSON history + drift badges, scoped refresh actions | 10, 10.6, 11 (TRD-*) |
| 8 | `fleet-conformance` | Conformance scoring (equal-weight per cell, tiers 90/70), family cards, 90-day fleet trend chart, path-drift panel | 12, 12.1 |
| 9 | `code-intelligence` | Third-party code-intelligence tools surfaced in the dashboard: GitNexus scoped scan actions (daemon-spawned, job-polled), Understand-Anything daemon-hosted viewer + its six data endpoints, the Code Intelligence page | 13, 14, 14.1 |
| 10 | `optional-integrations` | Sentry / Linear / Infisical panels and the **works-fully-without-them** contract, `env.json` (0600) management, integration + observability + secrets health detection | 8 |
| 11 | `help-docs` | `/help` MDX docs system: anchor pages, stub pages, `HelpLayout`, `HelpWidget` lazy dispatch, `HelpHook`, keyboard-shortcut reference | 7 |
| 12 | `design-system` | Product-facing UI contract: design tokens, WCAG contrast invariant (CI-enforced), sticky page headers, Toast primitive, responsive breakpoints, app shell + sidebar IA | 5.1, 6.1, 11.1, 11.2 |

## Deliberate exclusions

**The IMPECCABLE composite-score gate is NOT a capability.** The `≥ 80` floor, the
`<N>-IMPECCABLE.md` artifact, and the per-phase critique ritual are *process*
(how work is verified), not product behavior. They stay in `CLAUDE.md` /
`docs/WORKFLOW.md`. Only the *outcomes* the gate protects — tokens, contrast
ratios, responsive behavior — become requirements, in `design-system`.

Phase 0 (bootstrap) and Phase 9 (open-source readiness) contribute no product
capability. Phase 0 is repo scaffolding; Phase 9 is unstarted and becomes an
active change, not a spec.

## Ratification decisions (2026-07-26)

| Gap | Decision |
|---|---|
| GAP-01 | **Keep `code-intelligence` as one capability.** Not split. |
| GAP-02 | **Keep `project-dashboard` merged.** Not split. |
| GAP-03 | **ObservabilityHealth stays in `optional-integrations`.** Confirmed as proposed. |
| GAP-04 | **Superseded — remove GitNexus from the dashboard entirely.** First decided as "mark deprecated", then revisited when the stated premise was found false (see below). Staged as `openspec/changes/remove-gitnexus-integration/`. |
| GAP-05 | **Resolved and widened 2026-07-26.** Staged as `add-openspec-project-reader` (still unimplemented), now scoped to reader **+ capability panel + retiring the GSD reader**. Sub-decisions below. |

## Open questions — resolved at ratification

> [GAP-01: **Is `code-intelligence` one capability or two?** GitNexus scan actions
> (daemon spawns a binary, returns a job id, SPA short-polls) and Understand-Anything
> (daemon hosts a prebuilt static viewer + re-implements six read endpoints) are
> mechanically very different. Phase 14's CONTEXT explicitly framed itself as "the
> way GitNexus was integrated in Phase 13" and both land in one sidebar section,
> which argues for one. Splitting into `gitnexus-integration` +
> `understand-anything-integration` would be more honest about the mechanics.
> **My recommendation: keep as one** — the user-facing capability is "see and refresh
> code intelligence for a repo", and the sidebar section is the product boundary.]

> [GAP-02: **Does `project-dashboard` merge too much?** It covers both the
> multi-project home (Phase 3) and the single-project three-column view (Phase 4).
> They share the overview data model and the read-only projection, but they are two
> distinct surfaces with different polling and different panels. **My recommendation:
> keep merged** — splitting yields two specs that would cross-reference on nearly
> every requirement.]

> [GAP-03: **Where does ObservabilityHealth belong?** `observability.ts` (Phase 5)
> greps `package.json` / CI files for Spotlight / Sentry SDK / sentry-cli. It is
> *detection of third-party tooling*, which fits `optional-integrations`, but it is
> also a *health panel*, which fits `skills-and-linting`. I placed it in
> `optional-integrations`. Confirm or move.]

> [GAP-04 — **RESOLVED 2026-07-26: remove GitNexus from the dashboard entirely.**
>
> **Correction to the original framing.** This gap was first written on the claim
> that GitNexus was "a feature whose upstream the fleet has dropped". That claim
> was false. Migration `0032` removed GitNexus from the AgenticApps *workflow
> scaffold* only — the reindex hook, install scripts, and CLAUDE.md block. The
> tool itself is still installed (v1.6.4), still registered as an MCP server in
> `~/.claude.json`, and its index registry is live. "Removed from the workflow"
> is not "removed from the fleet", and the first round of this decision was taken
> on that conflation.
>
> On the corrected facts the feature is 1,541 LOC of working product code (plus
> 2,578 LOC of tests) against a tool still in daily use. Removal is therefore a
> deliberate product choice — the dashboard should not carry a fleet-wide surface
> for a tool the workflow no longer provisions — and **not** a mechanical
> consequence of the migration.
>
> **Scope:** dashboard product code and tests, the code-graph coverage column,
> and this repo's vendored `.claude/skills/gitnexus/`. Explicitly **out of
> scope:** the machine-level MCP registration and the tool itself, which stay
> available outside the dashboard.
>
> **Knock-on, decided:** conformance is an equal-weight score over the tracked
> columns, so dropping one changes every score and would put a step in the 90-day
> trend — a fake improvement if the removed column was mostly non-green. Daily
> snapshots store per-column states inline, so history is **recomputed** over the
> reduced column set rather than left discontinuous. Specified as a requirement,
> not an implementation note.
>
> Staged as `openspec/changes/remove-gitnexus-integration/`.
> `fix-coverage-scan-open-defects` was withdrawn — its two defects are in code
> this change deletes.]

> [GAP-05 — **RESOLVED 2026-07-26.** The dashboard parses `.planning/`, which
> OpenSpec replaces.
>
> **Correction to the original framing.** This gap first claimed the repo "can no
> longer read its own project row". Overstated. Because `.planning/config.json`
> deliberately stayed in place, the `planning` flag is still true and both
> auto-discovery markers still match — the project is recognised, discoverable,
> and rendered. The only actual degradation is `findCurrentPhase()` returning
> null, so the **progress column goes blank**. A degradation, not a blackout.
>
> **Reframing.** The original framing treated this as damage control. It is
> better understood as an upgrade: the target format is strictly easier to read.
> GSD required a "highest-numbered phase" sort over names like `00-bootstrap`,
> `DASH-05.1-…`, `DASH-10.5-…`, `13-…` — the migration's own archive script
> needed a hand-maintained date table because those cannot be ordered
> programmatically — and derived progress from artifact presence. OpenSpec gives
> real task counts, a date-sortable archive, and, for the first time, an
> enumerable statement of what a project *currently promises*. The GSD tree could
> only ever show activity; OpenSpec can show state.
>
> **Sub-decisions:**
> - **Scope:** reader + capability panel + retire the GSD reader (all three).
> - **Card primary line:** open-change count with per-change task ratios. No
>   synthesised "current phase" — it has no OpenSpec equivalent.
> - **Read strategy:** hybrid — `openspec --json` when the binary is present,
>   direct tree read otherwise. The archive is always read from the tree; the CLI
>   does not expose it.
> - **Allow-list:** add `openspec` only. Reading relocated `docs/legacy-planning/`
>   trees was **explicitly rejected** — it would widen the allow-list into
>   `docs/`, which holds unrelated content, for history already archived in
>   `openspec/changes/archive/`.
> - **Coverage column:** none added. `workflowVersion >= 3.0.0` already implies
>   OpenSpec, and the matrix is deliberately getting less dense.
>
> **Accepted consequence:** retiring the GSD reader immediately (rather than
> gating it on fleet migration) blanks 8 repos — `agenticapps-roadmap`,
> `agents-task-viewer`, `claude-workflow`, `pi-agentic-apps-workflow`,
> `workflow-testbed`, `factiv/cparx`, `factiv/stimmung`, `neuroflash/mcp-server`
> — including the flagship product and the workflow repo itself. Chosen
> knowingly over carrying dual-path readers; the remedy is to migrate them.]

## Traceability

Reconstructed specs are **current truth, post-supersession**. Where a later phase
superseded an earlier decision (e.g. IMPECCABLE floor 87 → 80 via D-10.5-03; Phase 13
removing the page-header `IndexGitNexusButton`), only the final state is recorded.
The supersession history stays in `docs/legacy-planning/`.

---

## Sequence — appended 2026-07-26

**Appended, not merged.** Everything above is ratified and dated; §08 says
supersede, never delete. This section records what happened *after* that
ratification and does not alter it.

### What changed after ratification

The Linear project *Dashboard v2 — Vereinfachung, Fleet-Versionen, Kanban*
(28 issues, AGE-456…AGE-483) rebuilds the product around three questions instead
of ten surfaces. Merged into this slot as **three new capabilities plus deltas on
existing ones** — not as 28 requirements and not as 28 changes.

| New capability | Guarantees | Merged from |
|---|---|---|
| `repo-readiness` | Six checks per repo, one status vocabulary, tier-A/tier-B precedence, the honesty rule, the fleet and detail surfaces | AGE-456, 457, 458, 459, 460, 461, 462, 464, 465, 466 |
| `workflow-fleet-conformance` | Core↔host version comparison, per-skill drift, byte identity, bounded on-demand harness | AGE-467, 468, 469 |
| `agent-board` | Normalised sessions and tasks across three hosts, read-only, shared adapters | AGE-470, 471, 472 |

**Names deliberately not reused.** The new test-coverage check is *not* a
capability called `fleet-coverage`, and the version comparison is *not*
`fleet-conformance`. Both names belong to withdrawn concepts. In v2 `coverage`
means test coverage, not tooling coverage; and conformance means version
agreement, not a weighted score. One word carrying two concepts in one slot is
the most reliable way to misread it later.

**Capability count 12 → 10.** Five withdrawn, three added.

### Order of application

Seven changes are open. The order is not arbitrary.

| # | Change | Depends on | Note |
|---|---|---|---|
| 1 | `add-openspec-project-reader` | — | Foundation. Supplies the reader the `spec` check consumes. The only real dependency in the plan. |
| 2 | `remove-gitnexus-integration` | — | Descoped: task block 1 and the history requirement removed. Runs parallel to 3 — different files. |
| 3 | `add-repo-readiness` | 1 | Only its `spec` check needs 1; the rest could start earlier. |
| 4 | `add-workflow-fleet-conformance` | — | Independent. Can run early. Carries the `filesystem-access-policy` delta. |
| 5 | `add-agent-board` | — | Independent. Stage 1 runs against a stub, so the adapter extraction does not block it. |
| 6 | `retire-v1-surfaces` | 2, 3, 4, 5 | At the cutover. Written now, applied last. |
| 7 | `verify-tailscale-second-device-access`, `add-oss-readiness` | 6 | After the cutover. |

**Why 6 is last.** A withdrawal is only true once the replacement stands. Applied
early, the slot would state for that interval that the product can do neither the
old thing nor the new one. It is nonetheless *written* now, with the v2 changes,
because a change that adds a surface without saying which requirements it
supersedes is how a slot ends up carrying two contradictory truths — and
`openspec validate` checks structure, not consistency.

**Why 7 waits.** Both work against surfaces v2 replaces. The Tailscale run would
verify panels scheduled for deletion; open-sourcing would publish files scheduled
for deletion.

### Corrections recorded during the merge

- **GAP-04's descope.** `remove-gitnexus-integration` devoted its largest task
  block to keeping the 90-day conformance trend continuous across the column
  removal. **The analysis was right and stays in that change's proposal**; the
  measure is dropped only because `retire-v1-surfaces` withdraws the chart, so
  the recomputation has no consumer. Recorded so the descope reads as a decision.
- **`filesystem-access-policy` is not untouched.** The v2 plan listed four
  untouched capabilities. It is three. `add-workflow-fleet-conformance` adds a
  second process-spawning exception — the conformance harness — and a machine-wide
  allowed root. The security spine says "sole exception" today; shipping a second
  one without amending it would be worse than naming both. Bounded on five axes,
  all specified as requirements.
- **The withdrawal is 50 requirements, not 42.** The 42 figure counts only
  capability withdrawals. `project-dashboard` survives while losing eight more.
- **The Impeccable floor stays out of the slot.** The *Deliberate exclusions*
  section above, and `design-system`'s own preamble, both place the critique
  ritual and its composite floor in process rather than product. Raising it
  (AGE-476) is therefore a `CLAUDE.md` change, not a spec delta. Only the
  outcomes it protects — density, tabular figures, non-colour-dependence — become
  requirements. AGE-476 also computes from a superseded baseline; see
  `openspec/BACKLOG.md`.
- **The capability panel changes address, it does not vanish.**
  `add-openspec-project-reader` adds it to the single-project view; v2 turns it
  into the `spec` check's evidence display. Recorded so its removal from
  `project-dashboard` is not later read as an oversight.

### Linear coupling

Issue ids above are **pointers for a human**, per §19. Nothing synchronises in
either direction, and neither side is required to be complete with respect to the
other.

---

## Errata — appended 2026-07-26, after plan review

Eight active changes were reviewed by other-vendor CLIs before any code was
written (§18). The reviews refuted two premises recorded above. Appended, per
§08 — the sections above are ratified and are not edited.

### GAP-05's coverage-column justification is false

GAP-05 resolves the coverage-column question with:

> **Coverage column:** none added. `workflowVersion >= 3.0.0` already implies
> OpenSpec, and the matrix is deliberately getting less dense.

**The first clause does not hold.** Measured 2026-07-26: `claude-workflow` ships
`version: 3.0.0` and has **no `openspec/` directory**. The repo that publishes
version 3.0.0 is itself a counterexample. Workflow version tracks the installed
skill; it says nothing about whether a repo has adopted the OpenSpec layout.

This is consistent with GAP-05's own accepted consequence, which lists
`claude-workflow` among the eight repos that go blank — a repo cannot be both
"implied to have OpenSpec" and "blank for lacking it". The two halves of the
resolution contradicted each other and it went unnoticed at ratification.

**The decision survives; its reasoning is replaced.** No coverage column is
added, because v2 withdraws the coverage matrix entirely (`retire-v1-surfaces`).
And the falsehood strengthens rather than weakens the v2 design: the `spec`
readiness check exists precisely *because* workflow version does not imply
OpenSpec adoption. If it did, the column would be redundant.

This is the third premise this document has had to correct — after GAP-04's
"upstream dropped GitNexus" and GAP-05's own "the repo can no longer read its own
row". The pattern is consistent: each was a plausible inference stated as a
measured fact. Measure before asserting.

### `filesystem-access-policy` enumerates spawning, and got it wrong twice

The v2 plan listed four untouched capabilities. It is three: the harness runner
in `add-workflow-fleet-conformance` adds a process-spawning surface.

The first attempt to write that down claimed the daemon would then have exactly
two spawning routes. Also false — the git route spawns subprocesses today, and
the OpenSpec reader adds a third by invoking the `openspec` binary. The original
requirement's "sole exception" clause governs **writes**, not process creation;
rewriting it as a claim about spawning introduced a falsehood that was not in the
ratified text.

The spine now enumerates four spawning sites explicitly and guarantees, for the
two that run foreign programs, only what is enforceable at the spawn boundary —
which program, which arguments, which working directory, which limits, and how it
is terminated. An earlier draft asserted that every project working tree stays
byte-identical across a harness run; three reviewers rejected it as unenforceable
against code the daemon does not control, and they were right.

### Review coverage

The eight changes active at review time each carry `REVIEWS.md` with at least
two other-vendor reviewers. Every one returned REQUEST-CHANGES; none returned an
approval. Findings that were fixed are in the changes themselves; those deferred
are recorded in the relevant `proposal.md`.

A ninth change, `decide-tailnet-ipv6-policy`, was **created by these reviews** and
therefore postdates them. It has no `REVIEWS.md` yet. It records that the tailnet
boundary is IPv4-CGNAT-only by policy rather than by omission — a reviewer read
the CIDR middleware and found that a tailnet IPv6 peer is refused. The
implementation matches the spec exactly; the spec was silent on address family.
That is a spec gap, not a defect, and widening the boundary is deliberately not
proposed without evidence of a peer that cannot connect.

### Sequence note

The sequence recorded above lists seven changes. `decide-tailnet-ipv6-policy` is
the ninth and is independent of all of them: it touches only `daemon-runtime`,
adds no behaviour, and can run at any point.

### Agent board deferred — 2026-07-28

`add-agent-board` was withdrawn before implementation and AGE-470, AGE-471, and
AGE-472 returned to backlog. The upstream `agents-task-viewer` is replacing its
agent-task board with OpenSpec change cards, which invalidates the withdrawn
change's task-shaped wire contract, columns, blocker semantics, and adapter
extraction plan.

Re-propose the dashboard surface only after the upstream OpenSpec `ChangeCard`
contract, package exports, fixtures, and shared host styles are stable. Those
four are necessary but **not** sufficient: a stable upstream contract is not a
surface.

`retire-v1-surfaces` remains blocked until an agent-change surface has been
proposed, implemented, and is actually available in the product. The withdrawal
does not authorize a v2 cutover, and neither does upstream stabilising its
contract.

### Coverage integration supersession — 2026-07-28

The ratified capability table above is preserved as historical decision
context. Current product truth now supersedes its GitNexus, Wiki, four-state,
and scoped-refresh descriptions:

- `fleet-coverage` tracks `CLAUDE.md`, workflow version, and Understand Anything
  analysis with the three states `fresh`, `stale`, and `missing`; its snapshots
  and drift responses retain only `claudeMd` and `workflowVersion`.
- `fleet-conformance` scores those same two historically comparable fields.
- `code-intelligence` now means Understand Anything status, SPA-constructed
  analysis commands, and the daemon-hosted knowledge-graph viewer.

The dashboard's GitNexus scan routes, health extension, coverage column, and
vendored skill, plus the Wiki coverage column and compiler reads, are removed.
The machine-level GitNexus MCP registration and installation remain outside
dashboard scope. Compatibility and retained-history decisions are recorded in
`docs/decisions/0001-coverage-v2-history-compatibility.md`.
