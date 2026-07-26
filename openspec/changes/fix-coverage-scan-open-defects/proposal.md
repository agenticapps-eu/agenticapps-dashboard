# Fix the two open coverage-scan defects

## Why

Two debug sessions opened against the coverage matrix scan actions were never
closed, and both were carried through the v1.1 and v1.2 milestone audits:

- `family-scan-no-ui-feedback` — status **unknown**. Triggering a family-scoped
  scan appears to do nothing in the UI. Whether the scan runs and the feedback is
  missing, or the scan never starts, was never established.
- `per-row-scan-repo-not-registered` — status **diagnosed**. A per-repo scan
  fails when the repo appears in the coverage matrix but is not in the registry.
  The coverage scanner walks the family roots, so it legitimately surfaces repos
  the registry has never heard of; the scan path assumes registry membership.

The second has a diagnosis and no fix. The first has neither.

Source: `docs/legacy-planning/STATE.md` §"Deferred Items" (debug).

## What changes

- Establish whether the family scan runs at all, then make its progress and
  outcome visible.
- Make a per-repo scan work for an unregistered-but-visible repo, or refuse it
  with an explanation the user can act on.

## Capabilities

- `code-intelligence` — scan action feedback and the unregistered-repo path

## Deprecation notice

> These defects sit in the **deprecated** GitNexus half of `code-intelligence`.
> Migration `0032` removed GitNexus as fleet workflow tooling, so the indexer
> these actions drive is no longer installed fleet-wide. **Confirm the feature
> is staying before spending effort here** — if it is being removed, this change
> should be closed unimplemented in favour of a removal change. See
> `openspec/CAPABILITY-MAP.md` GAP-04.

## Non-goals

- Parallel family scans, scan-all, cancellation, or streaming scan output. All
  were deferred at the original phase boundary and remain out of scope.

## Open questions

> [GAP: Given the deprecation above, is fixing these defects the right call at
> all? Recommended: resolve GAP-04 first. This change is staged so the defects
> are not silently lost, not because the work is obviously worth doing.]
