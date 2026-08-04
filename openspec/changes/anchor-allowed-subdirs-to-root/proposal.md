## Why

A registered project whose allow-listed subdirectory is itself a symlink can
make the daemon serve files from anywhere that symlink points. `resolveAllowed`
builds its containment boundary by resolving `<root>/.planning`, `<root>/.claude`
and `<root>/openspec` and admitting anything under the result — but it never
checks that the resolved boundary is still inside the project root it came from.
When `.claude` is a symlink to `$HOME`, every per-path check still passes,
because each path genuinely does lie under the boundary the reader adopted. The
boundary is the thing that escaped.

Reproduced against a temp repo before writing this proposal: with
`<tmp>/project/.claude` symlinked to `<tmp>/outside`,
`resolveAllowed(project, '.claude/secrets.txt')` **returned**
`<tmp>/outside/secrets.txt` — a path not contained in the project root — while an
ordinary `.claude` directory resolved normally. This is reachable through
`GET /api/projects/:id/read`, which serves file contents to the SPA, and
`POST /api/projects/:id/open`, which hands the path to `$EDITOR`.

This is the escape shape fixed on #98 for the change board, in the module that
governs every project-scoped read rather than one panel. It was found during that
review and held out of scope as pre-existing.

## What Changes

- `resolveAllowed` anchors each allow-listed root to the realpath of the
  registered project root before adopting it as a containment boundary. A root
  that has left the project is not a usable boundary and is dropped, so a path
  reachable only through it is refused with the existing `PathViolation`.
- The same anchor check is applied at the five scanner call sites that adopt a
  containment boundary derived from a path *inside* a repository without
  verifying it first:
  - `projectMetadataScan` — `<root>/.github/workflows`, anchored **before** the
    directory is listed, since entry names are content too
  - `workflowVersionScanner` — `skillRoot` (`<repo>/.claude/skills`)
  - `workflowFleetScanner` — the `skills/` root itself, anchored before it is
    enumerated (found in review round 2; anchoring only its children was too late)
  - `workflowFleetScanner` — `skillDir`
  - `workflowFleetScanner` — `skillPath`

  **`workflowArtifactScanner.ts:414` was listed here and is refuted.** Its
  `canonicalRoot` derives from a *machine* root (`~/.claude/skills`,
  `~/.codex/skills`), which the daemon supplies directly — there is no registered
  repository above it to anchor to, so it is the same kind of root as the family
  roots rather than a boundary derived from inside a repo. Symlinking skills into
  those directories is the intended install mechanism, not an escape: on this
  machine 13 of 14 entries under `~/.codex/skills` and 33 of 98 under
  `~/.claude/skills` are symlinks into `~/Sourcecode` repos. Anchoring it would
  report every one of them missing. It is not one of the sites fixed here; six
  are, counting `resolveAllowed` itself and the five scanner boundaries above.
- A single shared anchor helper backs both the async (`paths.ts`) and the
  synchronous (`coverageResolver.ts`) resolvers, so the rule has one
  implementation rather than one copy per call site.
- **No behaviour change for ordinary repositories.** A real allow-listed
  directory, and a symlink *under* one, both keep working exactly as today; the
  latter stays governed by `Per-Project Path Allow-List`.

Two findings shape the scope and are worth stating plainly:

- **Adding `repoAbsPath` alongside `skillRoot` does not mitigate anything.**
  Roots are OR'd, so an escaped `skillRoot` admits its target regardless of what
  else is in the list. `workflowVersionScanner.ts:158` reads as though it were
  defensive and is not.
- **`coreSpecVersionScanner.ts:92` already does this correctly** — it resolves
  `specDir` with `roots: [coreRepoRoot]` before adopting it as the boundary for
  subsequent reads. The fix is therefore not a new invention; it is an existing
  in-repo pattern applied where it was omitted.

## Capabilities

### New Capabilities

None. This change adds no capability; it closes a gap against one that exists.

### Modified Capabilities

- `filesystem-access-policy`: the durable requirement *A Containment Anchor Is
  Verified Against Its Registered Root* (added by #98) already governs this
  defect — its own note says it governs "the allow-listed directory **being** a
  symlink", which is exactly what escapes here. So the code violates a
  requirement that is already durable, and this is not a request to permit
  something new.

  The delta is therefore **scenarios, plus one wording correction, not a new
  requirement**. The requirement currently opens "A reader that resolves an
  allow-listed directory **once and reuses** that resolved path…", which was
  written for the change board's shape, where the anchor is resolved once and
  cached. `resolveAllowed` re-resolves per call and is still defective, so the
  "once and reuses" phrasing invites the reading that a per-call resolver is out
  of scope. It is not: what matters is that a boundary was *derived* from a path
  that can leave the root, never that it was cached. The wording is corrected to
  say so, and scenarios are added for the per-call read-route case and for the
  scanner derived-root case.

  This tightens the requirement's reach and relaxes nothing.

## Impact

- **Routes** — `GET /api/projects/:id/read` and `POST /api/projects/:id/open`
  refuse the escaping path with the `PathViolation` they already translate. No
  new error shape, no SPA change, no wire-schema change.
- **Scanners** — a repository whose derived root escapes contributes nothing read
  *through that boundary*. It still appears in the results, degraded: the fleet
  scanner emits `missing` skills and the version scanner reports `state:
  'missing'`, via the per-repository degradation path each already has. The
  repository is not omitted from the output.
- **Cross-family reads survive for unanchored readers only.** An anchored call
  asserts that the read stays inside the named repository, and under design D7 it
  therefore does not fall back to the family roots. Scanners that legitimately
  read a *different* repository — `coreSpecVersionScanner` against
  `claude-workflow` — are unaffected precisely because they are unanchored.
  Anchoring such a call site in future would silently cost it that reach, so the
  anchor belongs only where the root is derived from inside one repository.
- **`packages/shared`** — untouched.
