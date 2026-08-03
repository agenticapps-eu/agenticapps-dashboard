## Context

`SanitisedTextSchema` in `packages/shared/src/schemas/readiness.ts` is the
outbound guard that keeps absolute filesystem paths off the wire. It works on
rendered text, using two boundaries of deliberately different strictness: a
leading `/` at a strong boundary is refused outright, and a colon-adjacent `/`
is refused only when the segment after it names a filesystem root — so that
`GET:/api/v2/fleet` survives while `resolved to:/Users/donald/x` does not.

Two fields carry it: `CheckErrorSchema.message` and `ReadinessNoticeSchema.message`.
Exactly two sites build either from author-controlled input:

| Site | Author input | Guard today |
|---|---|---|
| `readinessFile.ts` → `citationNotice` | the cited evidence path | **none** |
| `assemble.ts` → `refusedResult` via `wireSafeReason` | the cited evidence path | drops the path whenever it contains any colon |

`RepoRelativePathSchema` permits a colon: it rejects a leading `/`, a leading
`~`, a backslash, a drive letter, and `.`/`..`/empty segments, and nothing else.
So `docs/notes:/Users/x.md` is a legal citation. Rendered into the notice it
reads `… cites evidence that could not be verified: docs/notes:/Users/x.md does
not resolve inside the repository`, which the daemon's own guard refuses.

The route parses the whole payload in one call — `outbound(c, parseFleet, …)` —
so that refusal becomes `500 schema_drift` for the entire fleet. One repo, one
filename, every repo's readiness gone. Verified against the live regex, not
inferred.

The sanitiser's comment bounds its residual risk on the claim that *"no message
this daemon constructs interpolates anything but a repo-relative path"*. That
sentence is not stale, it is inverted: a repo-relative path is the thing that
breaks it.

## Goals / Non-Goals

**Goals:**

- A legal repo-relative citation reaches the reader in `error.message`, colon or
  not. Today it is either deleted from the message or fatal to the response.
- No readiness response can fail its own outbound validation because of
  author-controlled text — structurally, not by the heuristic being clever
  enough.
- The notice site gains the guarantee it has never had.
- The comment's stated bound is replaced by one that is true.

**Non-Goals:**

- **Structural carriage of the path** — a `path` field beside the message,
  validated by `RepoRelativePathSchema`. This is the complete fix and removes the
  residual entirely, because the daemon already knows the value is repo-relative
  and re-deriving that from prose is strictly worse. It is not taken here: both
  schemas are `.strict()`, the SPA must render the new field, and that engages
  the `impeccable:critique` gate. This change is confined to stopping the outage.
- Widening `RepoRelativePathSchema` to forbid colons. That would make the
  daemon reject legal paths on disk to suit its own error formatting.
- Any change to `summary`, which is unrestricted and already carries the path.

## Decisions

### 1. Narrow the colon clause; do not loosen the strong-boundary clauses

Clause 3 becomes anchored at a strong boundary and requires the token holding the
colon to contain no `/`:

