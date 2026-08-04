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
  `containment` field. All 24 non-test resolution sites must now state their
  containment intent; omission stops compiling.
- The field is a three-variant discriminated union, so the statement is a
  classification rather than a value that can be defaulted:
  - `{ kind: 'anchored', root }` — the root is **derived** from a path inside a
    repository and must still lie under `root`. The six sites #100 fixed.
  - `{ kind: 'repository-root' }` — the roots **are** repository roots, so the
    anchor is the root itself and the check is an identity.
  - `{ kind: 'daemon-named', reason }` — one of the five machine roots that
    deliberately lie outside every repository (`agenticapps-bin`,
    `claude-skills`, `codex-skills`, `opencode-skills`, `pi-skills`). Symlinking
    skills into them *is* the install mechanism, and anchoring would report 33 of
    98 and 13 of 14 entries missing. The `reason` string is mandatory, which
    makes every deliberate non-anchor self-documenting and greppable.
- **Admission is unchanged at every site.** `anchored` routes to the existing
  anchored code path and `repository-root` / `daemon-named` route to the existing
  unanchored one, byte-for-byte. The executable content of this change is a
  required field and nothing else.
- What this does **not** do is make declarations *correct*. The type system
  forces a variant, not the right variant, and a derived boundary relabelled as
  a repository root would compile. That limit is stated in the spec rather than
  implied away, and regression coverage pins the six boundaries #100 anchored.

An earlier draft of this proposal had `repository-root` adopt fail-closed
anchoring semantics. Plan review round 1 falsified that in two independent ways
— a reachable admission change via `<root>/missing/..`, and the silent loss of
`makeCoverageResolver`'s cross-family roots — and the design was reversed
accordingly. See `tasks.md` round-1 dispositions.

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
- **24 non-test resolution sites**, counted as invocations rather than as
  mentions of the identifier:
  - 12 `resolveAllowedNamed(` calls — `projectMetadataScan.ts` (8),
    `readiness/readinessFile.ts` (2), `readiness/fingerprint.ts` (1),
    `readiness/coverageDeriver.ts` (1). Two of these are already anchored.
  - 12 `PathResolver` invocations — `workflowFleetScanner.ts` (4),
    `workflowArtifactScanner.ts` (3), `coreSpecVersionScanner.ts` (2),
    `overrideSentinelScanner.ts` (1), `workflowVersionScanner.ts` (1),
    `workflowScan.ts` (1). Four of these are already anchored, and none of these
    files calls `resolveAllowedNamed` at all.
- Helpers that relay a resolver — `readSkillVersions` is the confirmed case,
  serving a repository root at `workflowDeriver.ts:184` and a machine root at
  `:287` — gain a `containment` parameter rather than choosing a classification
  (design D8).
- The five machine roots in `workflowArtifactScanner` become `daemon-named` with
  their reasons recorded — the first time that decision is written in code
  rather than living only in an archived design document.
- No wire-schema change, no SPA change, no new daemon route. `packages/shared`
  and `packages/spa` are untouched.
- **Risk, stated up front:** the churn is mechanical, which is the condition
  under which a real change hides among identical ones. Design D3 sequences it
  so every commit builds and the migration is reviewable in slices by shape.
