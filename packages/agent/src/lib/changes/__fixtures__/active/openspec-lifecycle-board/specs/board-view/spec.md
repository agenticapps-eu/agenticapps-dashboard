## ADDED Requirements

### Requirement: Narrow-terminal stage pager

Below the five-column content breakpoint of 124 terminal cells, the board SHALL render one selected lifecycle stage at full width with a persistent numbered rail showing all five stages and their card counts; the selected stage SHALL scroll internally while the rail stays pinned.

#### Scenario: Narrow terminal preserves readable cards

- **WHEN** terminal width is below 124 cells
- **THEN** one selected stage renders at full board width with uncompressed change metadata
- **AND** the numbered Propose / Validate / Execute / Archive / Ship rail remains visible

#### Scenario: Stage pager keyboard navigation

- **WHEN** the narrow stage pager has focus
- **THEN** left/right or `h/l` changes the selected stage and up/down or `j/k` changes the focused card
- **AND** an empty stage remains selectable and shows `No associated changes`
- **AND** focus auto-scrolls an overflowing selected stage without moving the rail or board chrome

### Requirement: Host-session change cards

The board SHALL render one change card per associated host session, ordered most-recently-updated first within each lifecycle stage, without promoting host tasks or OpenSpec checklist rows to independent cards.

#### Scenario: One session produces one lifecycle card

- **WHEN** a host session is unambiguously associated with an OpenSpec change
- **THEN** exactly one card shows its host/session attribution, change name, repository basename, and completed/total checklist progress
- **AND** a second host session on the same change remains a separate card

### Requirement: Omitted-session visibility

The board SHALL show an aggregate count of active sessions omitted because they have no OpenSpec repository, have no change, or have no unambiguous change association, while detailed reasons go through the existing redirected diagnostic sink. Aged-out sessions and sessions hidden only by the active filter SHALL NOT contribute to this count.

#### Scenario: Active session has no lifecycle card

- **WHEN** one or more active, non-aged sessions are outside OpenSpec repositories, have no change, or have ambiguous change associations
- **THEN** a dim footer shows `N sessions not shown (no associated OpenSpec change)` in both five-column and stage-pager layouts
- **AND** no synthetic lifecycle card is invented

## MODIFIED Requirements

### Requirement: Full-screen status board

The viewer SHALL render a full-screen TUI board with five columns keyed by OpenSpec lifecycle stage — Propose, Validate, Execute, Archive, Ship — populated from normalized host-session-scoped change cards.

#### Scenario: Launch renders the lifecycle board

- **WHEN** the developer runs `bun run start`
- **THEN** a full-screen OpenTUI board opens showing every unambiguously associated active host session bucketed into Propose / Validate / Execute / Archive / Ship
- **AND** the board is populated on first render because the store resolves only after every enriched adapter's initial snapshot

#### Scenario: Terminal resize redraws cleanly

- **WHEN** the terminal window is resized
- **THEN** the board redraws correctly with no leftover artifacts or corrupted layout
- **AND** switches deterministically between five-column and stage-pager layouts at the 124-cell terminal-width breakpoint

### Requirement: Host-distinct rendering

The board SHALL make the three hosts distinguishable at a glance via a per-host border tint and color-coded label (`[CL]` Claude, `[CX]` Codex, `[OC]` opencode) on each change card.

#### Scenario: Change cards are visually attributable to a host

- **WHEN** sessions from more than one host are on the board
- **THEN** each card's border color and label identify its host
- **AND** same-change or same-session-id cards on different hosts never merge

### Requirement: Focus and detail pane

The board SHALL support keyboard focus movement with a reverse-video highlight and auto-scroll, and SHALL show a docked detail pane for the focused change card with change, stage, repository, branch, host, session, named artifact readiness, approved review count/vendor labels, checklist progress/rows, archive path, and associated host-task titles/status/dependency lists. In wide mode, left/right or `h/l` moves between lifecycle columns and up/down or `j/k` moves between cards. Archive-stage cards SHALL include textual `ready` versus `archived` state rather than relying on color.

#### Scenario: Focusing a change card opens its detail

- **WHEN** the developer moves focus to a change card with the board's navigation keys
- **THEN** the card is highlighted and a docked detail pane shows its full normalized change and session metadata
- **AND** `Artifacts` shows proposal readiness, delta-spec count, tasks readiness, and optional-design state
- **AND** `Reviews` shows approved count and vendor labels, `Progress` shows `complete/total` plus each `[x]`/`[ ]` OpenSpec checklist row, and `Archived` shows the relative archive path or a dim em dash
- **AND** associated host tasks expose `blockedBy` / `blocks` as text

#### Scenario: Focused card moves or disappears live

- **WHEN** the focused card changes lifecycle stage during a live refresh
- **THEN** focus follows its stable host/session/change identity into the new stage and auto-scrolls it into view
- **AND** narrow pager mode selects that card's new stage
- **WHEN** the focused card is omitted, removed, or ages out
- **THEN** focus clears and the detail pane closes

### Requirement: Fuzzy filter

The board SHALL provide a modal `/`-triggered fuzzy filter over change name, repository, branch, session title, and cwd, computed as a pure in-process derivation of the current snapshot, with a match-count indicator and grapheme-safe editing.

#### Scenario: Filtering narrows the lifecycle board

- **WHEN** the developer presses `/` and types a query
- **THEN** the board shows only change cards whose change name, repository, branch, session title, or cwd subsequence-matches the query
- **AND** shows a `/{query} — {N} matches` indicator

#### Scenario: Filter key is literal while filtering

- **WHEN** the developer types a character such as `t` while the filter is active
- **THEN** the character is inserted into the query and does not trigger any board-mode shortcut

### Requirement: Column overflow scrolls

Each lifecycle column in wide mode and the selected stage in narrow mode SHALL be a scrollable region so overflowing cards remain reachable without clipping board chrome.

#### Scenario: Wide lifecycle column overflows

- **WHEN** a wide-mode lifecycle column holds more cards than the visible height
- **THEN** that column scrolls its content while the other columns and board chrome remain intact

#### Scenario: Narrow selected stage overflows

- **WHEN** the narrow stage pager's selected stage holds more cards than the visible height
- **THEN** the selected stage scrolls and auto-scrolls focused cards while the numbered rail and board chrome remain pinned

### Requirement: Grapheme-correct truncation

The board SHALL truncate change slugs, repository labels, and lifecycle rail labels on grapheme-cluster boundaries (via `Intl.Segmenter`), so wide, combining, and emoji glyphs are never split mid-cluster.

#### Scenario: Complex glyphs truncate cleanly

- **WHEN** change or repository metadata contains ZWJ-sequence emoji, regional-indicator flags, VS16 variation selectors, or CJK characters and exceeds the available width
- **THEN** it is truncated on a grapheme boundary with no broken or mis-width glyphs

## REMOVED Requirements

### Requirement: Blocked-column derivation

**Reason**: The default board no longer buckets host tasks by task status; blocked task state remains available in task-based timeline/detail data but is not an OpenSpec lifecycle stage.

**Migration**: Use the Execute card's checklist progress and associated Host Tasks detail for individual host-task status and dependency text; the unchanged task-based timeline remains available for timing.

### Requirement: Session grouping

**Reason**: The lifecycle board's atomic work item is already host-session scoped, so the former `{title} — {count}` task cluster and indented task cards no longer exist on the default surface.

**Migration**: Use the new Host-session change cards requirement; host/session attribution appears directly on each change card and in the detail pane.
