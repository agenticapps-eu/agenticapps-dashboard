---
verdict: PASS
---

# Security review — `add-repo-readiness` sections 7 and 10 (daemon endpoints)

* **Scope:** `/cso --code --diff` over the section 7 surface on
  `feat/repo-readiness-vocabulary`: `packages/agent/src/routes/readiness.ts`,
  `packages/agent/src/lib/readiness/{service,fingerprint,remedy}.ts`, and the
  `app.ts` mount.
* **Mode:** daily (8/10 confidence gate).
* **Date:** 2026-08-01.
* **Verification:** code-tracing and self-verification. Independent verifier
  sub-tasks were **not** used — this session runs under a no-subagent policy, so
  every finding below was re-read with a skeptic's eye rather than confirmed by
  a second context. Weigh the confidence scores accordingly.

## Attack surface added

| Surface | Count | Notes |
|---|---|---|
| Public endpoints | 0 | none |
| Authenticated endpoints | 4 | `GET /api/v2/fleet`, `GET /api/v2/repos/:id`, `POST /api/v2/repos/:id/rescan`, and — added in §10 — `POST /api/projects/:id/open` |
| State-changing endpoints | 1 | the rescan POST; discards a memo entry, writes nothing to disk. The open POST changes no daemon state either, but it starts a process, which is counted separately below |
| New filesystem reads | 2 | the readiness file and each machine-global `SKILL.md`, for cache keying |
| New execution paths | 1 | §7 added none. §10 adds the `$EDITOR` spawn in `routes/open.ts` — the first of `filesystem-access-policy`'s four enumerated process-creation surfaces to actually be built |
| New dependencies | 0 | |
| New secrets / CI / container changes | 0 | |

## Trust boundary

Verified by test, not by inspection alone (`packages/agent/src/routes/readiness.test.ts`):

* All three routes mount at `/api/v2` **after** `bearerAuth` in `app.ts`, so an
  unauthenticated request is refused before the service is entered. Asserted for
  each route, including that the service mock is never called.
* A `Cookie` header is not an alternative to a bearer token — asserted.
* The rescan POST refuses a disallowed `Origin` with 403 before doing any work,
  and accepts `PROD_ORIGIN`. The CORS middleware governs what a browser will
  read; this guard governs what the daemon will do.
* An unknown repo id is answered 404 from the registry alone. No identifier off
  the wire is joined to a path, resolved, or opened. Asserted with `../../etc`.
* Responses pass `FleetResponseSchema` / `RepoDetailResponseSchema` before being
  sent, so a drifted payload becomes a 500 `schema_drift` rather than reaching
  the client.

## Findings

### Finding 1: the cache fingerprint reads the readiness file without the containment primitive — `packages/agent/src/lib/readiness/fingerprint.ts:41`

* **Severity:** MEDIUM
* **Confidence:** 9/10 (containment bypass); 6/10 (exploit value)
* **Status:** VERIFIED — both sides quoted below
* **Phase:** 5 / OWASP A01
* **Category:** Filesystem containment

**Description.** `fileIdentity()` opens its candidate directly:

```ts
return createHash('sha256').update(readFileSync(path)).digest('hex')
```

and is called on `join(root, READINESS_FILE_PATH)`. The sibling code path that
reads the same file, `readinessFile.ts:56`, does not:

```ts
absolute = await resolveAllowedNamed(candidate, {
  roots: [root],
  allowedNames: ['readiness.json'],
})
```

`resolveAllowedNamed` realpaths the candidate and refuses anything landing
outside the repo root; `readinessFile.ts` then enforces a size bound before
reading. The fingerprint does neither. This is a control that exists in this
codebase and was bypassed, not a missing best practice — and section 1's task
line requires the bounded primitive for exactly these reads.

**Exploit scenario.**
1. A registered repo contains `.agenticapps/readiness.json` as a symlink
   pointing outside the repo — say at `~/.ssh/known_hosts` or a secrets file.
2. Every fleet scan reads that file in full and folds its hash into the repo's
   cache key. The hash is never serialised, so this is not direct exfiltration.
3. Because the key controls cache invalidation, and `generatedAt` reveals
   whether a snapshot was recomputed, an authenticated caller who can poll
   `/api/v2/fleet` learns **when the target file changes** — a change oracle on
   a file the policy says the daemon must never open.

