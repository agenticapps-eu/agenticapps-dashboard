# agent-change-board Specification

## Purpose

Work in this fleet moves through the OpenSpec lifecycle, and until this board
existed there was no way to see it moving. `openspec list` answers one
repository at a time; the readiness surfaces answer whether a repo is sound,
not what is in flight across all of them. So the question a maintainer actually
opens the dashboard with — **what is being worked on right now, and what is
stuck waiting on me?** — had no surface at all.

This capability answers it as a four-column board: one card per admitted change
record across every registered repository, placed in `propose` · `validate` ·
`execute` · `archive` by an ordered rule set. Stage is a *place* here rather
than a value you scan a column for, which is what makes a fleet legible at a
glance in a way a table is not.

Two rules carry most of the weight. The first is that the corpus rules are
**upstream's, not this specification's** — `agents-task-viewer`'s reader and
ADR 0008 define what qualifies as a change, how entries are named, and how they
deduplicate, and this board mirrors them rather than restating them. Every
deliberate departure is named and demonstrated by a conformance test rather
than counted in prose. The second is that **absence and failure are different
facts**: a repository with no `openspec/` contributes nothing silently, while a
repository that could not be read is named with its reason. Nothing satisfies
both readings, and a degraded board never renders as an ordinary empty one.

The board reads. It adds no read root, spawns no process, and does not claim a
change has shipped — that last one would require a git invocation the security
spine deliberately forecloses.

## Requirements

### Requirement: The Board Shows Every Registered Repository's Changes

The board SHALL render one card per **admitted** OpenSpec change record across
the registered repositories, and its population SHALL be registry-scoped: a
repository that is not registered contributes no cards, and no card is produced
by walking family roots or any other directory the registry does not name.
Records the corpus rules below exclude, and records dropped by the per-source
bound, are not cards — they are reported per `The Board Degrades Per Repository
And Names What It Lost`.

**The corpus rules are upstream's, not this specification's.** Three sources
contribute cards — `active`, `archive`, `backlog` — and what qualifies for each,
how each is named, and how they deduplicate are defined by
`agents-task-viewer/src/openspec/reader.ts`, which this board SHALL mirror rather
than restate:

- **Artifact presence** — `proposal.md`, `tasks.md`, and `design.md` by name; a
  **delta spec** is `specs/<name>/spec.md` under the change directory, and
  `deltaSpecCount` is how many such files read successfully.
- **Backlog entries** — `parseBacklog`: level-two ATX headings, **code-fence
  aware** so a `## ` inside a fenced block is not a heading; an entry is closed
  when its heading matches `closedHeading` (an anchored `[RESOLVED]`-style
  bracket or `RESOLVED:`-style prefix, from `RESOLVED | RETIRED | DONE |
  CLOSED`) or its first body line matches `closedBodyLine` (`**Status:**
  RETIRED`). Both are **anchored**, so a heading merely containing a marker word
  — `Redone migration`, `Add WITHDRAWN flag support` — is not falsely closed. An
  entry's name is `backlogSlug(title)`.
- **Deduplication** — a backlog entry whose slug is already an active or archived
  change is **not** admitted as a second card (`occupiedSlugs`). A backlog item
  that has become a change is one piece of work, not two.
- **Per-source bound** — at most `MAX_SOURCE_RECORDS` (128 upstream) records per
  source per repository, with the excess reported as a `truncated` notice
  carrying admitted and observed counts.
- **Checklist rows** — `parseChecklist`: lines matching
  `^\s*-\s+\[([ xX])\]\s+(.+?)\s*$`, completion decided by the box character.

A repository with no `openspec/` directory SHALL contribute no cards and SHALL
NOT be reported as an error.

**Absent is not malformed.** A source that is simply not present — no
`openspec/`, no `BACKLOG.md`, no headings — contributes no card **silently**. A
record is reported when the board attempted to read something that exists and
could not, or admitted it only partially: upstream's notice vocabulary
(`collision`, `empty-slug`, `evidence-limited`, `malformed`, `rejected`,
`truncated`) is the reporting vocabulary here too. Nothing SHALL satisfy both
readings.

