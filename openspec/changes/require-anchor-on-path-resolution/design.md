## Context

`anchorTo?: string` exists on two resolvers — `resolveAllowedNamed` in `paths.ts`
(async) and the `PathResolver` returned by `makeCoverageResolver` in
`coverageResolver.ts` (sync). Both were added by
`anchor-allowed-subdirs-to-root`, which anchored six boundaries and left the
field optional everywhere else.

### The inventory, re-derived after review round 1 falsified it

The first draft of this document claimed 28 `resolveAllowedNamed` sites and
placed all six anchored ones in the two scanner files. Both claims were wrong,
and the error is instructive enough to keep rather than quietly correct: the
count came from `grep -c` on the *identifier*, which counts imports, JSDoc
mentions and the function definition alongside actual calls. 16 of the 28 were
not call sites. A document whose central method is "the survey is re-derived,
not trusted" (D3.3) had itself trusted a survey.

Counted as invocations on `main` at `dcc5d13`:

| Resolver | Call sites | Anchored today | Where the anchored ones are |
|---|---|---|---|
| `resolveAllowedNamed(` | 12 | 2 | `projectMetadataScan.ts:275,299` |
| `PathResolver` — `resolve(…, { roots })` | 12 | 4 | `workflowFleetScanner.ts` ×3, `workflowVersionScanner.ts` ×1 |
| **Total** | **24** | **6** | |

The scanner files hold four of the six and call `resolveAllowedNamed` **zero**
times — they are `PathResolver` consumers. That distinction was invisible in the
original count and matters, because the two resolvers do not treat an anchor
alike (D2).

This second count keys on `roots:` again, which D6a of the prior change already
recorded as unsound — it cannot see a site that builds its options indirectly.
That is why D3.3 makes the type checker, not this table, the authority.

### The three shapes

- The root **is** a repository root (`roots: [projectRoot]`) — the common case.
- The root is **derived** from a path inside a repository (`workflowsDir`,
  `skillRoot`, `skills/`) — the live check; all six anchored by #100.
- The root is a **daemon-named machine root**, deliberately outside every
  repository. There are five: `agenticapps-bin`, `claude-skills`,
  `codex-skills`, `opencode-skills`, `pi-skills`
  (`workflowArtifactScanner.declare.ts:74-79`).

The third shape is currently expressed by *omission*, which is the ambiguity
this change removes.

## Goals / Non-Goals

**Goals:**

- Every resolution site in scope states its containment classification, enforced
  by the type checker rather than by review attention.
- The classification that widens reach beyond a repository carries a written
  reason, so it is auditable and greppable rather than merely absent.
- **Admission is unchanged at every site.** After review round 1, this is not an
  aspiration but the design's central constraint — see D2.

**Non-Goals:**

- Making declarations *correct*. The type system forces a variant, not the right
  variant. This is stated plainly in the spec delta rather than implied away;
  D5 supplies the compensating test.
- Closing TOCTOU. Unchanged from #100: `routes/read.ts`'s `O_NOFOLLOW` +
  re-`realpath` remain the only mitigations.
- Changing `resolveAllowed` (the `ALLOWED_SUBDIRS` path), which already anchors
  unconditionally, or the family roots bound inside `makeCoverageResolver`,
  which are the resolver's own. D7 states the normative scope so "every
  resolution site" does not overclaim.

## Decisions

### D1 — A required three-variant union

```ts
type Containment =
  | { kind: 'anchored'; root: string }
  | { kind: 'repository-root' }
  | { kind: 'daemon-named'; rootId: WorkflowMachineRootId; reason: string }
```

`daemon-named` carries an **enumerated** root identity, not free text. Review
round 2 was right that `{ reason: string }` alone would let any root at all skip
anchoring on the strength of any non-empty string — an unbounded exemption
wearing the appearance of a decision. `WorkflowMachineRootId` already exists
(`workflowArtifactScanner.declare.ts:74-79`) and call sites already know their
id, since `workflowScan.ts:194` indexes `configuredMachineRoots[rootId]`. The
resolver verifies the supplied root matches the root registered for that id, so
the hatch is bounded by construction rather than by convention, and `reason`
becomes a per-root rationale rather than a place to type anything. A blank or
whitespace reason is rejected.

*Alternative considered:* `anchorTo: string | null`. Rejected: `null` records
only that someone typed `null`, and cannot distinguish "the roots are repository
roots, so anchoring is an identity" from "this root deliberately lies outside
every repository". Those are different security claims and only the second needs
justification.

*Alternative considered:* two variants with a bare marker. Rejected: it
separates the claims but records no reason, leaving D8's rationale in an
archived design document that a future reader of `workflowArtifactScanner` has
no cause to open.

