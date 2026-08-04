## Context

`anchorTo?: string` exists on two resolvers today — `resolveAllowedNamed` in
`paths.ts` (async) and the `PathResolver` returned by `makeCoverageResolver` in
`coverageResolver.ts` (sync). Both were added by
`anchor-allowed-subdirs-to-root`, which anchored six boundaries and left the
field optional at the other 22 non-test sites.

Surveyed on `main` at `dcc5d13`, the 28 non-test sites fall into three shapes:

| Shape | Sites | What the anchor does |
|---|---|---|
| `roots: [projectRoot]` — the root **is** the repository root | 22 | identity; the root cannot leave itself |
| `roots: [<derived>]` — `workflowsDir`, `skillRoot`, `skills/` | 6 | the live check; all six anchored by #100 |
| daemon-named machine/family roots | see D4 | must **not** anchor (D8 of the prior change) |

The third shape does not currently appear as an `anchorTo`-bearing option object
at all — it is expressed by *omission*, which is precisely the ambiguity this
change removes.

The security requirement itself is unchanged and already durable: `A Containment
Anchor Is Verified Against Its Registered Root` in `filesystem-access-policy`.
This change is about making a call site unable to stay silent about it.

## Goals / Non-Goals

**Goals:**

- Every path-resolution site states its containment classification, enforced by
  the type checker rather than by review attention.