**This repository's `BACKLOG.md` was corrected to the convention rather than the
parser loosened to fit it.** Its two closed entries used a trailing `✅ RESOLVED`
in the heading and a `**Status: ✅ RETIRED … by explicit decision.**` body line,
neither of which upstream's anchored matchers close; a rule loose enough to catch
them also closes `Redone migration`. The entries now read `## [RESOLVED] …` and
`**Status:** RETIRED`, and upstream's unmodified matchers classify the file
two-closed one-open.

#### Scenario: The two parsers agree on this repository's backlog
- **WHEN** `openspec/BACKLOG.md` is parsed by upstream's `parseBacklog` and by this board
- **THEN** both close `Human verification backlog` and `[RESOLVED] Known stale artifact`
- **AND** both admit the remaining entry as one `backlog` card.

#### Scenario: A marker word inside a heading does not close it
- **WHEN** a backlog heading reads `Redone migration` or `Add WITHDRAWN flag support`
- **THEN** the entry is admitted as a card, because the closed-marker match is anchored rather than a substring test.

#### Scenario: A fenced heading is not an entry
- **WHEN** `BACKLOG.md` contains a fenced code block whose body includes a line beginning `## `
- **THEN** that line produces no card.

#### Scenario: A backlog entry that became a change is one card
- **WHEN** a backlog entry's slug matches an active change in the same repository
- **THEN** only the active change renders
- **AND** the backlog entry is not admitted a second time.

#### Scenario: A source past the bound is truncated and says so
- **WHEN** one repository holds more records of a source than the per-source bound
- **THEN** the admitted records render
- **AND** a `truncated` notice reports the admitted and observed counts for that repository and source.

#### Scenario: A registered repository contributes its changes
- **WHEN** a registered repository contains active changes, dated archive entries, and unresolved backlog entries
- **THEN** each appears as one card carrying its repository name
- **AND** each card states which of the three sources it came from.

#### Scenario: Absence is silent and unreadability is reported
- **WHEN** one repository has no `BACKLOG.md` and another has one that cannot be read
- **THEN** the first contributes no cards and is not reported
- **AND** the second is reported as a skipped entry naming its repository.

#### Scenario: The archive directory is not itself a change
- **WHEN** a repository's `openspec/changes/` contains an `archive/` directory alongside its active changes
- **THEN** `archive/` produces no card of its own
- **AND** the dated entries inside it produce `archive` cards.

#### Scenario: An unregistered repository is absent
- **WHEN** a git repository containing `openspec/` sits beside a registered one but is not itself registered
- **THEN** none of its changes appear on the board.

#### Scenario: A repository without OpenSpec is silently empty
- **WHEN** a registered repository has no `openspec/` directory
- **THEN** it contributes no cards
- **AND** it is not reported as unavailable or malformed.

### Requirement: Lifecycle Stage Is Classified By An Ordered Rule Set

Every card SHALL carry exactly one lifecycle stage drawn from `propose`,
`validate`, `execute`, `archive`. The stage SHALL be computed by the following
ordered rules, where the first matching rule wins:

1. Archived — **archive**
2. Active, and missing any of `proposal.md`, a delta spec, or `tasks.md` —
   **propose**
3. Artifact-complete, and any of: fewer than two distinct approving reviewers;
   any standing request for changes; zero checklist rows — **validate**
4. The approving threshold met, checklist incomplete — **execute**
5. The approving threshold met, checklist complete and non-empty — **archive**,
   marked `ready`

A backlog entry SHALL classify as **propose**. `design.md` is optional and SHALL
NOT affect any stage.