**Impact.** Reads a file the filesystem-access-policy forbids, and leaks change
timing for it. Requires the ability to write into a registered repo, so this is
a local-privilege finding, not a remote one.

**Recommendation.** Route the read through `resolveAllowedNamed` with
`roots: [root]` and `allowedNames: ['readiness.json']`, and apply the same size
bound `readinessFile.ts` uses. Treat a refusal as its own identity value so a
symlinked file still invalidates distinctly from an absent one.

### Finding 1a (variant): the machine-global skill read is unbounded the same way — `fingerprint.ts:65`

Same `fileIdentity()` call, applied to
`<machineSkillRoot>/agentic-apps-workflow/SKILL.md`. Lower risk, because those
roots come from `defaultMachineRoots()` rather than from a request or a repo —
but `workflowDeriver` reads these very files through the resolver with canonical
containment and a 512 KB bound, and the fingerprint does not. Fix with the
finding above.

## Suppressed (below the 8/10 gate — recorded for calibration)

* **`summary` is the one free-text wire field not covered by
  `SanitisedTextSchema`.** `error.message` and `notice.message` are sanitised
  and reject absolute paths; `summary` is a plain bounded string. I could not
  quote any line where a deriver puts an absolute path into a summary, so under
  the pre-emit gate this is not a finding. It is also mitigated in practice:
  every error-bearing summary interpolates the same `message` that goes into
  `error.message`, so a leak there fails outbound validation and returns 500
  rather than reaching the client. Worth a hardening pass, not a finding.
* **Cross-registry memo join.** `snapshotFor()` checks the in-flight map before
  computing the fingerprint, so two concurrent requests carrying *different*
  `registryFile` overrides but the same repo id would share one computation. The
  override exists only for tests and the daemon runs one registry, so there is
  no production path. Noted so it is not rediscovered as a surprise.
* **Rescan cost amplification.** `POST /rescan` deliberately bypasses the memo,
  so an authenticated caller can force recomputation. Per-repo coalescing bounds
  concurrency to one computation per repo. Excluded as DoS under the standing
  filter rules.

## Remediation

Finding 1 and its variant were fixed in `fix(GREEN): route the fingerprint's
reads through the contained primitive`, under the same RED→GREEN discipline as
the rest of the section: the RED commit pins that a readiness file symlinked out
of the repo is never opened, and that refusing to follow it still reads
differently from finding no file at all. `fileIdentity` now resolves through
`resolveAllowedNamed` and applies a 512 KB bound before reading, and the
machine-global `SKILL.md` read goes through the same path.

Fixing it surfaced two test defects worth recording, both closed in the same
commit. Making `fleetSignature` async left six of its assertions comparing two
Promises with `.not.toBe` — trivially true, so those tests had gone vacuous. And
the first two symlink tests were confounded by the git status component, which
moves whenever a readiness file appears; they would have passed with the
containment check removed. The isolated cases now run in non-git directories
where the read is the only variable.

---

# Amendment — section 10 (`2026-08-01`, second pass)

* **Scope:** `/cso --code --diff` over §10: `packages/agent/src/routes/open.ts`
  and its `app.ts` mount, `packages/shared/src/schemas/read.ts` (the
  `ALLOWED_SUBDIRS` move), `packages/agent/src/lib/paths.ts`, and the SPA
  callers `lib/readinessQueries.ts` and `panels/readiness/RepoDetailPage.tsx`.
* **Verification:** independent verifier sub-tasks **were** used this pass —
  two fresh contexts, each given file paths and the FP rules without the
  originating reasoning. This closes the gap the §7 pass recorded, where a
  no-subagent policy left every finding self-verified.
* **`REVIEWS.md` predates this surface.** The two other-vendor reviewers signed
  off on a change whose SECURITY.md enumerated three endpoints and no spawn.
  The editor route was added afterwards, on the user's explicit instruction
  (asked and answered before any code was written). No reviewer has seen it.
  That is a known, deliberate gap, recorded here rather than papered over.

## Why this route is not a new policy

`filesystem-access-policy` has enumerated `POST /api/projects/{id}/open` as one
of four permitted process-creation surfaces since long before the daemon had it,
and bounds what may be claimed for it: for a foreign program the daemon
guarantees only the spawn boundary — the program, its arguments, its working
directory, its resource bounds, its termination — and explicitly **SHALL NOT**
assert what that program then does to the filesystem. The implementation claims
exactly that and no more.