- The deliberate non-anchor (D8's machine roots) carries a written reason, so it
  is auditable and greppable instead of merely absent.
- Runtime admission is unchanged: no path the daemon reads today becomes
  refused, and no path it refuses today becomes readable. D2 is the single
  place this could move, and it is bounded there.

**Non-Goals:**

- Closing TOCTOU. The anchor is verified at realpath time and the symlink can
  still be swapped before the read; `routes/read.ts`'s `O_NOFOLLOW` +
  re-`realpath` remain the only mitigations, and this change neither adds to
  nor subtracts from them. Carried forward unchanged from #100.
- Changing `resolveAllowed` (the `ALLOWED_SUBDIRS` path). It already anchors
  unconditionally against `realProjectRoot` — there is no optional field to make
  required, so there is nothing here for it.
- Any new refusal vocabulary, wire shape, or SPA state. `PathViolation` → 422
  stays exactly as it is.

## Decisions

### D1 — A required three-variant union, not a required nullable field

`containment` is required and discriminated:

```ts
type Containment =
  | { kind: 'anchored'; root: string }
  | { kind: 'repository-root' }
  | { kind: 'daemon-named'; reason: string }
```

*Alternative considered:* `anchorTo: string | null` — the smallest diff, and it
does force the decision. Rejected because `null` records only that someone typed
`null`. It cannot distinguish "the root is the repo root, so anchoring is an
identity" from "this root is deliberately outside every repository", and those
are different security claims. The second needs justification; the first does
not. A union that cannot express one as the other is the point.

*Alternative considered:* a two-variant union with a bare `'daemon-named-root'`
marker. Rejected for the same reason at lower cost: it separates the two claims
but still records no reason, and D8's rationale would stay in an archived design
document instead of next to the code it governs.

The `reason` string is not decorative. D8 was refuted evidence — 33 of 98 and 13
of 14 entries under the skills roots are install symlinks, so anchoring would
report all of them missing. That finding currently survives only in
`openspec/changes/archive/2026-08-04-anchor-allowed-subdirs-to-root/design.md`.
A future reader of `workflowArtifactScanner` has no way to reach it.

### D2 — `repository-root` fails closed, and the behaviour delta is bounded

`{ kind: 'repository-root' }` anchors to the roots themselves, which means it
adopts the anchored branch's fail-closed semantics: a root that cannot be
realpath'd is **dropped**, where an unanchored call today falls back to comparing
the lexical `resolve(r)`.

That is a genuine behaviour change on paper, so it is stated rather than
buried. Its reachability is bounded by an argument round 1 already established
against the sync resolver: `realpath(candidatePath)` resolves the entire chain
including the root, so a candidate cannot resolve while its own parent root does
not. An unresolvable root therefore implies an unresolvable candidate, which
throws at the earlier `realpath` call before any root comparison happens.

The lexical fallback is, on that argument, unreachable in the admitting
direction. It is being removed at 22 sites on the strength of it, so the
argument gets a test rather than a footnote (task 4.4): construct an unresolvable
root and assert the refusal is identical before and after. If the test shows a
reachable difference, D2 is wrong and `repository-root` must instead preserve the
unanchored branch verbatim — the fallback decision, not the classification, is
what would change.

### D3 — Keeping a 28-site mechanical diff reviewable

This is the objection that deferred the work in the first place: a wide,
near-identical diff is where a real change hides. Three constraints:

1. **The three shapes land as three commits**, in this order — the type change
   plus the six already-anchored sites (semantics unchanged, only spelling);
   then the 22 `repository-root` sites (D2's fallback removal, the only
   behavioural commit); then `daemon-named` with its reasons. A reviewer can
   read commit 2 alone and see the entire behavioural surface.
2. **No site changes classification silently.** Any site whose classification is
   not the one the survey table predicts is called out in `tasks.md` §5 with its
   reasoning, not folded into the mechanical pass.
3. **The survey is re-derived, not trusted.** The counts above came from a grep
   on `resolveAllowedNamed` and `PathResolver`. D6a of the prior change recorded
   that grepping for the `roots:` property name misses a site that builds its
   options indirectly — which is how the `skills/` escape was missed. Task 2.1
   re-derives the list from the type checker instead: make the field required,
   and let every error location be the enumeration.

Point 3 is the real method here. The compiler is a sounder enumerator than any
grep, and this change's chief benefit is that it makes the compiler capable of
answering the question at all.

### D4 — Which sites are `daemon-named`

The family roots bound into `makeCoverageResolver`
(`~/Sourcecode/{agenticapps,factiv,neuroflash}` and the `claude-workflow`
migrations directory) are already documented as "a deliberate cross-family
allowance [that is] never narrowed", and are bound at resolver construction
rather than passed per call — they are the resolver's own roots, not a caller's.
They therefore keep their current treatment and are *not* what `daemon-named`
classifies.

`daemon-named` classifies a **caller-supplied** root that lies outside every
repository: `workflowArtifactScanner`'s `~/.claude/skills` and `~/.codex/skills`
machine roots. Task 3.1 confirms this split against the code before the
classification is applied, because the distinction between "the resolver's bound
roots" and "a root the caller passed" is exactly the kind of thing the prior
change's enumeration got wrong once already.

## Risks / Trade-offs

- **A mechanical diff conceals a real change** → D3: three commits split by
  shape, with the single behavioural commit isolated; any classification that
  departs from the survey is named in `tasks.md` rather than absorbed.
- **D2's fallback removal is reachable after all** → task 4.4 tests it directly
  before the 22 sites are converted, and D2 states what changes if the test
  disagrees. The argument is inherited from a round-1 finding, so it is
  second-hand evidence until this change re-proves it.
- **`reason` strings decay into "because"** → the three initial reasons are
  written from D8's actual evidence (the 33-of-98 and 13-of-14 counts), which
  sets the standard. This is a convention, not an enforcement; nothing checks
  that a reason is true.
- **Wider churn than the security content warrants** → accepted and deliberate.
  The alternative is the status quo, in which the security content is
  unreviewable because absence carries no signal.

## Migration Plan

Internal API only — no deployed contract, no persisted data, no rollback
window. `packages/shared` and `packages/spa` are untouched, so the daemon and
SPA cannot skew. Reverting is `git revert` of the three commits.

## Open Questions

- **Should `resolveAllowed` gain the same explicitness?** It anchors
  unconditionally today, so there is nothing optional to require — but that
  means the two resolvers now express containment in two different vocabularies.
  Left alone here deliberately; worth revisiting only if a third resolver
  appears.
- **Does the compiler-as-enumerator method (D3.3) actually find a site the grep
  missed?** If it does, that is the strongest possible evidence for this change
  and belongs in the tasks record. If it does not, the grep is corroborated but
  the method is still the sounder one to have used.
- **Carried unresolved from #100:** TOCTOU (above, explicit non-goal), and the
  load-sensitive `changeReader` bound tests, which are unrelated to these
  resolvers — no import path connects them — and belong with the bounds work.