**"Distinct approving" and "standing" are the reviewer requirement's terms, and
recency lives in one place only: which *record* is read.** An earlier wording of
rule 3 said "reviewers whose latest verdict approves", which contradicted
`Two Approving Reviewers And No Standing Rejection` — that requirement forbids a
last-section-wins rule in terms, because document order is not evidence of
recency inside a single record. There is no "latest verdict" to consult. A
request for changes anywhere in the selected record is standing; a reviewer
absent from that record has no verdict at all. Recency is decided once, by
selecting the most recently modified review record, and never again inside it.

Two cards may therefore hold stage `archive` for different reasons, and the card
SHALL make the difference legible without opening it: a rule-1 card carries
source `archive`, and a rule-5 card carries source `active` and the `ready`
marker.

The rule set is derived from the upstream `agents-task-viewer` board's **current
classifier** (`classifyActiveChange`) and ADR 0008, not from ADR 0004's prose,
which the implementation has moved past. The specification SHALL name that origin
and SHALL state every deliberate divergence from it.

**The divergences SHALL be demonstrated, not counted.** Each rule above either
cites the upstream clause it mirrors or is marked as a departure, and the
conformance test named in this capability's tasks — upstream's fixtures run
through both classifiers, asserting identical stages — is what makes "the two
boards agree" a check rather than a claim. Two departures exist:

1. **No `ship` stage.** Upstream's mainline-reachability distinction collapses
   into `archive` here, because the probe does not fit this daemon's security
   spine. See `The Board Does Not Claim A Change Has Shipped`.
2. **Round-numbered review records.** Upstream reads `REVIEWS.md` alone; this
   fleet produces `REVIEWS-round-N.md` beside it, so the board selects the most
   recently modified record. See the reviewer requirement below.
3. **A directory with no artifacts is not a change.** Upstream admits every
   immediate child of `openspec/changes/` as a card, so a directory holding none
   of `proposal.md`, `tasks.md`, `design.md` and no delta spec still becomes a
   `propose` card there. Here it contributes nothing, and silently — it is an
   absence rather than a defect. The reason is that this board reads
   *registered repositories* rather than repositories discovered from agent
   sessions, so it meets scratch directories, editor leftovers and `README.md`
   files that upstream's narrower corpus never sees. A dated entry under
   `archive/` failing the same test **is** reported, because a directory shaped
   like a filed change and holding nothing is a defect in the tree rather than
   an absence.

   Round-4 review found this one undeclared while the specification claimed
   there were exactly two departures. It is recorded rather than removed: the
   alternative is a bogus card per stray directory.

Everything else — artifact completeness, the reviewer clause, the empty-checklist
clause, the `ready` marker, and backlog entries classifying as `propose` — is
upstream's behaviour, mirrored.

Rule 3's empty-checklist clause is upstream's (`checklist.length === 0`), and is
carried deliberately: a change with no checklist rows stays at `validate` rather
than advancing on artifacts alone. A purely declarative change with no tasks will
therefore sit at `validate` until it is archived. That consequence is upstream's
too, and matching it is worth more than fixing it here would be — diverging would
buy one better-classified card at the price of the two boards disagreeing.

#### Scenario: An incomplete change is proposed
- **WHEN** an active change has a proposal but no tasks file
- **THEN** its stage is `propose`.

#### Scenario: An approved change with outstanding work is executing
- **WHEN** an active change is artifact-complete, has two approving reviewers and no standing rejection, and has 4 of 9 checklist rows complete
- **THEN** its stage is `execute`.

#### Scenario: A finished change is ready to archive
- **WHEN** an active change is artifact-complete, has two approving reviewers and no standing rejection, and every one of its checklist rows is complete
- **THEN** its stage is `archive`
- **AND** the card is marked `ready`.

#### Scenario: The two archive readings are distinguishable
- **WHEN** the Archive column holds both a filed archive entry and an active change marked ready
- **THEN** the first carries source `archive` and the second carries source `active` with the `ready` marker.

#### Scenario: A design file never changes the stage
- **WHEN** two otherwise identical changes differ only in whether `design.md` exists
- **THEN** both classify to the same stage.