```
before:  :/(?:Users|home|…)\b
after:   (?:^|[\s"'`([<])[^\s"'`([</]*:/(?:Users|home|…)\b
```

`docs/notes:/Users/x.md` has a `/` before its colon, so no strong boundary can
reach the colon without crossing one — no match. `resolved to:/Users/x` has a
slash-free `to`, so it still matches.

Verified before adoption against a matrix of legal paths, leak shapes and benign
route text:

- newly accepted, all legal: `docs/notes:/Users/x.md`, `assets/img:/Library/a.png`,
  `deep/nested/dir:/tmp/f`
- still refused, no regression: `resolved to:/Users/donald/secret`,
  `failed at:/home/x/y`, `read /Users/donald/x failed`, `of "/var/db/x"`,
  `C:/Users/x is bad`, `scan at:/Volumes/ext/p`, UNC `\\server\share`
- unchanged: `GET:/api/v2/fleet returned 500`, `ratio 3:/4`

Clauses 1, 2 and 4 are untouched. Clause 3 only ever mattered for the
colon-adjacent no-whitespace case; a leak preceded by whitespace or a quote is
caught by clause 1 regardless, which is why narrowing clause 3 costs almost
nothing in detection.

**Alternative rejected:** dropping clause 3 entirely. It is the clause that
catches the realistic interpolation shape (`… to:${abs}`); removing it trades a
narrow false positive for a broad false negative.

### 2. The predicate and the schema are built from one regex

`carriesAbsolutePath(text)` is exported from the same module and
`SanitisedTextSchema` refines on `!carriesAbsolutePath(v)`. Callers therefore
test with exactly what the boundary enforces. A second, hand-kept copy of the
rule in the agent is how the current workaround went wrong: `wireSafeReason`
tests `cited.includes(':')`, which is neither necessary nor sufficient — it
discards `docs/a:b.md`, a path the regex has always accepted.

### 3. Fail-soft at construction, not fail-open at the boundary

`wireSafeText(text, fallback)` returns `text` unless it carries an absolute path,
else `fallback`. The boundary stays fail-closed; what changes is that no caller
hands it text it cannot certify. This is what makes "no 500" a property of the
design rather than of the heuristic's accuracy, and it is why the residual case
is acceptable rather than merely tolerated.

**Alternative rejected:** catching the `ZodError` in `outbound()` and stripping
offending fields. That converts a contract violation anywhere into a silent
mutation, and would mask real leaks — the opposite of what this guard is for.

### 4. `wireSafeReason` is deleted, not generalised

`refusedResult` builds the full reason including the path and passes it through
`wireSafeText`. Net effect: paths that are actually safe now reach the reader,
where today any colon removes them. The `RejectedCitation.reason` doc comment
claiming the value is *"Safe to put on the wire"* is corrected — that claim is
the defect in one line.

### 5. No delta for `Readiness Endpoints Degrade Per Check And Per Repo`

That requirement already states *"a failure for one repo MUST NOT remove other
repos from the fleet result"* and *"Responses SHALL be validated against the
shared schema before being sent."* The outage is already forbidden; the code was
non-compliant. Adding a requirement would imply the spec had a gap it does not
have. The obligation that genuinely is missing — that a validated repo-relative
reference must survive to the reader — is added where it belongs, to the
requirement that owns error text.

## Risks / Trade-offs

- **The narrowing is a real weakening, not a free tightening.** After it,
  `<slash-bearing-token>:/Users/…` is read as a repo path. No message the daemon
  builds today has that shape, but the guarantee is weaker than the one it
  replaces. → The rewritten comment states this outright, so the next reader
  trades against a fact rather than an assumption.
- **The residual is real and stays.** A colon in the *first* path segment
  (`ab:/Users/x`, `ab:cd:/Users/x`) is still indistinguishable from a leak and is
  still withheld. → It fails soft: the message loses the path, `summary` keeps
  it, the response is answered. The non-goal above names the change that would
  close it.
- **Two mechanisms now govern one concern**, and a future caller could build a
  sanitised message without the helper and reintroduce the outage. → Both
  author-input sites are covered and a route-level test asserts 200 on the
  triggering input, so a regression fails a test rather than a dashboard.
- **A test asserting a leak is still refused is the load-bearing one.** A
  narrowing like this is exactly where a leak would slip in unnoticed. → The full
  refusal matrix is pinned at the schema level, not sampled.

## Migration Plan

None. No wire field is added, removed or retyped; no persisted data or cache
shape changes; no SPA change. The daemon is the only artifact, and a stale SPA
against a new daemon sees identical payloads.

Rollback is reverting the commit.

## Open Questions

- Should `wireSafeText` live in `packages/shared` beside the schema, or in the
  agent's readiness module? Shared is chosen so the predicate cannot drift from
  the boundary, at the cost of putting a construction helper in a schema package.
- The residual case leaves an error message with no path while `summary` has one.
  Whether the detail panel should visibly reconcile the two is a surface question
  this change does not answer, and would engage the design gate if taken up.