### D2 — No variant changes admission; `repository-root` maps to the existing unanchored branch

**This decision reverses the first draft, which review round 1 falsified twice.**

The draft had `repository-root` adopt the *anchored* branch's semantics, and
argued the resulting fallback removal was unreachable. Both halves were wrong:

1. **The unreachability argument is false.** With `root = <real>/missing/..`,
   `realpath(root)` throws ENOENT while `resolve(root)` normalises to `<real>`,
   under which the candidate resolves and is admitted today. Anchoring drops the
   root and refuses. Verified by direct probe, not by reasoning — the inherited
   round-1 claim ("an unresolvable root implies an unresolvable candidate") holds
   only when the root's unresolvability survives lexical normalisation, and `..`
   is exactly the case where it does not.
2. **It ignored the family roots.** `coverageResolver.ts:186` merges
   `[...allowedRoots, ...callerRoots]` on the unanchored path and uses
   `callerRoots` alone on the anchored one. Sending `repository-root` down the
   anchored branch would silently strip the cross-family allowance from scanners
   that depend on it. Round 1 put the dilemma precisely: removing them changes
   admission, retaining them would violate the rule that ambient authority
   cannot rescue an anchored read.

The dilemma dissolves once `repository-root` stops meaning "anchor to yourself".
It maps to the **existing unanchored branch, byte-for-byte**, and is purely a
declaration: *these roots are repository roots; anchoring would be an identity;
behaviour is deliberately unchanged.* `daemon-named` maps there too. Only
`anchored` takes the anchored branch, and only the six sites already on it.

So the executable content of this change is exactly: a required field, and
nothing else. That is a smaller change than the draft described and a strictly
better one — the entire class of behavioural risk the draft spent its risk
budget on does not arise. It also makes the "admission unchanged" scenario in
the spec delta true unconditionally, where the draft contradicted it.

**What `repository-root` therefore does not mean.** Review round 2 caught the
spec claiming daemon-named was "the only case that widens reach beyond a
repository". On `makeCoverageResolver` that is false: the unanchored branch
merges the standing family roots, so a `repository-root` read there is admitted
under those roots too. The family roots are the same second-order effect that
falsified the draft twice, surfacing a third time — in the prose rather than the
code. A declaration names the boundary the caller supplied; it is not a claim
that the resolution is confined to it. Only `anchored` confines. The spec now
says so, and this is the one place where the union's names are actively
misleading if read casually.

### D3 — Commit sequencing that compiles at every step

The draft's three commits could not build: commit 1 made the field required
while 18 sites still omitted it. Bisect and per-commit CI would both have been
defeated. Corrected sequence:

1. **Add** `containment` as optional alongside `anchorTo`, with the union type
   and the unanchored/anchored mapping of D2. Compiles; nothing changes.
   Supplying **both** `anchorTo` and `containment` in the same call is rejected
   as a `PathViolation`, in the manner `allowedNames` and `extension` are
   already mutually exclusive. Round 2 was right that a transitional API
   accepting two mechanisms invites a call that sets a contradictory pair and
   silently obeys one of them; the migration window is exactly when that would
   go unnoticed.
2. **Migrate** all 24 sites to `containment`, in three reviewable slices by
   shape (`anchored` ×6, `repository-root`, `daemon-named`). Compiles at each
   slice; admission unchanged throughout, which §1.1's characterisation tests
   assert.
3. **Remove** `anchorTo` and make `containment` required. The commit that closes
   the hole, and by then a one-line type change.

D3.3 stands and is now the only enumeration authority: after step 3, every
undeclared site is a compiler error. The grep produced two wrong tables in this
document already; the compiler cannot.

### D4 — What `daemon-named` classifies

Five machine roots, not the two the draft named: `agenticapps-bin`,
`claude-skills`, `codex-skills`, `opencode-skills`, `pi-skills`. Their reasons
come from D8's evidence — symlinking skills into these directories *is* the
install mechanism, and 33 of 98 and 13 of 14 entries are such symlinks, so
anchoring would report all of them missing.

The family roots bound into `makeCoverageResolver` are **not** classified by
this union. They are the resolver's own roots, not a caller's, and no call site
passes them. D7 covers them.

### D5 — Declaration correctness is not claimed, and is compensated

The union forces *a* variant, not the right one. Any of the six derived sites
could be relabelled `repository-root`, compile cleanly, and silently revert
#100's fix — the exact failure class this change exists to close. Round 1 was
right that the draft conceded this in prose and then supplied no mechanism.

Two responses, and neither is "the type system handles it":

