## Why

`anchor-allowed-subdirs-to-root` (PR #100) closed six containment-anchor escapes
by adding an **optional** `anchorTo`. Optional is the wrong default for a
security boundary: at a call site that omits it, "the author decided no anchor
applies" and "the author never considered containment" are written identically.
Nothing distinguishes them at review time, and nothing forces the question when
a new call site is added.

That is not hypothetical. Review round 2 found a real escape — a `skills/` root
symlinked into a sibling repository, whose entry names then appeared in this
repository's output as skill ids — at an **existing** call site that round 1 had
walked past. The site was not new and not exotic; it was simply never revisited,
because nothing in its shape asked to be.

Both review rounds, across all three reviewers, converged on the same remedy and
it was deferred only to keep the security diff reviewable. This change is that
deferred work.

## What Changes

- **BREAKING (internal API):** `anchorTo?: string` on `ResolveAllowedNamedOpts`
  and on `coverageResolver`'s `PathResolver` is replaced by a **required**
  `containment` field. Every one of the 28 non-test resolution sites must now
  state its containment intent; omission stops compiling.
- The field is a three-variant discriminated union, so the statement is a
  classification rather than a value that can be defaulted:
  - `{ kind: 'anchored', root }` — the root is **derived** from a path inside a
    repository and must still lie under `root`. The six sites #100 fixed.
  - `{ kind: 'repository-root' }` — the roots **are** repository roots, so the
    anchor is the root itself and the check is an identity.
  - `{ kind: 'daemon-named', reason }` — a machine or family root that
    deliberately lies outside any repository (design D8: symlinking skills into
    `~/.claude/skills` *is* the install mechanism, and anchoring would report 33
    of 98 entries missing). The `reason` string is mandatory, which makes every
    deliberate non-anchor self-documenting and greppable.
- No new refusal is intended at runtime. This converts an opt-in boundary into a
  compile-time one; it does not tighten what the daemon admits. One deliberate
  exception is decided in design (D2, unresolvable repository roots) and is
  called out below because it is the only place where behaviour can move.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `filesystem-access-policy`: gains a new requirement, `Containment Intent Is
  Declared At Every Resolution Site` — the containment decision SHALL be
  explicit at every resolution site, undeclared SHALL be a build failure, and a
  read deliberately not anchored to a repository root SHALL record why. Added
  rather than folded into `A Containment Anchor Is Verified Against Its
  Registered Root`, because that requirement says what a verified boundary *is*
  and this one says no reader may decline to answer the question. It is a
  durable policy statement, not a restatement of the type signature: it is what
  stops the next change quietly reintroducing an optional anchor, and what makes
  D8's machine roots auditable instead of merely absent.

## Impact

- `packages/agent/src/lib/paths.ts` — `ResolveAllowedNamedOpts`, `resolveAllowedNamed`.
- `packages/agent/src/lib/coverageResolver.ts` — `PathResolver`, `makeCoverageResolver`.
- 28 non-test call sites across `projectMetadataScan.ts` (13),
  `coverageResolver.ts` (4), `readiness/readinessFile.ts` (3),
  `scanners/claudeMdScanner.ts` (2), `readiness/fingerprint.ts` (2),
  `readiness/coverageDeriver.ts` (2), `paths.ts` (2); plus the six already
  anchored in `scanners/workflowFleetScanner.ts` and
  `scanners/workflowVersionScanner.ts`. 55 sites including tests.
- `workflowArtifactScanner` is the D8 case and becomes `daemon-named` with its
  reason recorded — the first time that decision is written down in code rather
  than living only in an archived design document.
- No wire-schema change, no SPA change, no new daemon route. `packages/shared`
  and `packages/spa` are untouched.
- **Risk, stated up front:** the churn is wide and mostly mechanical, which is
  exactly the condition under which a real change hides among 28 identical ones.
  Design D3 records how the diff is kept reviewable.
