**TDD throughout.** Every test is proved to fail before its implementation
exists. Two fixtures last session passed while asserting nothing; reverting the
implementation to confirm RED is the check that catches that, and it is not
optional here.

**This change does not depend on `retire-v1-surfaces`.** It stands alone on the
current SPA alongside the v1 surfaces, and unblocks that change rather than
waiting for it.

## 1. Shared contract

- [x] 1.1 Read upstream `agents-task-viewer` `src/openspec/types.ts`, `reader.ts`, `tracker.ts` **and ADR 0008** in full before writing the schema; record any field deliberately not carried. ADR 0004 is history — two rounds of this change argued from its prose against a classifier that had moved on. **Not carried, recorded in `changes.ts`'s docblock:** `activeSessionCount` / `activeByHost` / `supportingTasks` (host-session evidence, out of scope), `repositoryRevision` (arbitrates duplicate multi-host snapshots; one producer here), `backlogDocumentIndex` (identity is `backlogSlug`, ordering is by mtime). **Re-based:** `id` uses the registry id in place of `repositoryRoot` in upstream's NUL-joined triple — same shape, no absolute path in the response, and the three components are exactly the three address parameters
- [x] 1.2 Write failing schema tests for the change card: required fields, the four stage values, the three source values, and rejection of an unknown stage — `ship` is not a stage and must be rejected
- [x] 1.3 Add `packages/shared/src/schemas/changes.ts` — card and fleet-response zod schemas — and export from the barrel
- [x] 1.4 Rebuild shared (`pnpm --filter @agenticapps/dashboard-shared build`) before running agent tests — the agent runs shared's built dist, and a clean typecheck with a runtime ZodError means a stale build. Verified by importing `dist/index.js` directly: four stages, NUL-joined key, `ship` rejected

## 2. Stage classifier — pure, no I/O

- [x] 2.1 Mirror upstream's `src/openspec/__fixtures__` into the agent test tree, recording provenance and the commit they were taken from
- [x] 2.2 Write one failing test per ordered rule 1–5, plus a backlog entry classifying as `propose`
- [x] 2.3 Write the failing veto test **against the real `retire-v1-surfaces/REVIEWS.md` shape** — two approvals from distinct reviewers plus two requests-for-changes from two *other* distinct reviewers classifies `validate`, not `execute`. This is the case that refuted the first draft of the rule; it is the one test that must exist
- [x] 2.4 Write the failing tests for the rest of the reviewer rule: a reviewer whose rejection is followed by an approval in a later round no longer vetoes; unparseable verdicts count as absent and classify `validate`; a vendor approving twice counts once
- [x] 2.5 Write the failing parse-grammar tests mirroring upstream's `parseReviewEvidence` and `parseChecklist`: `## Reviewer: <vendor>` section bounds, `VERDICT: APPROVE|REQUEST-CHANGES` matched case-insensitively, vendor dedup on the lowercased name, and checklist rows matching `^\s*-\s+\[([ xX])\]\s+(.+?)\s*$`. Include the case that broke the round-3 draft: one vendor approving **and** rejecting in one record holds the change at `validate`, with no last-section-wins rule
- [x] 2.6 Write the failing staleness tests: with `REVIEWS.md` plus `REVIEWS-round-1..3.md`, the most recently modified record is the one read and the card names it; a `REVIEWS.md` touched after the last round wins; `REVIEWS-round-10.md` beats `REVIEWS-round-9.md` on a modification-time tie; a reviewer absent from the selected record has no verdict rather than a carried-forward one. `archive/2026-08-02-close-readiness-spec-gaps/` is the real fixture — copy it, do not invent one
- [x] 2.7 Write the failing test that `design.md` presence never changes a stage
- [x] 2.8 Write the failing test that both archive readings are distinguishable — a rule-1 card carries source `archive`, a rule-5 card carries source `active` with `ready`
- [x] 2.9 **Conformance, not just agreement**: run upstream's mirrored fixtures through both `classifyActiveChange` (copied verbatim into the test as the oracle) and `stage.ts`, and assert identical stages for every fixture. This is the check that would have caught the phantom divergence
- [x] 2.10 Implement `packages/agent/src/lib/changes/stage.ts` to green, citing `reader.ts` and ADR 0008 as the origin — **not ADR 0004** — and naming the one divergence in the module docblock: the absence of `ship`
- [x] 2.11 Revert `stage.ts` and confirm every test in 2.2–2.9 goes RED, then restore. **Neutering all four exported functions left 41 of 47 RED and 6 green — and the 6 were the fixture SHA-256 guards, which never call the classifier.** The first run left 15 green: every "expect nothing" and "expect propose" assertion was satisfied by a constant. Those seven tests were given a discriminating half in the same assertion, which is the defect this check exists to find

## 3. Repository reader

- [x] 3.1 Write failing tests over temp directories: active changes, dated archive entries, unresolved `BACKLOG.md` entries, artifact presence, checklist rows, reviewer verdicts
- [x] 3.2 Write the failing test that a repository with no `openspec/` yields no cards and is not reported as an error
- [x] 3.3 Write failing tests for malformed input: an unparseable change directory and an unparseable backlog entry are skipped and counted, never fatal
- [x] 3.4 Write the failing test that `openspec/changes/archive/` produces no card of its own, and that a non-change entry (a README, a directory holding none of the three artifacts) produces none either — this repo's own tree is the fixture
- [x] 3.5 Mirror upstream's `parseBacklog` — fence tracking, anchored `closedHeading`/`closedBodyLine`, `backlogSlug` — rather than writing a marker rule. Test **against this repo's own `openspec/BACKLOG.md`**, whose two closed entries were corrected to the convention in this change: `Human verification backlog` and `[RESOLVED] Known stale artifact` must close, the third must stay open. Also assert `Redone migration` and `Add WITHDRAWN flag support` stay open — the substring rule that closed them is the defect this replaced
- [x] 3.6 Write the failing tests for the malformed/absent split: an absent `BACKLOG.md`, an empty one, and a directory holding none of the three artifacts are silent; an unreadable file, an oversized file, and an `archive/` entry failing the date or artifact test are reported as skipped. Assert no input satisfies both. **Interpretation recorded:** an oversized *artifact* skips the file and keeps the card (`evidenceLimited` plus an `evidence-limited` notice), which is upstream's semantics — a card that vanishes because one file is large reports nothing at all. An oversized `BACKLOG.md` rejects that source outright, also upstream's
- [x] 3.7 Write the failing identity tests against upstream's `sourceIdentity` (NUL-joined root/source/instance): two dated archives of one slug are two cards; a backlog entry whose slug matches an active change is **one** card, not two (`occupiedSlugs`); the instance for a backlog entry is its slug, never its raw heading text
- [x] 3.8 Write the failing bound test: more than `MAX_SOURCE_RECORDS` records of one source in one repository admits the bound and emits a `truncated` notice carrying admitted and observed counts
- [x] 3.9 Implement `packages/agent/src/lib/changes/changeReader.ts` to green, then run the same vacuity check as 2.11: neutering `readRepositoryChanges` and `parseBacklog` first left 25 of 68 green, 15 of them asserting only emptiness. Strengthened; the revert now leaves 57 of 68 RED and the 11 survivors all test helpers that were not neutered (`backlogSlug`, `archivedSlug`, `isReadableProjectPath`, the cap constant)
- [x] 3.10 Confirm every path read passes `isReadableProjectPath`; add a test asserting it for the archive and backlog paths specifically
- [x] 3.11 **Found a real defect doing this:** a `Dirent` is `lstat`-shaped, so a symlinked *directory* reports neither `isDirectory()` nor a usable kind and was being filtered out silently — no card, but no notice either, which fails "produces no card **and is reported** as skipped". Symlink entries are now admitted as candidates so containment can refuse and report them. Add realpath containment on top of the lexical guard — resolve each path and confirm it lies under **`<project root>/openspec`**, not merely under the project root, and read regular files only. Write the failing tests first: a symlink under `openspec/` resolving to `../.env` or `../.git/config` **inside the same repository** yields no card and is reported skipped. A root-scoped check passes that case, which is why round 3 rejected it; `coverageResolver` and `conformanceScan` are the precedent for the resolution itself
- [x] 3.12 Add the pre-read size cap as a named constant, checked before the read, with the oversized file skipped and reported. This was required by round-1 review alongside realpath and regular-file checks and was the one of the three silently dropped — round 2 caught the omission

