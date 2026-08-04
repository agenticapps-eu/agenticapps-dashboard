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

- [ ] 7.1 `pnpm --filter @agenticapps/dashboard-shared test`, `pnpm --filter @agenticapps/dashboard-agent test`, and the SPA suite green — run per package, not `pnpm -r test`
- [ ] 7.2 `pnpm -r typecheck` clean and `pnpm lint` with zero errors
- [ ] 7.3 `impeccable:critique` at 1440×900 against `/changes`, composite ≥ 80, artifact committed
- [x] 7.4 **Verified against the live daemon and the real registry**, which is what caught the shell defect in 5.9. `GET /api/v2/changes/fleet` answers 401 unauthenticated and 200 with the bearer token; 60 cards across 3 registered repositories, 0 notices. The board classifies **its own change** correctly — `add-agent-change-board` sits in Validate with `hasRequestChanges: true` and 99/119 checklist rows, read from `REVIEWS.md`. Mocked responses would not have shown either the status codes or the overflow
- [x] 7.5 `openspec validate --all` green
- [ ] 7.6 Two other-vendor plan reviews recorded in `REVIEWS.md`; findings verified against the code before being acted on, and refutations argued with the check rather than the opinion. **The first round is done and its disposition is §9** — re-run after these revisions, because the reviewed artifacts have changed materially
- [ ] 7.7 Two-stage review before merge

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

## Out of scope

- [ ] Do NOT render live agent-session counts, and do NOT add the host adapters
- [ ] Do NOT modify `agents-task-viewer`
- [ ] Do NOT build a `ship` stage or any git probe — deferred to its own change
- [ ] Do NOT widen `GIT_ALLOWED_CMDS` or add a fifth process-spawn site
- [ ] Do NOT extend `openspecReader.ts` — the board reads independently by design
- [ ] Do NOT run the `retire-v1-surfaces` cutover
