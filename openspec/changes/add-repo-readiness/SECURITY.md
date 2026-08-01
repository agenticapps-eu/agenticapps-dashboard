---
verdict: PASS
---

# Security review — `add-repo-readiness` section 7 (daemon endpoints)

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
| Authenticated endpoints | 3 | `GET /api/v2/fleet`, `GET /api/v2/repos/:id`, `POST /api/v2/repos/:id/rescan` |
| State-changing endpoints | 1 | the rescan POST; discards a memo entry, writes nothing to disk |
| New filesystem reads | 2 | the readiness file and each machine-global `SKILL.md`, for cache keying |
| New execution paths | 0 | reuses `getOpenspecBinary()`'s resolve-once accessor and `runGit`'s argv-array execa |
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

## Verdict

PASS with one MEDIUM to fix before merge. Nothing in the trust boundary itself
is weak: auth, CORS, the 404 path, and outbound validation are all asserted by
test. The one real finding is a containment regression inside the new cache
layer, and it is fixed by using the primitive the neighbouring module already
uses.

---

*This is an AI-assisted scan, not a professional security audit. It catches
common vulnerability patterns; it is not comprehensive and not a substitute for
a qualified security firm on systems handling payments or PII.*