### Requirement: Two Approving Reviewers And No Standing Rejection

A change SHALL leave `validate` only when at least two distinct reviewers have
approved **and** no reviewer has a standing request for changes. A standing
request for changes from any reviewer holds the change at `validate` however
many other reviewers approve.

**This is not a divergence.** It is what the upstream board already does:
`classifyActiveChange` returns `validate` when `hasRequestChanges` is set, when
fewer than two distinct vendors approved, or when the checklist is empty. ADR
0004's prose — "two distinct approved reviewer sections", counting approvals
without subtracting rejections — describes neither the current classifier nor
ADR 0008. The specification SHALL cite the classifier and ADR 0008 as the origin,
not ADR 0004's prose.

**The verdict grammar is upstream's `parseReviewEvidence`**, mirrored rather than
restated: reviewer sections are `## Reviewer: <vendor>` headings, bounded by the
next such heading; a section matching `VERDICT: REQUEST-CHANGES`
case-insensitively sets the rejection flag and contributes no approval; a section
matching `VERDICT: APPROVE` contributes its vendor, compared case-insensitively
and counted once however many times it appears.

**Order does not decide a duplicate vendor — rejection does.** Any section
recording a request for changes sets the flag regardless of its position, so a
vendor that both approves and rejects within one record holds the change at
`validate`. There is no last-section-wins rule and there SHALL NOT be one:
document order is not evidence of recency inside a single record.

Verdicts that cannot be read SHALL be treated as absent rather than as approvals,
so an unparseable or trailer-absent review record classifies the change as
`validate` for want of evidence.

**Review evidence may be stale, and this is the board's one extension to
upstream's reader.** Upstream reads `REVIEWS.md` alone. This fleet holds
round-numbered records beside it — `close-readiness-spec-gaps` carries
`REVIEWS-round-1.md` through `REVIEWS-round-3.md` next to a `REVIEWS.md` that
lagged them — and with a rejection holding a change at `validate`, reading a
superseded record is the difference between a cleared rejection clearing and a
change stranded.

Where a change directory carries round-numbered records, the board SHALL classify
from the **most recently modified** of `REVIEWS.md` and those records, comparing
by modification time rather than by name, so a `REVIEWS.md` rewritten after the
last round still wins. Round numbers SHALL be compared **numerically**, so
`REVIEWS-round-10.md` sorts above `REVIEWS-round-9.md`, and the number breaks a
modification-time tie. The card SHALL name the record it was classified from,
not merely note that several exist.

A reviewer absent from the selected record has **no verdict**, and contributes
neither an approval nor a rejection; verdicts SHALL NOT be carried forward from
an unselected record.

#### Scenario: A standing rejection holds the change at validate
- **WHEN** a change carries approvals from two reviewers and requests for changes from two other reviewers
- **THEN** the change does not leave `validate`.

#### Scenario: A cleared rejection advances the change
- **WHEN** a reviewer whose recorded verdict was a request for changes records an approval in a later round, and a second reviewer approves
- **THEN** the change is eligible to leave `validate`.

#### Scenario: The newest record is the one that counts
- **WHEN** a change directory holds `REVIEWS.md` alongside `REVIEWS-round-1.md` through `REVIEWS-round-3.md`, and `REVIEWS-round-3.md` is the most recently modified
- **THEN** the stage is classified from `REVIEWS-round-3.md`
- **AND** the card names that record as the one it read.

#### Scenario: A rewritten REVIEWS.md supersedes the round files
- **WHEN** `REVIEWS.md` is modified after the last round-numbered record
- **THEN** the stage is classified from `REVIEWS.md`.

#### Scenario: Round numbers compare numerically
- **WHEN** a change directory holds `REVIEWS-round-9.md` and `REVIEWS-round-10.md` with the same modification time
- **THEN** `REVIEWS-round-10.md` is the record read.

#### Scenario: Unreadable verdicts do not advance a change
- **WHEN** a change's reviewer verdicts cannot be parsed
- **THEN** they count as absent
- **AND** the change classifies as `validate`.

