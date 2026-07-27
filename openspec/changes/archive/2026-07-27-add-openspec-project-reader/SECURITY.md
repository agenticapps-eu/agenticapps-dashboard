---
change: add-openspec-project-reader
artifact: SECURITY
gate: /cso
audit_date: 2026-07-26
mode: scoped (--diff, --scope "allow-list + CLI invocation + new route")
against: openspec/specs/filesystem-access-policy/spec.md
findings: 1 HIGH (fixed), 0 CRITICAL, 0 MEDIUM
verdict: PASS after remediation
task: 92
---

# SECURITY — add-openspec-project-reader

Scoped audit of the three surfaces task 92 names: the `ALLOWED_SUBDIRS`
widening (group 1), the `openspec` CLI invocation discipline (group 2, spawn
site 3), and the new `GET /api/projects/:id/openspec` route (group 6).

Read-only audit. The one finding was fixed under TDD and is recorded below with
its RED evidence.

## Attack surface touched

| Surface | Change | Trust boundary |
|---|---|---|
| `ALLOWED_SUBDIRS` | `+ 'openspec'` | project filesystem → `/read` route |
| `openspecCli.ts` | new subprocess spawn site | daemon → local binary on `PATH` |
| `routes/openspec.ts` | new authenticated read route | bearer-token client → daemon |

No new inbound network surface, no new writes, no new credential handling, no
LLM boundary. The daemon remains read-only on project filesystems.

## Finding 1 — PATH lookup on the request path

* **Severity:** HIGH
* **Confidence:** 9/10
* **Status:** VERIFIED (by reading both call sites and the resolver)
* **Category:** OWASP A08 — Software and Data Integrity Failures
* **Files:** `packages/agent/src/routes/openspec.ts:45`,
  `packages/agent/src/lib/registry.ts:552`
* **Disposition:** **FIXED** in this change

### Motivating code

`routes/openspec.ts:45`, inside the request handler and after the cache check:

```ts
const binary = await resolveOpenspecBinary()
```

`lib/registry.ts:552`, inside `listProjectsWithStatus`:

```ts
const binary = await resolveOpenspecBinary()
```

`resolveOpenspecBinary` (`openspecCli.ts:86-111`) walks every `PATH` entry
performing `realpath` → `stat` → `access(X_OK)` on each. It memoises nothing.

### Why it is a defect

`OpenSpec CLI Invocation Discipline` states it twice, in the requirement body
and again as a scenario:

> The binary SHALL be resolved once at daemon start, not per request … and MUST
> NOT retry a `PATH` lookup per request.

> **Scenario: Resolution is not retried per request** — … **AND** no `PATH`
> lookup and no process spawn is attempted on the request path.

Both call sites are on the request path. `/api/registry` and
`/api/projects/:id/openspec` are each polled by the SPA every 5s, and the
5s daemon memo does not cover resolution on a cache miss.

### Exploit scenario