## Findings

### Finding 2: an editor that cannot be spawned takes the daemon down — `packages/agent/src/routes/open.ts`

* **Severity:** HIGH (availability)
* **Confidence:** 10/10
* **Status:** VERIFIED — independently reproduced in raw Node by a fresh context,
  and pinned by a RED test before the fix
* **Category:** Correctness / availability

**Description.** `spawn` reports a failure to start asynchronously by emitting
`'error'` on the child. An `EventEmitter` with no `'error'` listener rethrows,
and the daemon registers no `uncaughtException` handler — so the process exits.

**Exploit scenario.** No attacker required. A daemon installed under launchd has
a far thinner `PATH` than the login shell that set `EDITOR`, so `EDITOR=cursor`
resolving in a terminal and not in the service is the ordinary case. The user
clicks "Open in editor"; the route passes every check, spawns, and answers 200;
on the next tick the child emits `ENOENT`; the daemon dies. The client has
already been told it succeeded. Every registered project goes unreachable until
someone restarts it by hand. The verifier named two further triggers on the same
line: `EACCES` on a non-executable `EDITOR`, and `ENOENT` on `cwd` when a
registered root has drifted.

**Resolution.** Fixed on this branch — `child.once('error')`, logging with the
request id and dropping, which is the pattern `workflowHarness.ts:678` already
uses. Variant analysis found no second site: the harness is the only other spawn
and it already handles this.

## Suppressed (below the 8/10 gate — recorded for calibration)

Both verifiers independently rejected these, agreeing with the first pass:

* **Missing `Origin` header passes the guard** (2/10). Byte-identical to the
  reviewed rescan route and behind `bearerAuth`. No browser CSRF path: a
  cross-origin `fetch` always sends `Origin`, and a form POST cannot set
  `Content-Type: application/json`, so `zValidator` refuses it 422.
* **Argument injection via the path** (1/10). The path is always `realpath`
  output, hence absolute, so it cannot be read as a flag; `shell: false` is
  explicit; `EDITOR` is refused rather than split on any whitespace.
* **Unbounded concurrent spawns** — discarded under the DoS rule.
* **Child inherits the daemon's environment** (3/10). The harness uses a fixed
  environment; this does not. An editor needs the user's environment to work,
  and the bearer token lives in `auth.json`, not in `env`. Missing hardening,
  not a vulnerability.
* **Opening the project root bypasses `ALLOWED_SUBDIRS`** (3/10). Deliberate and
  documented. That list bounds what the daemon reads out and hands to a browser;
  this route returns no bytes. The bound here is the registry.
* **The allow-list move weakened enforcement** — rejected outright. Verified
  empirically against planted symlinks (`openspec/link.txt` → outside the repo,
  `openspec/gitlink/config` → `.git`), both still 422. `resolveAllowed` is
  untouched, the daemon remains the sole enforcement point, and the shared
  predicate has exactly one presentational caller.

One low-severity usability finding (9/10) was accepted and fixed: the client
predicate passes directories, so an offered control could fail, and the error
copy guessed a cause it could not know.

## Open tension, recorded not resolved

`filesystem-access-policy` says the daemon guarantees a spawned program's
"resource bounds, and its termination". This route bounds neither — it
detaches and unrefs, because a GUI editor outliving the request is the entire
point of the feature. Bounding a text editor by wall-clock would be incoherent.
The verifier scored this 3/10 as a defect and flagged it as a spec-wording
question instead. It belongs in a spec clarification, not in a code fix.

## Verdict

PASS. One MEDIUM in §7 and one HIGH in §10, both found and fixed on this branch. Nothing in the trust boundary itself
is weak: auth, CORS, the 404 path, and outbound validation are all asserted by
test. §7's finding was a containment regression inside the new cache layer,
fixed by using the primitive the neighbouring module already uses. §10's was an
unhandled spawn error that would have crashed the daemon on an ordinary
misconfiguration, fixed by the listener the other spawn site already attaches.

Two caveats a reader should carry: `REVIEWS.md` predates the editor route
entirely, and the spec's "resource bounds and termination" clause is unmet by
design for a GUI editor — recorded above, not silently satisfied.

---

*This is an AI-assisted scan, not a professional security audit. It catches
common vulnerability patterns; it is not comprehensive and not a substitute for
a qualified security firm on systems handling payments or PII.*