#### Scenario: The boards read one file the same way
- **WHEN** the same `REVIEWS.md` is read by this board and by the upstream board
- **THEN** both identify the same reviewers and the same verdicts
- **AND** both classify the change to the same stage.

### Requirement: The Board Does Not Claim A Change Has Shipped

The board SHALL NOT distinguish a change that has landed on a mainline ref from
one that is merely archived. Both classify as `archive`, and no card SHALL assert
that a change has shipped.

Proving that an archive entry is present on `main` or `origin/HEAD` requires a
git invocation whose argument vector carries a ref and a pathspec built from a
directory name read out of a project tree. `filesystem-access-policy` closes the
git site to a fixed argument vector for that reason, and forbids project-tree
strings reaching an argument vector at the OpenSpec-binary site in terms. A
`ship` stage is therefore a change to the security spine, and SHALL be proposed
as its own change with its own delta against that capability rather than carried
here.

#### Scenario: An archived change is never shown as shipped
- **WHEN** an archived change is present on the repository's mainline ref
- **THEN** its card's stage is `archive`
- **AND** no card, column, or drawer states that it shipped.

### Requirement: The Board Degrades Per Repository And Names What It Lost

One repository SHALL NOT be able to withhold the board. When a repository is
unreachable, exceeds the read budget, or yields a malformed change or backlog
entry, the remaining repositories SHALL still render.

Every degradation SHALL be visible in the response and on the surface: the
affected repository or entry SHALL be named together with the reason. Degraded
reads SHALL NOT render as an ordinary empty board.

#### Scenario: One unreachable repository does not take the fleet
- **WHEN** one registered repository is unreachable and five others are readable
- **THEN** the board renders the five readable repositories' cards
- **AND** the response reports the unreachable repository by name with a reason.

#### Scenario: A malformed entry is skipped and counted
- **WHEN** a change directory or backlog entry cannot be parsed
- **THEN** that entry produces no card
- **AND** the board reports that an entry was skipped, identifying its repository.

#### Scenario: Degradation is distinguishable from emptiness
- **WHEN** every repository fails to read
- **THEN** the surface states that the repositories could not be read
- **AND** it does not present the same appearance as a fleet with no open changes.

### Requirement: The Board Fits Every Declared Viewport

The board SHALL render without page-level horizontal scrolling at every declared
verification viewport.

Four stage columns SHALL be shown while each column is at least 180 CSS pixels
wide. Below that width the board SHALL show one stage at a time behind a stage
rail that names every stage and its card count, and every stage SHALL remain
reachable.

The minimum column width, not a viewport breakpoint, is the binding constraint:
the breakpoint follows from the shell's sidebar and padding, so a change to
either recomputes the threshold rather than invalidating the requirement.

#### Scenario: Four columns at the reference viewport
- **WHEN** the board renders at 1440×900
- **THEN** all four stage columns are visible
- **AND** the page does not scroll horizontally.

#### Scenario: The paged layout on a small viewport
- **WHEN** the board renders at 390×844
- **THEN** one stage is shown at a time behind a stage rail
- **AND** every stage and its card count remain reachable
- **AND** the page does not scroll horizontally.

#### Scenario: An empty stage still reads as a stage
- **WHEN** a stage contains no cards
- **THEN** the column or paged view states that it has no changes rather than rendering blank.

### Requirement: Every Column Has A Total Order

Cards within a column SHALL be ordered totally and stably, so the same fleet
renders in the same order on every request.

Archive cards SHALL order by entry date, most recent first. A rule-5 card — an
active change complete enough to archive — has no entry date, and SHALL sort
ahead of every dated card rather than being given a synthetic one: it is the
thing waiting to be filed, not a thing already filed. `propose`, `validate` and
`execute` columns SHALL order by the record's most recent modification time, most
recent first.