## 4. Fleet service and route

- [x] 4.1 Write the failing degradation test: one repository throws, the rest still render, and the thrower is named with a reason
- [x] 4.2 Write the failing test that all-repositories-failed is distinguishable from no-open-changes
- [x] 4.3 Implement `packages/agent/src/lib/changes/service.ts` using `withinBound` + `Promise.allSettled`, one bound — document why the readiness signature pre-pass is not copied
- [x] 4.4 Cache the fleet aggregate server-side with explicit invalidation, per `daemon-runtime` → `Response Caching Cadences`. **Cadence settled here rather than after (closes 11.20):** `CHANGES_MEMO_TTL_MS = 5_000`, named, because `Polling, Not Push` fixes the client at ~5s — a shorter cache is never hit, a longer one visibly lags the client's own refresh. The endpoint bound is likewise a named constant, `CHANGES_SCAN_TIMEOUT_MS = 15_000`. Readiness's content fingerprint is deliberately not copied (it is what forces readiness's second bound), so within one cadence a file edit is unseen — bounded by the polling interval, and stated in the module rather than hidden. The key is the registry's own content, so a registry change is a different key rather than a stale hit, and `invalidateChangesCache()` is the explicit lever the scenario calls for
- [x] 4.5 Write the failing route contract test for `GET /api/v2/changes/fleet` — 200 shape, degraded notice, auth required
- [x] 4.6 Implement `packages/agent/src/routes/changes.ts` and register it
- [x] 4.7 **Measured against the real registry (3 projects, 2026-08-03): 60 cards — 14 active, 45 archive, 1 backlog — in 21–28 ms cold over five runs, 0.07 ms served from cache, 0 notices.** The archive walk dominates the *card count* at 45 of 60 but not the latency: the whole read is three orders of magnitude inside the 15 s bound, because dropping the ship probe turned a mature archive from one subprocess per entry into a directory listing. No scope narrowing needed, and the active-only fallback stays a fallback
- [x] 4.8 Assert in test that the board spawns no process at all: `GIT_ALLOWED_CMDS` is unchanged and no new spawn site exists. Three assertions — a static scan of the three modules, `GIT_ALLOWED_CMDS` unchanged at four subcommands, and a runtime test in `service.nospawn.test.ts` that replaces every `node:child_process` entry point with a thrower and assembles a fleet covering all three sources. The trap was itself proved to fire by temporarily adding an `execFileSync` call

## 5. Board surface

- [x] 5.1 Write failing SPA tests: four columns at the reference viewport, header `Label · N`, `No changes` for an empty stage
- [x] 5.2 Write the failing test that the board pages one stage at a time behind a stage rail below the 180px minimum column width, with every stage reachable. **The minimum column width is the constant and the viewport threshold is derived from it** — `4 x 180 + 3 x 16 (gap) + 240 (sidebar) + 48 (main padding) = 1056px`, each input named in `boardLayout.ts`, so a change to the shell recomputes the threshold rather than invalidating the requirement. Implemented with `matchMedia` rather than a `ResizeObserver`, per the rationale `useViewportBreakpoint` already records
- [x] 5.3 Write the failing test that a long change name renders across two lines rather than eliding at one
- [x] 5.4 Write failing tests for the degraded and unreachable states, asserting a degraded read does not present as an ordinary empty board
- [x] 5.5 Write the failing test that the Archive column distinguishes a filed archive card from an active card marked `ready`
- [x] 5.6 **`compareChangeCards` moved to shared and applied by both the daemon and the board.** The readiness fleet sorts client-side only, on the reasoning that a sorting server plus a sorting client eventually disagree — but that hazard is two *different* orderings, not one applied twice. One shared total order is idempotent, so the daemon ships an ordered response and the board still orders what it renders, and the tests can feed deliberately shuffled cards. Write the failing ordering tests: every column totally ordered and stable across two renders of an unchanged fleet; Archive date-descending with the rule-5 `ready` card ahead of every dated card; `propose`/`validate`/`execute` by modification time descending; ties broken on card identity so no repository's name decides another's order
- [x] 5.7 Implement `ChangeBoardPage`, `StageColumn` and `ChangeCard` to green; the card must not assume a fixed row count, so the session row is additive later. Asserted directly: the card's row container is a column flex with no `h-*` and no `grid-rows-*`. **Interpretation recorded:** a fleet with *no cards at all* renders the explicit "no changes in flight" state rather than four empty columns — the per-stage "No changes" copy is for a stage that is empty while others are not
- [x] 5.8 Add the `/changes` route and one `Changes` sidebar entry in the product-content group
- [x] 5.9 **Unplanned, and authorised mid-session: fix the shell's horizontal overflow.** Live verification of 5.2 at 390×844 found the page scrolling horizontally — and `/fleet` scrolled *worse* than `/changes` (752px vs 642px at a 485px client width), so it was `AppShellV2`'s unconditional `240px 1fr` track plus the top bar's minimum width, failing `Dense Rows And Aligned Figures`' no-horizontal-scroll clause on **every** v2 route rather than on this board. Below the design system's own declared `xs` boundary (640px, not a new number) the sidebar now leaves the grid and becomes a dismissible panel opened from the top bar; it closes on selection, and the palette trigger drops its label and shortcut hint while keeping its accessible name. Navigation is moved, never hidden. Ten tests in `AppShellV2.compact.test.tsx` cover the structure jsdom can see; the width itself was measured in Chrome at a true 390×844 emulated viewport: `/changes`, `/fleet`, `/coverage` and `/` all report `scrollWidth === clientWidth === 390` with zero elements past the client width, against 642/752 before

## 6. Drawer

- [x] 6.1 Write failing tests: selecting a card opens a drawer over the board carrying repository, stage, source, artifact presence, reviewer verdicts and checklist rows
- [x] 6.2 Write the failing test that the location carries repository, source and change as three separate parameters, and that no composite separator is parsed
- [x] 6.3 Write the failing test that a backlog entry and an active change of the same name in one repository are two cards with two distinct addresses
- [x] 6.4 Write the failing tests that a deep link restores the drawer, and that a deep link to an absent change renders the board with a not-found statement
- [x] 6.5 Implement `ChangeDrawer` to green

## 7. Verify

- [x] 7.1 Green per package, not `pnpm -r test`: shared **496**, agent **1737** (+1 skipped), SPA **1620**. One agent run showed a single failure in `routes/conformance.test.ts` Test 11 that did not reproduce in isolation or on a clean full re-run — recorded as a flake rather than passed over silently, and worth a look if it recurs
- [x] 7.2 `pnpm -r typecheck` clean; `pnpm lint` **0 errors** (222 pre-existing warnings, unchanged in kind). One error was introduced and fixed en route: an effect calling `setState` synchronously, replaced with React's documented adjust-state-during-render pattern
- [x] 7.3 `impeccable:critique` run at 1440×900 and 390×844 against `/changes`, two isolated assessments per round, artifact committed as `CRITIQUE.md`. **The composite floor is NOT met and is waived under the structural-debt clause — user decision, 2026-08-04.** Round 1 scored 22/40 (55), round 2 scored 27/40 (67.5), against a floor of 32/40 (80). Every *defect* either round found is fixed, including four that only a live page could surface: the shell's horizontal overflow, two design tokens that do not exist, a drawer with no dialog contract, and a stage-selection fix whose code contradicted its own comment. The residual gap is heuristics 7 and 8 — the board cannot rank and cannot act, and spends ~40% of its area on nothing at the reference viewport. Those are decisions about what this board is *for*, recorded as 13.16–13.19 rather than guessed at under time pressure
- [x] 7.4 **Verified against the live daemon and the real registry**, which is what caught the shell defect in 5.9. `GET /api/v2/changes/fleet` answers 401 unauthenticated and 200 with the bearer token; 60 cards across 3 registered repositories, 0 notices. The board classifies **its own change** correctly — `add-agent-change-board` sits in Validate with `hasRequestChanges: true` and 99/119 checklist rows, read from `REVIEWS.md`. Mocked responses would not have shown either the status codes or the overflow
- [x] 7.5 `openspec validate --all` green
- [x] 7.6 **Round 4 run and disposed in §12** — the first round with code to read. gemini and codex REQUEST-CHANGES; opencode's record truncated with no `VERDICT:` line, so it counts as absent, which is this change's own reviewer rule applied to its own evidence. Four findings confirmed and fixed (a TOCTOU, an unreachable scenario, two places the spec contradicted the code), one refuted with the check, two carried. Every finding was verified against the source before being acted on
- [x] 7.7 **Two-stage review before merge — both stages run, §14 and §15.**
      Stage 1 (gstack `/review`, six specialists + cross-model Codex) found
      three defects verified by executing code: a containment anchor escape, a
      backlog card deleted silently, and an intransitive comparator that
      mis-ordered the Archive column in 49% of random fleets. Stage 2
      (`superpowers:requesting-code-review`, fresh context) found no Criticals
      and four coherence defects, one of them against the security requirement
      stage 1 had just written. All seven fixed, each proved RED first

## 8. Hand back to `retire-v1-surfaces`

These are corrections to that change, made while it is still open. They are
listed here because this change is what makes them necessary, and they are cheap
now and a separate change once its delta is folded.

- [x] 8.1 Corrected its `project-dashboard` delta. The withdrawal of archived-change ordering from the *hybrid reader* stands — the board reads `archive/` independently by design decision 3, precisely so the `spec` check's hot path does not pay for board data — but the stated **reason** ("no successor because v2 renders neither") was false the moment this board existed, and the reason was the whole justification. Reason corrected, withdrawal kept
- [x] 8.2 Resolved by **scoping**, not by exception. `Dense Rows And Aligned Figures` now states which of its clauses bind which surfaces: uniform row height governs surfaces whose unit is a *row*, where a card-sized block is a density regression against a directly comparable alternative; horizontal fit and tabular figures bind every surface including this board. A scenario was added so the scoping is checkable rather than prose. The board is exempt from row height alone, and its tests assert the two clauses it is not exempt from
- [x] 8.3 Left untouched, as required — `CAPABILITY-MAP.md` is unmodified by this change. Leave the `openspec/CAPABILITY-MAP.md` prerequisite note to the cutover owner, per the design's migration plan — this change ships the surface, it does not declare the prerequisite discharged. (Round 3: this task previously claimed the note for itself and contradicted the design.)
- [x] 8.4 Correct `openspec/BACKLOG.md`'s two closed entries to upstream's marker convention — `## [RESOLVED] …` and `**Status:** RETIRED` — so `parseBacklog` closes them without loosening the matcher. Verified by running upstream's unmodified regexes over the corrected file: two closed, one open

## 9. Plan-review disposition — round 1 (2026-08-03)

gemini REQUEST-CHANGES (4), codex REQUEST-CHANGES (6), opencode
REQUEST-CHANGES (7). Every finding was verified against the code before being
acted on; the refutations are argued with the check, not the opinion.

**Fixed — the two that falsified the change's own claims:**

- [x] 9.1 The reviewer rule did not do what all three artifacts said it did. Latest-verdict filtering leaves `retire-v1-surfaces` in Execute because its four verdicts are from four *distinct* reviewers. Replaced by a veto: two approvals **and** no standing rejection. Found independently by codex and opencode
- [x] 9.2 The ship probe is not implementable at the bounded-git site — fixed argv, no ref, no pathspec — and a project-tree string in an argument vector is what `filesystem-access-policy` forbids at spawn site 3. `git log` is also the wrong probe (history, not containment). `ship` dropped to its own change; the board now spawns nothing. Found by opencode, sharpened by codex

**Fixed — the rest of the confirmed set:**

- [x] 9.3 "Five weeks" was six days (opencode)
- [x] 9.4 `archive/` is itself a directory under `openspec/changes/` and classified as a bogus Propose card; now excluded, with non-change entries (opencode)
- [x] 9.5 "Unresolved level-two entry" was undefined; now specified (gemini, opencode)
- [x] 9.6 Decision 2 asserted a project posture that gate 2.0.0 contradicts; the divergence is now stated as deliberately stricter than the gate, with its cost (opencode)
- [x] 9.7 Rules 2 and 6 both yielded `archive` with different meanings; now distinguished by source plus the `ready` marker, with a scenario (opencode)
- [x] 9.8 "A Change Name Is **Never** Silently Truncated" was contradicted by its own body; retitled (opencode)
- [x] 9.9 `(repo, change)` does not identify a card; identity and address are now the triple with `source` (codex, opencode)
- [x] 9.10 The lexical guard does not cover symlink escape; realpath containment and a regular-file check added, matching `coverageResolver` (codex, weakened from its original form)
- [x] 9.11 `archive (ready)` was an undocumented second divergence from ADR 0004; both divergences are now named (gemini)

**Refuted, with the check:**

- [x] 9.12 gemini: `../` in a change name traverses out. `isReadableProjectPath` (`packages/shared/src/schemas/read.ts:38`) rejects `.` and `..` segments, absolute paths, `~`, and drive letters
- [x] 9.13 opencode: the new route needs its own auth scenario. `auth-and-pairing` already carries "Bearer Token On Every Route" — "no anonymous access to any route"
- [x] 9.14 opencode: "latest verdict" ordering is undefined and load-bearing. Checked all twelve `REVIEWS.md` in the repo: none repeats a reviewer, because the producer rewrites the file per run. The invariant is specified instead of an ordering discipline
- [x] 9.15 gemini: the ship probe will not scale to thousands of archived changes. True of the original design and now moot — the probe is gone
- [x] 9.16 codex: "no fifth spawn site" is misleading. Half-refuted: the claim is sound because `integrations.ts` and `linear.ts` already call `runAllowedGit` outside the git route, so the function is the site by practice. The argv objection stands and is 9.2

**Carried, not fixed:**

- [ ] 9.17 codex: request coalescing, caching and corpus-size bounds beyond the single wall-clock bound. The bound-the-wait limitation is inherited knowingly from `readiness/service.ts` and is recorded in design decision 4; fixing it belongs to the shared read primitive, not to this board
- [ ] 9.18 codex: data minimisation for backlog titles, reviewer identities and task prose crossing the wire, and URL/referrer exposure of change names. The daemon is localhost-bound and already returns change names on existing routes, so this is not new exposure — but no requirement states the error-shape rule, and `repo-readiness` learned that lesson the hard way. Worth its own look before implementation

## 10. Plan-review disposition — round 2 (2026-08-03)

gemini, codex and opencode all REQUEST-CHANGES again, on almost entirely new
ground — round 1's findings were not re-raised. Two findings falsified claims
the round-1 revision had introduced, and both were verified against source
before being accepted.

**Fixed — the two that falsified round 1's own work:**

- [x] 10.1 **The reviewer divergence does not exist.** codex: the ADR 0004
      comparison is stale. Verified in
      `agents-task-viewer/src/openspec/reader.ts` — `classifyActiveChange`
      already returns `validate` on `hasRequestChanges`. Two rounds argued for a
      divergence from a rule the upstream implementation had already abandoned;
      ADR 0008 exists, is dated the same day as the change this design cites
      throughout, and had never been opened. The rule is unchanged in effect;
      its origin, framing and justification are rewritten. The parse grammar is
      now mirrored from upstream's `parseReviewEvidence` rather than invented,
      which also answers opencode 10.6
- [x] 10.2 **The "producer rewrites wholesale" invariant is false.** opencode:
      `archive/2026-08-02-close-readiness-spec-gaps/` holds `REVIEWS-round-1..3.md`
      beside a stale `REVIEWS.md`. The round-1 census that established the
      invariant ran `-name REVIEWS.md`, which structurally excluded the only
      counter-evidence in the repo. With a rejection now vetoing, a stale read
      strands a change whose rejection was cleared. Replaced by explicit
      staleness handling: classify from the highest-numbered round record and
      mark the card

**Fixed — the rest of the confirmed set:**

- [x] 10.3 The backlog rule failed on this repository's own `BACKLOG.md`: two of
      its three level-two headings are resolved via `**Status: ✅ RETIRED**` and
      an in-heading `✅ RESOLVED`, neither a checkbox nor strikethrough. Rule
      rewritten against that file, which is now the required fixture (codex,
      with opencode's over-collection point)
- [x] 10.4 The pre-read size cap required by round-1 review was silently dropped
      while its two companion checks were implemented. Restored as a named
      constant, checked before the read (opencode)
- [x] 10.5 The Archive column was unbounded — archives grow monotonically, so a
      mature repo rendered every change it ever archived. Bounded, ordered
      date-descending, with the withheld count stated (opencode, with codex's
      missing-ordering point)
- [x] 10.6 The verdict grammar, checklist-row syntax and archive-name validity
      were unspecified while stage classification hinged on them. Specified,
      mirroring upstream (opencode)
- [x] 10.7 "Not reported as malformed" (requirement 1) contradicted "cannot be
      parsed → reported" (requirement 5); an EACCES `proposal.md` satisfied both.
      Split explicitly: absent is silent, present-but-unreadable is reported
      (opencode)
- [x] 10.8 `(repo, source, name)` still collided for two dated archives of one
      slug and for duplicate backlog headings. Identity is now the entry's
      on-disk name — dated basename, or heading text plus index (codex, opencode)
- [x] 10.9 Corpus semantics were inconsistent: a design-only active directory was
      hidden while an empty dated archive directory became a card. The artifact
      test now applies to both, and a failing archive entry is reported rather
      than dropped (codex, with gemini's silent-malformed-archive point)

**Accepted as upstream's behaviour, not fixed:**

- [x] 10.10 gemini: a change with zero checklist rows is stuck at `validate`
      forever, which mishandles a purely declarative change. True, and it is
      upstream's rule (`checklist.length === 0`). Diverging would buy one
      better-classified card at the cost of the two boards disagreeing — the
      thing this change exists to avoid. Recorded as a stated consequence
- [x] 10.11 gemini: the board should not enforce a policy stricter than the
      ratified gate. Moot as of 10.1 — there is no stricter policy, and a board
      that displays a stage enforces nothing
- [x] 10.12 gemini: "Ready to Archive" should be its own column rather than
      sharing Archive. A fifth column contradicts the four-column layout just
      settled, and upstream shares the column too, distinguishing by a textual
      `ready`/`archived` state. Matching upstream wins; the `ready` marker and
      the source field already carry the distinction

**Carried, not fixed:**

- [x] 10.13 codex: caching, citing `daemon-runtime`. **Checked, and the citation
      holds.** `Response Caching Cadences` requires the daemon to cache expensive
      computations server-side, naming "derived fleet aggregates on their own
      cadence", with explicit invalidation. This board's endpoint is by its own
      design note the most expensive read the daemon performs. So the durable
      spec already binds it and needs no delta — the change was simply
      non-compliant with a requirement that already existed, the same shape as
      the sanitiser change's fleet-degradation gap. Now task 4.4. In-flight
      coalescing and aggregate-size bounds stay carried below
- [ ] 10.14 codex: disclosure rules for degradation reasons and drawer payloads —
      symbolic error codes, no absolute paths or usernames, plain-text rendering
      of author-controlled names. Carried from 9.18. `repo-readiness` shipped a
      leak of exactly this shape, so this is the one carried item with a
      demonstrated failure mode behind it
- [ ] 10.15 opencode: the "twelve files" census is self-referential and the count
      will drift. Moot for the spec text, which no longer cites a count — but the
      lesson is recorded rather than dropped

## 11. Plan-review disposition — round 3 (2026-08-03)

Three REQUEST-CHANGES again, ~19 findings. Four were defects the round-2
revision itself introduced. The rest exposed a pattern rather than a list, and
the response was to change approach rather than fold findings one by one.

**The pattern: hand-writing rules that already exist upstream.** Verifying
gemini's "delta spec is undefined" led into `reader.ts`, which already contains
`parseBacklog` (code-fence aware, anchored `closedHeading`/`closedBodyLine`),
`backlogSlug`, `sourceIdentity`, `occupiedSlugs`, `MAX_SOURCE_RECORDS` with a
`truncated` notice, `parseChecklist`, and the symbolic notice vocabulary. Every
one had a hand-written substitute in this delta, and the reviewers' findings were
the seams in those substitutes. The corpus rules are now **cited, not restated** —
the same correction round 2 applied to the stage machine, applied to the reader.

- [x] 11.1 Backlog markers: substring matching closed `Redone migration` and
      `Add WITHDRAWN flag support` (codex, opencode). Replaced by upstream's
      anchored matchers. This repository's `BACKLOG.md` was the reason the rule
      had been loosened; **the file was corrected instead** (task 8.4), verified
      by running upstream's unmodified regexes: two closed, one open
- [x] 11.2 Backlog identity as "heading text plus one-based index" required
      composite encoding inside a single parameter — reintroducing the hazard
      decision 7 exists to prevent (opencode). Replaced by `backlogSlug` and
      upstream's NUL-joined `sourceIdentity`, which no author string can forge
- [x] 11.3 Code-fenced `## ` lines were indistinguishable from headings
      (opencode). Upstream's fence tracking covers it
- [x] 11.4 Checklist grammar was left to implementation while the verdict grammar
      was specified line-by-line (opencode). Both now cite upstream
- [x] 11.5 "Delta spec" was never defined (gemini). It is `specs/<name>/spec.md`,
      per upstream's `deltaSpecCount`
- [x] 11.6 Per-source bounding and `truncated` notices replace the hand-rolled
      archive-only bound, which also resolves codex's contradiction between
      "render one card per change discovered" and a withholding column
- [x] 11.7 Symbolic notice kinds (`collision`, `empty-slug`, `evidence-limited`,
      `malformed`, `rejected`, `truncated`) answer the disclosure finding carried
      since round 1 (9.18 → 10.14): the vocabulary is symbolic and path-free by
      construction

**Fixed — the four self-inflicted defects:**

- [x] 11.8 `proposal.md` Capabilities still said "five-column" after decision 5
      dropped `ship` (codex, opencode)
- [x] 11.9 "A vendor that has already approved SHALL NOT be counted twice" (first
      wins) contradicted "a vendor appearing twice resolves to the later section"
      (last wins) (opencode). Resolved upstream's way: any rejection sets the
      flag regardless of position, and there is no order rule
- [x] 11.10 Containment was scoped to the project root, so a symlink under
      `openspec/` could still surface `.env` or `.git/config` from inside the
      same repository (codex). Now scoped to `<root>/openspec`
- [x] 11.11 Task 8.3 claimed the `CAPABILITY-MAP.md` note while the design
      assigned it to the cutover owner (codex). Task corrected

**Fixed — remaining confirmed:**

- [x] 11.12 Round-record selection only handled `REVIEWS.md` lagging the rounds;
      a `REVIEWS.md` rewritten after the last round classified from staler
      evidence, and "highest-numbered" never said numeric or lexicographic
      (opencode, codex). Now most-recently-modified wins, numbers compare
      numerically, and a reviewer absent from the selected record has no verdict
- [x] 11.13 "One divergence exists" was asserted from a single quoted clause
      (opencode). Two departures are now enumerated and the rest shown to be
      upstream's; the conformance test is what makes it checkable
- [x] 11.14 The conformance test was described as deferred in the risks while
      task 2.9 required it (opencode). The risk text now matches the ledger
- [x] 11.15 Column sort order was unspecified, and rule-5 `ready` cards had no
      entry date to sort by (codex, opencode). Every column now has a total,
      stable order with identity as the tie-break

**Refuted or declined:**

- [x] 11.16 gemini: backlog identity should be a content hash for durability
      under reordering. `backlogSlug` is upstream's answer and is stable under
      reordering already, since it derives from the title, not the position. A
      hash would also make the address unreadable
- [x] 11.17 gemini: the marker set should be configurable or extended with
      `WONTFIX`/`CLOSED`. `CLOSED` is already in upstream's set. Extending it
      unilaterally recreates the divergence this round removed — propose it
      upstream instead
- [x] 11.18 codex: tasks 8.1–8.2 modify another open change despite the proposal
      declaring no modified capabilities. Disclosed, not hidden — the proposal's
      Capabilities section states both couplings and why they are corrections to
      `retire-v1-surfaces` rather than deltas of this change

**Carried:**

- [ ] 11.19 codex: in-flight coalescing and fleet-wide cardinality bounds beyond
      the per-source bound and the response cache. Narrower after 11.6 and task
      4.4, and still not nothing under five-second polling
- [ ] 11.20 opencode: no cadence or staleness budget is stated for the cache, and
      the endpoint's bound is not required to be a named constant while the read
      cap and source bound are. Worth settling with task 4.4 rather than after it
- [ ] 11.21 opencode: non-dated entries parked under `archive/` will generate
      persistent skip notices. Real, and the fix is a judgement about noise
      versus silence that should be made against a live fleet, not guessed here

## 12. Plan-review disposition — round 4 (2026-08-04)

The first round with **code to review**, not only artifacts. gemini and codex
both REQUEST-CHANGES; opencode's record is truncated mid-preamble with no
`VERDICT:` line, so it counts as absent rather than as either verdict — which is
the reviewer rule this change specifies, applied to its own evidence.

**Confirmed and fixed — the two that were defects in shipped code:**

- [x] 12.1 **TOCTOU in every artifact read** (codex). `readGuarded` did
      `realpath` → `stat(path)` → `readFile(path)`: three separate resolutions of
      one name, so a path swapped between the size check and the read would be
      checked as one file and read as another. **Upstream already had the right
      shape** — `readEvidenceText` opens `O_RDONLY|O_NOFOLLOW` once and `fstat`s
      the descriptor — so this was a regression against the code this change
      exists to mirror. Now opened once, statted and read on that descriptor.
      `O_NOFOLLOW` also makes the rule simply "no symlinked artifacts" wherever
      they point, which is upstream's rule; the in-tree-symlink test asserted an
      exception upstream does not have and now asserts the refusal
- [x] 12.2 **The drawer's same-name scenario was unreachable** (codex). It paired
      a backlog entry with an active change of the same name — the exact pair
      `occupiedSlugs` suppresses, so no reader could produce it. The
      deduplication rule is upstream's and correct, so the *scenario* was wrong.
      Replaced with active + archive of one slug, which ADR 0008 decision 3
      permits in terms and which is what actually makes `source` load-bearing in
      the address

**Confirmed and fixed — spec text that contradicted the code:**

- [x] 12.3 **Identity still mandated `sourceIdentity(repositoryRoot, …)`** while
      the code used the registry id (codex). The substitution was recorded in
      task 1.1 and the module docblock and never made normative, so the delta and
      the implementation disagreed. The registry id is now specified, with the
      reason: upstream has no registry and the root is its only handle; putting
      the root in the identity puts an absolute path, and a username, in every
      card of every response
- [x] 12.4 **A third departure was undeclared** (codex) while the spec said there
      were exactly two and that everything else was upstream's, mirrored.
      Upstream admits an artifact-less directory under `changes/` as a `propose`
      card; this board contributes nothing for one, silently. Now enumerated as
      departure 3, with its reason — this board reads *registered repositories*
      and so meets scratch directories and `README.md` files that upstream's
      session-discovered corpus never sees

**Refuted, with the check:**

- [x] 12.5 gemini: the pre-read size cap "was left unimplemented" and shipping
      without it is a DoS vector. It is implemented:
      `MAX_CHANGE_FILE_BYTES = 1024 * 1024` at `changeReader.ts:61`, enforced
      before the read at the descriptor, with tests in §3.12 including one at
      exactly the cap. gemini read the specification's *narration of round-1
      history* — "was the one of the three left unimplemented" — as a statement
      of present state. The sentence is accurate about round 1 and misleading
      out of context
- [x] 12.6 gemini: this change should be marked a formal blocker for
      `retire-v1-surfaces` or the durable specs conflict. Moot — the two
      corrections are already made **in that change's own files** by tasks 8.1
      and 8.2, so there is no ordering in which they are lost

**Carried, knowingly:**

- [ ] 12.7 codex: the endpoint is not fleet-bounded — no aggregate byte, card or
      concurrency bound, no request coalescing or cancellation. Same item as 9.17
      and 11.19, narrowed but not closed by the per-source bound and the response
      cache. Belongs to the shared read primitive
- [ ] 12.8 gemini and codex: **review-record ordering by `mtime` is not
      semantic** — a `touch`, a `cp`, or a branch switch reorders records without
      changing their content. Both proposed round-number-primary with mtime as
      tie-break; that is refused, because an unnumbered `REVIEWS.md` has no round
      to sort by, so the rule cannot express "a `REVIEWS.md` rewritten after the
      last round wins" — the scenario §11.12 exists to protect. The better answer
      is the record's **own declared timestamp**: the current producer writes
      `_generated <ISO>_` into every section, and `retire-v1-surfaces` carries a
      `reviewed_at:` front-matter field. Ordering on that, with `mtime` as the
      fallback for older records that carry neither, is semantic and survives git
      operations. Not folded in here because it changes a specified, tested rule
      and deserves its own pass
- [ ] 12.9 gemini: the deep-link not-found state is required but its presentation
      is unspecified. The implementation renders a `role="status"` banner above
      the board; the specification says only "states that the change was not
      found". Worth pinning, and not a defect

## 13. Design critique disposition — rounds 1 and 2 (2026-08-04)

Two isolated assessments per round, neither able to see the other's output. Full
record in `CRITIQUE.md`.

**Round 1 scored 22/40 (composite 55) against a floor of 32/40 (80).** Both
assessments independently reached the same two findings: the drawer was a
landmark (`role` null, `aria-modal` null, computed `complementary`) behaving as a
modal with no Escape, no focus management, no scrim and its close control at tab
stop 79 of 80; and the stage rail declared `role="tablist"` with no
`aria-controls`, zero `tabpanel`s in the document and no arrow-key handling —
announcing a pattern it did not implement.

- [x] 13.1 Drawer given the dialog contract it was claiming: `role="dialog"`,
      `aria-modal`, focus in on open and restored to the originating card on
      close, Tab trapped both directions, Escape, dismissing scrim, close target
      24×24 → 32×32 and first in the panel's tab order
- [x] 13.2 Checklist showed all 129 rows completed-first — 8,282px, with the
      first outstanding row 4,760px down — and rendered literal backticks and
      asterisks. Now outstanding-only by default (21 rows, 1,206px) with the rest
      behind a disclosure that states its count, and inline code and bold
      tokenised into real elements by a recursive tokeniser that never touches
      `innerHTML`
- [x] 13.3 Stage rail made a real tab widget; the duplicate column heading it
      rendered eight pixels beneath itself is dropped in the paged layout
- [x] 13.4 Archive held 45 of 60 cards — 75% of the board given to work that by
      definition is not in flight. Bounded to 10 with the withheld count stated,
      plus a repository filter. Live page scroll 4,687px → 900px
- [x] 13.5 Counts labelled and suppressed at 0 of 0 (15 archive cards were
      rendering a ratio counting nothing); `Filed <date>` and `● Ready to
      archive` so the two archive readings differ in shape rather than only in
      wording; `Partly read` in the text rather than a mouse-only `title`
- [x] 13.6 Reduced-motion guard on the loading skeleton, matching the
      `motion-reduce:` convention `ManualPairForm` already ships; `aria-expanded`
      and Escape on the compact navigation panel

**Round 2 scored 27/40 (67.5%). Still below floor**, and it found a defect in
one of round 1's own fixes.

- [x] 13.7 **The paged layout opens on the wrong stage, and the code contradicts
      its own comment.** The comment says "the fullest stage that is not
      Archive"; the code is `['execute','validate','propose'].find(c => counts[c] > 0)`,
      which is *latest non-empty*. On the live fleet it selects Execute (2 cards)
      over Validate (12). **The existing test passes with the wrong behaviour**,
      because its fixture has only one non-empty stage — the same vacuity the
      §2.11 revert check exists to catch, missed here
- [x] 13.8 **"Changes requested" renders on archived cards, where it is false.**
      Verified against the live registry: 5 of 45 archived cards carry
      `hasRequestChanges`, so `fix-readiness-sanitiser-colon-hazard` — filed,
      40/40 — shows the amber flag, and its drawer asserts "this holds the change
      at Validate however many others approve". Rule 1 wins outright for an
      archived card and the reviewer clause never runs, so the sentence is not
      merely noisy but wrong
- [x] 13.9 "Show all N archived" is `setShowAll(true)` — one-way, while the
      sibling checklist disclosure correctly toggles
- [x] 13.10 Em dashes in rendered UI copy ("proposal.md — present"), which the
      design skill's own copy rules ban
- [x] 13.11 Repository-filter chips were 22.7px tall, **below the 24px WCAG
      2.5.8 floor**, and selection was signalled by hue and font weight alone
      (the selected tint is 1.16:1 against the surface). Now `py-1.5` at 29px
      measured, with a border on the selected chip. Its placement as a
      card-surfaced band is left as recorded — that is composition, and it goes
      with 13.18

**Two defects the second assessment found that live data could not show:**

- [x] 13.12a **`--color-status-success-bg` does not exist.** The `● Ready to
      archive` badge used `bg-status-success-bg`, which computes to
      `rgba(0,0,0,0)` — no fill at all. Invisible in testing because **0 of 60
      cards in the live fleet have `ready: true`**. Now `bg-status-success/10`,
      the convention `Toast`, `CodeIntelligencePage` and `ManualPairForm`
      already use. Verified in the browser: resolves to a real green at 0.1
      alpha
- [x] 13.12b **`--color-status-warning-border` does not exist either.**
      `DegradedNotice` used it and fell back to `currentColor`, so a degraded
      board would have drawn a text-coloured hairline instead of a warning
      border. Unreachable in live data because no repository is failing. Now
      `border-status-warning/40`. Both were plausible-looking token names I
      invented rather than checked

**Carried — these are product decisions, not defects:**

- [x] 13.16a **Round 3 found an over-correction in 13.8's fix.** Suppressing "Changes requested" was right on the card, but deleting it from the *drawer* lost an audit-relevant fact — that a reviewer objected and the change was archived anyway. The drawer now records it in the past tense instead of claiming it in the present, so the reader no longer gets a false negative on "did anything ship over an objection?"
- [ ] 13.16 The drawer is a dead end: two focusables and no action, on a surface
      whose job is triage. `POST /open` already exists in this product. A footer
      action row is three links and no new data, but it is a scope decision
- [ ] 13.17 **The board cannot rank — and this is unfinished work, not
      structural debt.** The round-3 assessment challenged this record's own
      framing and was right: `updatedAt` is on all 60 wire records and rendered
      nowhere, and `reviewerVendors` already separates 1 of 12 Validate cards
      while being visible one drawer at a time. Rendering an age and an approval
      count finishes the capability that shipped rather than opening a product
      question, and labelling it "structural" makes it easier to keep not doing.
      Note also that the argument used to kill the false archived flag — a
      warning that is always wrong teaches you to ignore warnings — applies
      unchanged to a *true* warning firing on 12 of 12 cards. Original wording:
      the board cannot rank. Twelve Validate cards are stuck for one
      reason and nothing says which to unstick first — approvals, request counts
      and age are all already on the wire record and none is on the card
- [ ] 13.18 **~45% of the board box is empty at 1440** (measured in round 3, worse than the ~40% first recorded): `repeat(4, minmax(0,1fr))` gives a one-card column the same quarter of the screen as a twelve-card one. Also cheap — one `gridTemplateColumns` value in a file this change already edits. Not debt
- [ ] 13.19 Checklist rows render line one of a multi-line task, so several end
      mid-sentence. **Inherited from upstream's `parseChecklist`**, which matches
      a row's first line only — the same grammar §2.5 mirrors deliberately.
      Joining continuation lines would be a divergence and belongs upstream

## 14. Two-stage review disposition — stage 1 (2026-08-04, task 7.7)

Stage 1 is gstack `/review`: the structured critical pass, six specialists
dispatched in parallel (testing, security, api-contract, performance,
maintainability, design), and a cross-model Codex adversarial pass. Codex's gate
is **FAIL** — nine P1s, closing recommendation "Block the merge."

Three defects were **verified by executing code**, not by reading it, and all
three are fixed. Each went RED before its fix, per `prove a new test can fail`.

- [x] 14.1 **`openspec/` as a symlink redefined the containment anchor**
      (security specialist and Codex, independently — same line, different
      models). `realpath(<root>/openspec)` became the one boundary `contained()`
      checks against, so a registered repository whose only content is
      `openspec -> /elsewhere` yielded full cards read from outside the root,
      with `notices: []`. Every per-path guard passed, because each path really
      did lie under the boundary the reader had adopted; the boundary was what
      escaped. Reproduced against a temp repo before fixing. **This violates
      `filesystem-access-policy`**, so per CLAUDE.md it was surfaced rather than
      quietly patched: a new requirement, `A Containment Anchor Is Verified
      Against Its Registered Root`, is added as a delta with three scenarios,
      and the anchor is now checked against `realpath(root)`. The existing
      symlink tests all covered symlinks *under* `openspec/`; none covered
      `openspec` *being* one. Two tests added, including the control that an
      `openspec` symlinked **within** its own root is still admitted
- [x] 14.2 **A non-change directory silently deleted a real backlog card**
      (Codex). `occupiedSlugs` was filled from every candidate directory under
      `changes/` before any of them was known to be a change, so a scratch
      directory `changes/scratch-notes/` removed the backlog entry
      `## Scratch Notes` while contributing no card of its own — and emitted no
      notice. Reproduced: the entry vanished from both sources with
      `notices: []`. Slugs are now occupied where the record is pushed, on both
      the active and archive sides, which is what upstream's rule actually says
      ("already an active or archived *change*")
- [x] 14.3 **`compareChangeCards` was not a total order** (found in the
      structured pass, then independently by the testing and api-contract
      specialists, who built a different cycle). The archive rule governed
      archive/archive pairs and `updatedAt` governed every other pair, and the
      two contradict: a ready card, a dated card and a propose card form a
      cycle. Both `service.ts` and `ChangeBoardPage.tsx` sort the **whole fleet**
      before grouping, so the cycle corrupted the rendered column — **1,956 of
      4,000 random fleets left the Archive column mis-ordered against the rule
      the module states in prose**, and a three-card fleet reproduces it. Stage
      is now the primary key, which makes the order transitive and leaves every
      within-column rule unchanged. The module's "one total order" claim is now
      true rather than aspirational. Note the coverage hole that allowed it:
      `packages/shared` had **no** test for the comparator, and the one test
      that touched it used `[...cards].sort(compareChangeCards)` as its own
      expected value — tautological, and same-stage only. Four tests added,
      covering transitivity over every triple, antisymmetry, totality, and the
      ready-ahead-of-dated rule asserted **of the rendered column**

**Mechanical cleanups applied in the same pass** (verified, each one-line):

- [x] 14.4 `isReachable` in `service.ts` was a character-for-character copy of
      `registry.ts`'s export, in a module that already imported from it
- [x] 14.5 `BacklogRecord.documentIndex` was written in four places and read in
      zero — the wire contract at `changes.ts:16` records the decision to drop it
- [x] 14.6 The loading state's `aria-label` sat on a bare `div`, where it is
      dropped from the accessibility tree; the other three board states already
      carry `role="status"`. Its test passed regardless, because
      testing-library matches the attribute without checking the role
- [x] 14.7 `aria-expanded={navOpen ?? false}` guarded a nullish the prop default
      excludes; `aria-controls` dangled whenever the panel was closed, which is
      the rule `StageRail` already follows in the same diff
- [x] 14.8 `StageColumn`'s disclosure condition carried `(bounded || showAll)`,
      a term that cannot be false when the other two hold
- [x] 14.9 Three badges used `text-[11px]` where `--text-xs` is 11px with no
      paired line-height, so the arbitrary value emitted identical CSS and only
      detached them from the scale

**Carried, not fixed** — recorded with evidence, none blocking on their own:

- [ ] 14.10 **Schema drift is reported as a connectivity failure.**
      `changesQueries.ts` throws `SchemaDriftError` carrying the measured drift;
      the board collapses it into `board.isError` and renders "The daemon did
      not answer." The sibling `FleetPage.tsx:368` handles it properly, and its
      own comment records this exact defect being fixed there once already
- [ ] 14.11 **New SPA against an old daemon degrades misleadingly.** The
      `/changes` sidebar entry is unconditional, the SPA reads the daemon
      version nowhere, and a daemon without the route 404s into that same
      screen. Given a static SPA on Pages and a locally-installed daemon this is
      the normal case, not an edge case
- [ ] 14.12 **The board never refetches.** `staleTime: 5_000` with no
      `refetchInterval`, while both `changesQueries.ts` and `service.ts:33`
      justify the 5s memo by a client that polls at that cadence. Sibling read
      hooks do set the interval. Either add it or correct both docblocks
- [ ] 14.13 **`invalidateChangesCache` has no production caller** (performance
      and maintainability, independently). Its docblock says "an action that
      changes what the board reads calls this" and claims to satisfy `Response
      Caching Cadences`; nothing calls it but its own test, and `writeRegistry`
      invalidates the conformance and coverage caches but not this one. The
      registry-content cache key covers registry mutations incidentally, so the
      practical gap is narrow — the false spec claim is not
- [ ] 14.14 **Unbounded aggregate response** (security, performance and Codex).
      No fleet-level card or byte cap, and `parseChecklist` has no row cap
      against a 1 MiB `tasks.md`. Measured: 216,902 bytes for the current 60
      cards, ~4.4 KB per record, dominated by checklist text the card does not
      render. Extends carried item 12.7 with numbers
- [ ] 14.15 **No request coalescing** (performance and Codex; carried since
      round 1 as 9.17 / 11.19 / 12.7). Now measured: four concurrent requests
      cost 2.49x the wall time and 4x the filesystem work
- [ ] 14.16 **The corpus walk is serial.** ~35 sequential syscalls per change
      directory, benchmarked at 10.64 ms serial vs 3.52 ms at concurrency 8 on
      this repository's own tree
- [ ] 14.17 **`statSync` runs on the event loop** inside the request path and
      deliberately *outside* the bound, so the one call that can hang hardest is
      the only unbounded one. Precedented elsewhere in the daemon
- [ ] 14.18 **The evidence parsers are not fence-aware** (Codex). Reviewer
      headings, verdicts and checklist rows inside fenced examples are counted,
      so a `tasks.md` holding only a fenced completed example plus a `REVIEWS.md`
      holding two fenced approvals can classify as ready to archive. Note
      `parseBacklog` *is* fence-aware, so this is an inconsistency within the
      mirrored parsers, not a uniform upstream property — worth checking
      upstream before diverging
- [ ] 14.19 **Invalid archive dates sort as real ones** (Codex). Both
      `archivedSlug` and the wire schema check only `YYYY-MM-DD` *shape*, so
      `2026-99-99-release` displays as a filed date and sorts ahead of every
      genuine 2026 entry
- [ ] 14.20 **`changeReader.test.ts` asserts against the live tree.** It
      requires `toContain('add-agent-change-board')` from this repository's own
      `openspec/changes/`, so `/opsx:archive` — the literal next step — turns it
      red on main. Fix before archiving, not after
- [ ] 14.21 Test-quality gaps the testing specialist named that this pass did
      not close: `updatedAt` asserted only `> 0` (the max-of-mtimes rule is
      unpinned, and it is the sort key for three columns),
      `backlogSlug('A thing') === backlogSlug('A thing')`, a `typeof … ===
      'boolean'` on a value the return type guarantees, `ARCHIVE_VISIBLE_LIMIT`
      never imported by the test that bounds it, no `boardLayout`/`shellLayout`
      tests, no `changesQueries` test, and five of six notice kinds unrendered
- [ ] 14.22 **Out of diff, flagged not fixed:** `resolveAllowed` in
      `packages/agent/src/lib/paths.ts` realpaths each allowed subdir without
      re-anchoring to the realpath of the project root — the same shape as 14.1.
      Pre-existing, so out of scope for this branch; it should get its own change

**Design came back clean**, which is worth recording because two rounds did not:
all 21 referenced tokens exist in `tokens.css` in both appearances, the two
invented tokens are gone, the drawer satisfies the full dialog contract
(`role`/`aria-modal`/focus move/focus restore/Escape/Tab trap/scrim), every
interactive element is a real control, and the board cannot reintroduce
horizontal overflow. One gap: `border-status-warning/40` is the sole pairing
`verify-contrast.test.ts` does not assert, and it composites to 1.80:1 in light
against a 3.0 non-text floor.

**The shell fix is scoped.** `TopBar`, `Sidebar` and `AppShellV2` carry only
overflow-related edits plus the one new nav entry — no unrelated restyling,
which was the Surgical Changes risk on this branch.

## 15. Two-stage review disposition — stage 2 (2026-08-04, task 7.7)

Stage 2 is `superpowers:requesting-code-review` over the full branch including
stage 1's fixes, dispatched with fresh context. **No Critical findings.** The
reviewer independently checked stage 1's work rather than taking it on trust:
it ran the *pre-fix* comparator against the new test's fixture and confirmed it
returns `['c2','c0']` against an expected `['c0','c2']`, so the test
discriminates; it looked for a residual bypass of the new anchor check and found
none (sibling-prefix `/repo` vs `/repo-secrets` is handled, both sides come from
`realpath` so a case-insensitive filesystem cannot split them, and a symlink
under the anchor is still refused by `contained()`).

Four **Important** findings, all confirmed against the code and all fixed. Every
one is the same failure mode this branch has now caught five times: a corrected
artifact leaving an uncorrected sibling.

- [x] 15.1 **The new anchor refusal was silent, against the scenario written in
      the same commit.** `changeReader.ts` returned `{ records: [], notices: [] }`,
      which is byte-identical to a repository with no `openspec/` at all — while
      `filesystem-access-policy`'s new scenario requires "the repository's
      failure is reported through the symbolic vocabulary". The stage-1 test
      asserted only `records).toEqual([])` and never looked at the report, which
      is exactly how the gap survived being written an hour earlier. Now a named
      `ContainmentAnchorEscaped`, caught by name in `service.ts` and mapped to
      `read: 'failed', reason: 'unreadable'` — repository-level, because no
      source was attempted and `a active entry was refused` would name something
      that never happened. Both the reader test and a new service test were
      proved RED against the silent return before the fix
- [x] 15.2 **The Archive column applied a bound no requirement permitted.**
      `ARCHIVE_VISIBLE_LIMIT = 10` versus the delta's "No column applies a
      second, silent bound of its own" — a clause §11.6 wrote specifically to
      delete a hand-rolled archive bound, which §13.4 then reinstated in code
      without touching the spec. Resolved in the spec's favour by describing
      what the product actually does: the Archive column may bound what it
      renders **by default**, because it is the one column that only grows,
      provided the bound names the true total, reverses in both directions, and
      withholds nothing from the response. A scenario pins all three
- [x] 15.3 **The change's two deltas described two different boundaries.**
      `agent-change-board` still required every path to lie under the literal
      `<registered project root>/openspec`, which the new
      `filesystem-access-policy` delta deliberately contradicts by admitting an
      `openspec` symlinked *within* its own root — a case this change's own
      control test asserts. The clause now cites the verified anchor and names
      the requirement that governs it, instead of restating a path
- [x] 15.4 **`ChangeBoardRoute`'s docblock argued from the pair §12.2 proved
      unreachable**, claiming a backlog entry and an active change of one name
      are "the ordinary case" when `occupiedSlugs` means no reader can emit that
      pair. The spec was corrected in round 4; this file was not. Now cites the
      reachable active/archive collision, and `ChangeDrawer.test.tsx`'s describe
      block is renamed for what it proves rather than for an impossible example
- [x] 15.5 **Carried item 14.20 closed in the same pass**, on the reviewer's
      recommendation: `changeReader.test.ts` no longer requires the live tree to
      contain `add-agent-change-board`, so `/opsx:archive` no longer turns it red
      on main. It asserts the structural properties instead — at least one active
      change, no record named `archive`, every archive `sourceInstance` dated

**Stage 2 findings recorded but not fixed** — all Minor, none blocking:

- [ ] 15.6 A dead guard: `changeReader.ts`'s `relativePath !== 'openspec'`
      special case cannot be taken, because `listDirectory` is never called with
      the anchor directory
- [ ] 15.7 Dedup slug asymmetry: the active side occupies `backlogSlug(name)`,
      the archive side the raw `archivedSlug`, so `2026-01-01-Add_Thing` occupies
      `Add_Thing` while the backlog heading "Add Thing" slugs to `add-thing` and
      the dedup misses. Pre-existing; the stage-1 commit touched both lines
      without normalising them
- [ ] 15.8 Records dropped by `MAX_SOURCE_RECORDS` no longer occupy their slugs
      after 14.2's fix, so past 128 records a matching backlog entry reappears.
      Practically unreachable; nothing asserts either behaviour
- [ ] 15.9 A symlinked `REVIEWS.md` is skipped silently — `listDirectory` marks
      symlinks `directory: true`, so the review-record scan drops it with no
      notice while a symlinked `proposal.md` rejects the whole change. The change
      then classifies `validate` for want of evidence it does have
- [ ] 15.10 `MAX_SOURCE_ENTRIES = 2048` is an undocumented second bound that
      refuses a whole source rather than truncating it, and its notice carries no
      `observed`, so it cannot say what it lost
- [ ] 15.11 UI copy: "a active entry could not be read" / "a archive entry was
      refused" — article agreement
- [ ] 15.12 The paged layout can open on an empty stage: the opening-column
      reducer covers `propose|validate|execute` only, so an archive-only fleet
      opens on Propose showing "No changes"
- [ ] 15.13 `proposal.md` and `design.md` are read in full purely to test
      presence — up to 1 MiB each, per change, per repository, per cold poll. An
      `fstat` answers the question. Sharpens 14.14/14.16
- [ ] 15.14 Failed repositories still become filter chips, so selecting one
      yields four empty columns for a repository the banner just said was
      unreadable. Overlaps the testing specialist's 14.21 note
- [ ] 15.15 `boardLayout.ts`'s `SHELL_SIDEBAR_PX = 240` is only an input to a
      true derivation above the compact boundary; below 640px the sidebar leaves
      the grid, so the module's "arithmetic with its inputs named" claim is half
      true
- [ ] 15.16 The compact nav panel has Escape and `aria-expanded` but, unlike the
      drawer it says it "pairs with", never moves focus in, traps Tab, or
      restores focus on close

**The reviewer also recommended promoting 14.18 above "carried"**, and the
reasoning is sound: `parseBacklog` is fence-aware while `parseReviewEvidence`
and `parseChecklist` are not, so the inconsistency is *internal to the mirrored
parsers* rather than inherited from upstream, and the consequence is a wrong
**stage** — a `tasks.md` whose only rows sit in a fenced example plus a
`REVIEWS.md` with two fenced approvals classifies as ready to archive. Left
carried rather than fixed here because it changes a mirrored parser and should
be checked against upstream first, which is a change of its own.

**Verification after stage 2:** shared 500, agent 1741 (+1 skipped), spa 1628.
`pnpm -r typecheck` clean, `pnpm lint` 0 errors (222 warnings, unchanged in
kind), `openspec validate --all` 18/18.

**Assessment carried from the reviewer: ready to merge with fixes — and the
fixes are applied.** All four Important findings are closed; what remains is
eleven Minor items and the carried set in §14, none of which the reviewer
considered blocking.

## Out of scope

- [ ] Do NOT render live agent-session counts, and do NOT add the host adapters
- [ ] Do NOT modify `agents-task-viewer`
- [ ] Do NOT build a `ship` stage or any git probe — deferred to its own change
- [ ] Do NOT widen `GIT_ALLOWED_CMDS` or add a fifth process-spawn site
- [ ] Do NOT extend `openspecReader.ts` — the board reads independently by design
- [ ] Do NOT run the `retire-v1-surfaces` cutover
