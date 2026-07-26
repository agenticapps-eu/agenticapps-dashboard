---
change: add-openspec-project-reader
artifact: REVIEW
review_date: 2026-07-26
stage_1: gstack /review — 2 specialists + adversarial pass
stage_2: superpowers:requesting-code-review — independent context
stage_1_findings: 23 (12 testing, 11 maintainability)
adversarial_findings: 16
stage_2_verdict: REQUEST-CHANGES (2 blocking) — both closed
blocking_open: 0
task: 93
---

# REVIEW — two-stage, add-openspec-project-reader

Both stages against the full branch diff (`0d65bb7..HEAD`, 78 files,
+4157/−3682). The stages did not collapse: Stage 1 ran the gstack checklist plus
specialists and an adversarial pass; Stage 2 ran in an independent context whose
brief was to judge the change against its own spec deltas.

## Result

| Stage | Source | Findings | Disposition |
|---|---|---|---|
| 1 | testing specialist | 12 | fixed |
| 1 | maintainability specialist | 11 | fixed or recorded |
| 1 | adversarial pass | 16 | severe ones fixed |
| 2 | independent review | 2 blocking, 8 non-blocking | blocking closed; 4 non-blocking closed |

Stage 2 returned **REQUEST-CHANGES**. Both blocking findings are closed, with
tests and live verification. A fresh Stage 2 pass has **not** been obtained
against the fixed tree — recorded here rather than implied.

## What the review caught that the tests did not

The suites were green at every point below. None of these was a test failure.

**A spec delta stated things that are not true.** It justified keeping
`.planning` allow-listed on three claims: that `skill-observations/` is read by
the override-sentinel scanner, that `.planning/config.json` is read as live
lifecycle config, and that only `.planning/phases/` stops being read. Verified
against source: the scanner reads `.planning/phases/`, not skill-observations;
no daemon path reads `config.json`; and `.planning/phases/` does not stop being
read, because that sentinel lives there. The conclusion was right and every
stated reason was wrong. Group 5 had already corrected this in `tasks.md` and
never propagated it. It was one archive away from becoming durable truth.

**Two ratified requirements were implemented nowhere.** `Completed work SHALL be
readable from the archived changes` was delivered at the wire — read, sorted,
schema-validated, served — and read by no surface, making its ordering scenario
vacuous. And the `needs-migration` scenario this change *added* asserts that
branch and last-commit context still render, while the view rendered the project
id alone; the test named for that scenario asserted a weaker claim than the
scenario made, which is how it passed. Both are now rendered.

**A single project could stop the daemon from starting.** The CLI shape check
accepted any `number` where the wire schema demands an int ≥ 0, so a malformed
count passed shape recognition and threw at the registry boundary — inside an
uncaught `Promise.all`, and on a path `boot.ts` awaited *before* `serve()`. One
bad project, no daemon, and no UI left to unregister it with.

**The fleet route had no cache** while its own delta says "cached briefly", and
it is the route the SPA polls every 5s for every project at once. Measured after
the fix: 606ms cold, 9ms warm.

**Three fixes in the timeout path.** `clearTimeout` ran only in `finally`, so a
reaped child's recycled PGID could be SIGKILLed; `killGroup` ran only on the
timeout path, leaving the forked grandchild the process-group rule exists to
prevent; and `cleanup: true` was a documented no-op under `detached: true`, a
false assurance now removed rather than left in place.

**`maxBuffer` counted UTF-16 code units, not bytes**, so a 2 MiB cap admitted
several times that for multi-byte output before the post-check could reject it.

**An unreachable project asserted "This project has no openspec/ directory"** —
a positive claim about a filesystem the daemon cannot read, and the exact trap
the reachability-precedence rule exists to prevent, reproduced one layer below
the home card that gets it right.

## Convergence

Three reviewers independently flagged `archived` as a field with a producer and
no consumer (maintainability, adversarial, Stage 2). Two independently flagged
the capability set being CLI-authoritative against the reader's own stated rule.
Convergence from independent contexts is the signal the two-stage split exists
to produce.

## Recorded, not fixed

- **Non-conformant change counts are collected and discarded by both surfaces.**
  The CLI's counts merge, but `hasTaskArtifact` stays tree-derived, and both
  renderers branch on presence — so a change the CLI reports at 1/2 displays as
  "no task list" and files as proposed. The daemon-side test asserts the counts
  and never the flag. Needs a decision on which source wins.
- **The card truncates at three changes** where the scenario says "each open
  change's ratio". Deliberate and critique-driven; departs from the ratified text
  and is recorded nowhere else.
- **`help-docs` pages and `CLAUDE.md` still describe phase surfaces** this change
  deleted. Out of the stated capability scope; this change is what made the text
  false.
- **The centre column has one focusable element** because there is no
  change-detail route to link to. Defining one is outside this change's delta.
  Worth proposing.
- **`gsdReaderRetired.test.ts` matches only the two-argument join form**, so
  `join(root, '.planning/phases')` would evade the guard.
- **`openspec/specs/project-dashboard/spec.md` Purpose prose** still describes
  phase progress in the centre column. No delta touches it, so it survives
  archiving as a stale description.

## Verification at close

`pnpm -r typecheck` 0 errors · `pnpm lint` 0 errors (234 pre-existing warnings) ·
shared 382 · agent 1241 (+1 skipped) · spa 1272 · `openspec validate --all` 21/21
· change-gate `--ci` OK. Daemon booted, all three registered projects read
correctly, both blocking fixes confirmed in the browser at 1440×900.