- The spec delta says what is actually enforced — a declaration is required, not
  that it is true — rather than asserting an unenforceable THEN.
- A test pins the six derived sites as `anchored` and fails if any is
  relabelled (task 4.2). It is a regression guard on #100's fix, which is the
  concrete thing at risk.

Round 2 noted that the spec promised more than that test delivers: the scenario
read as though *any* anchored boundary resisted reclassification, while the test
names six. The scenario is now scoped to the boundaries the coverage names, with
a second scenario putting the obligation where it can actually be met — a newly
anchored boundary joins the coverage as part of being anchored. Claiming
automatic protection for sites that do not exist yet would be the same kind of
unenforceable THEN this decision exists to remove.

### D6 — Heterogeneous `roots` arrays

`roots` is an array while `containment` classifies the whole call, so a call
mixing a repository root with a derived one has no honest single classification.
No such call exists today (task 2.4 verifies this rather than assuming it). The
rule is a stated prohibition: a call's roots SHALL share one classification, and
a site needing two SHALL be split into two calls. A prohibition beats per-root
classification here because splitting is always available and costs nothing,
while per-root typing would complicate all 24 sites to serve zero of them.

Round 2 asked how a split preserves admission. It does so because supplied roots
are **already** alternatives and the result does not depend on which one
matched: both resolvers test `mergedRoots.some(root => isAnchoredUnder(real,
root))` and then `return real`, the candidate's own realpath. Matching is
therefore order-independent and the return value is root-independent, so
recombining the split resolutions as a logical OR — admitted if any admits —
reproduces the original admission exactly. The spec states that recombination
rule so a split cannot be done some other way and still called equivalent.

Round 2's accompanying concerns about *root priority* and *which candidate is
returned* are refuted by the same two lines: there is no priority in a `some()`,
and no candidate selection in a function that returns the path it was given.
What genuinely does change across a split is the caller's error handling — two
`PathViolation`s to consider instead of one — which is a caller concern and not
an admission one.

### D7 — The normative scope

"Every resolution site" overclaims. The requirement covers **caller-supplied
roots passed to `resolveAllowedNamed` and to `PathResolver`**. It does not cover:

- `resolveAllowed`, which anchors unconditionally against `realProjectRoot` —
  there is no optional field to make required.
- The family roots bound inside `makeCoverageResolver`, which are not passed by
  any caller and are governed by `Named Allowed Roots For Fleet Scanners`.

Both exclusions are in the spec text, not just here, so the requirement cannot
be read as covering boundaries it does not reach.

### D8 — Classification must reach helpers that relay a resolver

`readSkillVersions` (`readiness/workflowDeriver.ts:193`) is called with
`[hostRepo]` at :184 and with `[machineRoot]` at :287 — one helper, two
classifications. A required field on the resolver does not by itself say how the
right classification arrives there, and round 1 was right that the draft never
addressed it.

Helpers that relay a resolver take `containment` as a parameter and pass it
through; they SHALL NOT synthesise one. A helper that picks its own
classification would let a machine-root call arrive labelled as a repository
root, which is D5's failure mode reintroduced one layer up. Task 2.5 enumerates
the relaying helpers from the compiler errors of step 3 rather than by grep.

## Risks / Trade-offs

- **A declaration is not a correct declaration** → D5: scope the spec to what is
  enforced, and pin #100's six sites with a test. Residual and stated: nothing
  detects a *new* site misclassified from birth.
- **`reason` strings decay into "because"** → the five initial reasons are
  written from D8's counts, setting the standard. Nothing checks a reason is
  true; the spec says so rather than implying otherwise.
- **The inventory is wrong again** → it was wrong twice already in this document.
  D3.3 moves the authority to the compiler; §5 records the diff between what the
  compiler finds and this table, whichever way it falls.
- **Wide mechanical churn** → smaller than the draft claimed (24 sites, no
  behaviour change), and D3's sequencing keeps every commit building.

## Migration Plan

Internal API only — no deployed contract, no persisted data, no rollback window.
`packages/shared` and `packages/spa` are untouched. Reverting is `git revert` of
the three commits, in reverse order.

## Open Questions

- **Does the compiler find a site the grep missed?** Given the grep has now
  produced two wrong tables, this is no longer a curiosity — it is the main
  evidence this change offers about its own necessity. Recorded in §5 either way.
- **Should the two resolvers converge?** They express containment in two
  vocabularies and differ on ambient authority (D2). Out of scope; worth
  revisiting if a third resolver appears.
- **Carried from #100:** TOCTOU (explicit non-goal), and the load-sensitive
  `changeReader` bound tests, unrelated to these resolvers — no import path
  connects them.