Every ordering SHALL break ties on the card's identity, which is unique by
construction, so no two cards can compare equal and no repository's name can
decide another repository's order.

Cardinality is bounded by the per-source bound in `The Board Shows Every
Registered Repository's Changes`, which applies to every source alike and reports
what it withheld. No column applies a second, silent bound of its own.

The Archive column MAY bound what it renders **by default**, because it is the
one column that grows without end — every filed change stays filed, while the
other three drain as work moves. Such a bound is a display default and not a
second data bound: it SHALL name the true total, SHALL be reversible in both
directions by an explicit control, and SHALL withhold nothing from the response.
A bound the reader cannot see or cannot undo is the silent bound this
requirement refuses.

#### Scenario: The Archive column's default bound names its total and reverses
- **WHEN** the Archive column holds more cards than its default bound
- **THEN** it renders the bounded subset and offers a control naming the true total
- **AND** activating that control reveals every card, and activating it again restores the bound
- **AND** no card is withheld from the response itself.

#### Scenario: The order is stable across requests
- **WHEN** the same fleet is rendered twice with no change on disk
- **THEN** each column presents its cards in the same order.

#### Scenario: A ready card sorts ahead of filed archives
- **WHEN** the Archive column holds a rule-5 `ready` card and several dated archive cards
- **THEN** the `ready` card appears first
- **AND** the dated cards follow in date-descending order.

### Requirement: A Change Name Wraps Before It Elides

A card SHALL show its change name across up to two lines before eliding. When a
name is elided, its full value SHALL remain available in the card's detail view,
so no name is lost at any width.

Numeric values on a card — completed and total checklist counts — SHALL use
tabular figures so that digits align between cards.

#### Scenario: A long name wraps rather than truncating at one line
- **WHEN** a change name is longer than one line at the current column width but fits within two
- **THEN** the whole name is shown across two lines.

#### Scenario: An elided name is recoverable
- **WHEN** a change name exceeds two lines and is elided
- **THEN** opening the card's detail view shows the complete name.

### Requirement: A Card Opens A Deep-Linked Drawer

Selecting a card SHALL open a detail drawer over the board, leaving the board
visible. The drawer SHALL carry the change's repository, stage, source, artifact
presence, reviewer verdicts, and its checklist rows.

A card's identity SHALL be upstream's `sourceIdentity` **shape** — a triple
joined by NUL — with **this daemon's registry id in the first position, not the
repository's absolute root**. The instance is the entry's own name: an active
change's directory name, an archived entry's full dated `YYYY-MM-DD-<slug>`
basename, a backlog entry's `backlogSlug(title)`. Two archived entries of one
slug filed on different dates are distinct; a backlog entry whose slug is
already a change is not a second card at all, per the deduplication rule above.

**The registry id is normative here, and the substitution is deliberate.**
Upstream has no registry, so a repository's absolute root is the only handle it
has; this daemon does have one, and the registry id is what identifies a
repository on every other route. Putting the root in the identity would also put
an absolute filesystem path — and therefore a username — into every card of
every response, which is the disclosure shape this change has been asked about
since round 1. The id is unique per registry entry, so the triple is unique by
construction exactly as upstream's is.

The three components of the identity are exactly the three parameters of the
card's address, which is what makes the address unforgeable without a parser.

NUL is the separator precisely because no filesystem name and no heading can
contain one, so the identity cannot be forged by an author-controlled string.

The location SHALL carry the three values as **separate** parameters, since NUL
cannot appear in a URL. A single composite parameter requiring a printable
separator SHALL NOT be used, because parsing a separator out of an
author-controlled change name is the failure mode that produced the readiness
sanitiser defect — and an identity built from a heading's raw text would
reintroduce exactly that hazard inside one parameter rather than between two.
The slug is what makes the address safe.

#### Scenario: Opening a card is addressable
- **WHEN** a card is selected
- **THEN** a drawer opens over the board showing that change's detail
- **AND** the location identifies the repository, the source, and the change in separate parameters.

