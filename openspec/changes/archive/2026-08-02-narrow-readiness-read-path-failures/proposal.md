## Why

The `repo-readiness` spec records three defects in the tier-B read path as known
weaknesses it does not endorse — one moved evidence file discards every unrelated
declaration in the repo (lines 241–251), one hung repo withholds the entire fleet
response (lines 351–367), and an author who has never run a penetration test has
no honest way to say so (lines 393–407). Each was deferred when readiness shipped
because closing it was a change in what tier B promises rather than a fix to what
it does. They share one read path, they are read together by anyone auditing that
path, and the spec text for all three currently exists to apologise for behaviour
nobody wants to keep.

The middle one is the sharpest: it is not a degraded answer but no answer at all,
and the spec had to weaken its own per-repo degradation guarantee to stay honest
about it.

## What Changes

- **A failed evidence citation discards its own entry, not the whole file.** The
  other five declarations survive. The offending check reports an error-bearing
  `fail` marked `declared` rather than falling back to its derived value, so a
  rejected declaration is visibly rejected instead of becoming indistinguishable
  from one that was never made. The repo still carries a notice.
- **The fleet answers within a bounded time regardless of any one repo.** Each
  per-repo scan and the fleet-wide signature acquire a time bound; a repo that
  exceeds it is reported as unscannable in the same shape a rejecting repo
  already uses. The per-repo degradation guarantee stops being qualified as
  "failure, not indefinite blocking" and covers both.
- **A declared `pen-test` may state `never` or `na`.** These take the entry
  variant whose evidence, commit and `validUntil` fields are absent rather than
  optional, because a test that did not happen has no artifact, no reviewed
  commit and no expiry. A declared `never` blocks readiness — it is an author's
  assertion, and the advisory exemption already covers only a *derived* `never`.
- **BREAKING** (tier-B authors only): a readiness file that was wholly discarded
  for one bad citation now has its remaining declarations honoured, so a repo's
  reported checks can change without its file changing. No wire shape changes and
  no client is affected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-readiness`: five requirements change. Three carry the defects; two carry
  prose that this change falsifies and that would otherwise be left stale.
  - *Two-Tier Provenance With Per-Check Precedence* — citation failure narrows
    from the file to the entry, and the rejected entry's result is specified.
  - *The Tier-B File Has A Strict, Bounded Schema* — the declared `pen-test`
    status vocabulary widens to admit `never` and `na` through a no-evidence
    entry variant; the residual-exposure passage stops recording an unbounded
    fleet wait.
  - *Readiness Endpoints Degrade Per Check And Per Repo* — the guarantee is
    restated to cover a scan that never settles, not only one that rejects.
  - *The Pen-Test Check Is A Declared-Only Slot* — the slot's `never` may now
    arrive by declaration as well as by absence, and the two differ in whether
    they block. The advisory designation itself is unchanged.
  - *Readiness Is A Boolean Predicate, Not A Score* — the note reasoning that a
    wholly-`na` repo is unreachable "because a declared `na` is invalid for that
    slot" stops being true. The predicate's behaviour does not change; only the
    reachability claim about it does.

## Impact

- `packages/shared/src/schemas/readiness.ts` — `PenTestDeclarationSchema` becomes
  a union over a substantiated and an unsubstantiated variant.
- `packages/agent/src/lib/readiness/readinessFile.ts` — `evidenceIsReadable`
  returns per-entry rejections instead of a whole-file outcome.
- `packages/agent/src/lib/readiness/assemble.ts` — consumes rejected entries and
  emits the error-bearing declared result.
- `packages/agent/src/lib/readiness/service.ts` — time bound on `snapshotFor` and
  on the fleet signature.
- `packages/spa` — no new state; the rejected-entry result renders through the
  existing error-bearing `fail` path and the existing notice banner.
- No API surface, dependency, or registry change. `computeReady` is untouched:
  entry-level rejection blocks through the `error !== null` clause that already
  exists, which is what keeps this change from reopening the hole the
  advisory-exemption suspension closed.