1. A local user (or a process running as the daemon's user) can write to any
   directory that appears in the daemon's `PATH` before the real binary — a
   user-writable `~/bin`, a `/usr/local/bin` with loose permissions, or a
   `PATH` entry added by a shell profile.
2. They drop an executable named `openspec` there.
3. Within one poll interval (~5s) the daemon's next uncached read walks `PATH`
   again, resolves the planted file, and executes it with the daemon's
   privileges and a registered project root as `cwd`.
4. No daemon restart is required and nothing is logged as unusual.

Resolving once at start does not make planting impossible, but it narrows the
window to before daemon start and forces a restart — which is observable —
rather than granting execution silently on the next poll. That is precisely the
property the spec clause buys, and it was not being delivered.

**Severity rationale:** HIGH, not CRITICAL. It requires an existing local write
primitive on a `PATH` directory, so it is a persistence/escalation aid rather
than a remote entry point. It is not discarded under hard-exclusion rule 6
("missing hardening") because the spec states the bound as a MUST and the code
did not meet it — this is a conformance failure with a concrete attack path, not
an absent best practice.

### Remediation applied

Added `getOpenspecBinary()` — a resolve-once accessor caching the *promise*, so
concurrent first callers share one walk instead of racing several. Both call
sites now use it; no non-test caller of the raw resolver remains on a request
path. A resolution *failure* is cached too, which the spec also requires
("the reader SHALL use the tree path for the remainder of the daemon's
lifetime").

Three tests were written RED first, in `openspecCli.test.ts`:

- `does not re-walk PATH after the first resolution` — resolves, deletes the
  binary, asserts the raw resolver now returns null while the accessor still
  returns the resolved path. The disappearance is then handled by the
  spawn-failure path the spec separately requires.
- `caches a resolution failure too` — a binary planted *after* first resolution
  is not picked up. This is the security property stated directly.
- `returns the same promise-resolved value to concurrent callers`.

## Checked and clean

Each of these was traced in code, not pattern-matched.

**Command injection — clean.** `runOpenspecList` spawns via `execa(binary, [...ARGV_BY_KIND[kind]], { shell: false })`.
The argv table is a frozen two-entry const (`list --json`, `list --specs --json`);
no code path builds an argv element from a value read out of a project tree.
The only request-derived value reaching the call is `cwd`, and with `shell: false`
a root containing spaces, quotes or metacharacters is passed as one opaque
argument. Matches the spec's "No value reaches a shell" scenario.

**Subprocess bounds — clean.** `detached: true` makes the child a group leader
and the timeout signals `-pid`, so a wrapper script that forks cannot orphan a
grandchild holding the stdout pipe. Output is capped by `maxBuffer` and
re-checked on the captured string, because `maxBuffer` is best-effort at the
boundary. Every failure mode (`unavailable`, `spawn-failed`, `timeout`, `exit`,
`oversized`, `unparseable`, `unrecognised`) returns a fallback reason rather
than throwing, so none can surface as a route error.

**`PATH` handling — clean.** Empty `PATH` elements are skipped explicitly rather
than resolved, so the daemon's cwd is never searched for an executable. Relative
`PATH` entries are skipped. Only absolute regular executable files resolve.

**Allow-list widening — clean.** `openspec` was added to the existing
`ALLOWED_SUBDIRS` tuple, so it inherits every guard `resolveAllowed` already
applies: absolute paths rejected, `..` components rejected before any
filesystem call, `realpath` followed to defeat planted symlinks, and the prefix
check uses `root + sep` so a sibling named `openspec-evil` cannot match. The
exposure this widening creates is argued rather than assumed in the spec delta,
and the categories `.planning` already carried match one for one.

**Read size cap — clean, and better than the spec's letter.** `routes/read.ts`
opens the file, `fstat`s the *descriptor* rather than the path (so the check
cannot be raced by swapping the path between stat and open), refuses above
`MAX_READ_BYTES` with a distinct `file_too_large`, then reads at most the cap and
peeks one byte beyond to catch a file that grew during the read.

**Named bounds — clean.** `MAX_READ_BYTES` (5 MiB),
`OPENSPEC_SUBPROCESS_TIMEOUT_MS` (5s) and `OPENSPEC_MAX_OUTPUT_BYTES` (2 MiB)
are each a single named constant in `constants.ts`, finite, with no
configuration path that can disable them.

**New route — clean.** `GET /api/projects/:id/openspec` sits behind the app's
bearer-auth middleware (verified: an unauthenticated request returns 401 before
routing, test `OS6`), takes no user-supplied path, resolves its root from the
registry by id, and returns only names and counts — never file contents. An
unknown id returns a 404 `project_not_found` rather than probing the filesystem.

**Symlink escape via the tree reader — considered, not a finding.**
`readOpenspecTree` enumerates with `withFileTypes` and tests `isDirectory()`,
which is false for a symlink, so symlinked directories are not traversed. A
symlinked `tasks.md` or `spec.md` would be followed by `readFile`, but the
reader returns only a count of matching lines, never content. Below the
reporting bar: no content crosses the boundary.

## Filter stats

| Stage | Count |
|---|---|
| Candidates considered | 9 |
| Discarded — hard exclusion | 2 (DoS-shaped; unbounded-poll cost) |
| Discarded — below 8/10 confidence | 6 |
| **Reported** | **1** |

## Disclaimer

This is not a substitute for a professional security audit. `/cso` is an
AI-assisted scan that catches common vulnerability patterns — not comprehensive,
not guaranteed, and not a replacement for a qualified security firm. For
production systems handling sensitive data, payments, or PII, engage a
professional penetration testing firm.