#### Scenario: Same-named cards from different sources address distinctly
- **WHEN** one repository holds an active change `add-thing` and an archived entry `2026-07-04-add-thing`
- **THEN** each renders as its own card, both carrying the change name `add-thing`
- **AND** each card's location differs in the source parameter.

**This scenario deliberately does not use a backlog entry.** An earlier draft
paired a backlog entry with an active change of the same name and was
unreachable: the deduplication rule above suppresses exactly that pair, so no
reader could ever produce it. Round-4 review found the contradiction. Active and
archived cards of one slug **do** coexist — ADR 0008 says so in terms, and
`occupiedSlugs` suppresses only backlog candidates — so that is the pair which
demonstrates why `source` has to be in the address.

#### Scenario: One slug archived twice addresses distinctly
- **WHEN** a repository holds `2026-07-04-add-thing` and `2026-08-02-add-thing` under `archive/`
- **THEN** each renders as its own card
- **AND** their locations differ, because the dated basename is the identity rather than the slug.

#### Scenario: A deep link restores the drawer
- **WHEN** a location naming a repository, a source, and a change is opened directly
- **THEN** the board renders with that change's drawer already open.

#### Scenario: A deep link to a change that no longer exists
- **WHEN** a location names a change absent from the current board
- **THEN** the board renders without a drawer and states that the change was not found.

### Requirement: The Board Adds No Read Root And Spawns No Process

The board SHALL read only paths already permitted by `filesystem-access-policy`,
and SHALL spawn no process at all. The four authorised spawn sites are unchanged
by this board, and neither the permitted git subcommands nor the read allow-list
is widened to serve it.

Path admission SHALL NOT rest on the lexical guard alone. `isReadableProjectPath`
answers whether a path's shape is offerable, not whether reading it stays inside
the tree the board is entitled to. Every path the board reads SHALL therefore be
resolved and confirmed to lie under **the verified anchor for that repository's
`openspec` tree** — not merely under the project root — and SHALL be read only
when it is a regular file. The anchor is `<registered project root>/openspec`
resolved, and is itself verified against the registered root per
`filesystem-access-policy` › `A Containment Anchor Is Verified Against Its
Registered Root`; stating it as a literal path here would contradict that
requirement, which admits an `openspec` symlinked *within* its own root.

The narrower root is the point. A symlink under `openspec/` that resolves to
`.env`, `.git/config`, or any other file elsewhere in the same repository passes
a root-scoped containment check and fails this one; the board is entitled to a
repository's OpenSpec tree, not to its repository.

**Every read SHALL be size-capped before it is performed**, against a named
constant, and a file exceeding the cap SHALL be skipped and reported rather than
read. The board reads `tasks.md`, `REVIEWS.md` and `BACKLOG.md` for every change
in every registered repository on one fleet request, so an oversized file is a
whole-endpoint cost and not a per-card one. The cap is not optional hardening:
it was required by this change's first-round review, alongside the realpath and
regular-file checks, and was the one of the three left unimplemented.

#### Scenario: Reads stay inside the allow-list
- **WHEN** the board reads a repository's changes, archive entries, and backlog
- **THEN** every path read is one the read allow-list already permits.

#### Scenario: An oversized file is skipped, not read
- **WHEN** a `tasks.md`, `REVIEWS.md` or `BACKLOG.md` under `openspec/` exceeds the read cap
- **THEN** the board does not read it
- **AND** the entry is reported as skipped, naming its repository.

#### Scenario: A symlink out of the OpenSpec tree is not read
- **WHEN** an entry under `openspec/` is a symlink resolving outside `<project root>/openspec` — including to a file elsewhere inside the same repository, such as `.env` or `.git/config`
- **THEN** the board does not read through it
- **AND** the entry produces no card and is reported as skipped.

#### Scenario: No spawn site appears
- **WHEN** the board's route and library surface is inspected for process creation
- **THEN** it creates no process
- **AND** the set of authorised spawn sites is unchanged at four.
