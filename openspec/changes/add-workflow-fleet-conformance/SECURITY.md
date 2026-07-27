# Security audit — workflow harness runner

Auditor: codex-cso v0.1.0  
Scope: authenticated workflow-harness route, fixed command selection, process
execution, private scratch/result storage, cache reads, and diagnostic output

## STRIDE

| Surface | S | T | R | I | D | E | Mitigation |
|---|---|---|---|---|---|---|---|
| `POST /api/v2/workflow/harness` | Applicable | Applicable | Applicable | Applicable | Applicable | Applicable | Global timing-safe bearer authentication runs before the route; cookie credentials are not accepted; a present origin must match the fixed production/development allow-list before body parsing; the strict request schema accepts only fixed host/harness identifiers. |
| Fixed command selection | N/A | Applicable | N/A | Applicable | Applicable | Applicable | Request values select a daemon-side table only. Program, argv, cwd, and environment come from fixed code. Repository, harness, tested artifact, and reference paths are canonicalised beneath the fixed source-family root. |
| Harness process group | N/A | Applicable | Applicable | Applicable | Applicable | Applicable | The child is spawned without a shell in a detached process group, with a fixed environment and fresh private cwd. Wall time, sampled process-group memory, combined output, scratch disk, per-host concurrency, and global concurrency are bounded; timeout/bound violations kill the group. |
| Result cache and scratch tree | N/A | Applicable | Applicable | Applicable | Applicable | Applicable | Directories are mode `0700`; results are atomically written and re-chmodded to `0600`; scratch children are removed on every exit. Boot rejects an escaping `workflow-harness` tree. Cache reads reject symlinks, non-regular/loose/oversized files, canonical escapes, fingerprint drift, and symbolic identity mismatch. |
| Captured diagnostic output | N/A | Applicable | N/A | Applicable | Applicable | N/A | Capture stops at 1 MiB. Absolute paths, home/user names, bearer/token/secret values, common provider credentials, and JWT-shaped values are redacted before return and persistence, and cached output is redacted again on read. Exit status alone determines pass/fail. |

## OWASP Top 10

| Category | Status | Mitigation |
|---|---|---|
| Broken access control | Applicable — mitigated | Bearer middleware precedes route logic; strict origin check precedes parsing/selection; no cookie path; fixed host/harness enums. |
| Cryptographic failures | Applicable — mitigated | SHA-256 is used only for byte identity/cache integrity, not authentication. Secrets and machine paths are removed from output; private files are mode `0600`. |
| Injection | Applicable — mitigated | `spawn()` uses `shell: false`; argv contains one fixed mapped artifact path; no request string reaches argv, cwd, or environment. |
| Insecure design | Applicable — mitigated | Execution is explicit-only, byte-identity-gated, content-invalidated, resource-bounded, concurrency-bounded, and fail-closed before spawn. |
| Security misconfiguration | Applicable — mitigated | CORS uses explicit origins and `credentials: false`; route adds an actual-origin refusal. Hono was upgraded from 4.12.16 to 4.12.32 for GHSA-88fw-hqm2-52qc. |
| Vulnerable/outdated components | Applicable — follow-up | `pnpm audit --prod --audit-level high` after the Hono upgrade reports 12 pre-existing findings: 4 low, 7 moderate, and 1 critical. The critical path is SPA-only `@tanstack/react-router > @tanstack/router-core > seroval@1.5.2` (GHSA-mv8w-475r-vwqw); no dependency was added by this block and no source calls `seroval.fromJSON()`. Upgrade/override Seroval in separate SPA dependency work. |
| Identification/authentication failures | Applicable — mitigated | Existing timing-safe bearer verification is inherited; empty and cookie-only credentials fail. |
| Software/data integrity failures | Applicable — mitigated | The executable harness must be byte-identical to the core copy before and immediately before spawn. Cache identity covers tested artifact, harness, core reference, runner contract, bounds, and fixed environment version. |
| Security logging/monitoring failures | Applicable — mitigated | Existing request logger records method/path/status with request IDs; completed results carry timestamps and fixed selection IDs. Captured credentials are not logged. |
| Server-side request forgery | Not applicable | The block makes no outbound network request and accepts no URL. |

## Dependency scan

- Tool: `pnpm audit --prod --audit-level high`
- Before mitigation: 27 findings — 5 low, 20 moderate, 1 high, 1 critical.
- In-scope mitigation: upgraded direct daemon dependency Hono
  `4.12.16` → `4.12.32`; the Hono high advisory no longer appears.
- After mitigation: 12 pre-existing findings — 4 low, 7 moderate, 1 critical.
- New dependencies: 0.
- New CVEs introduced by this block: 0.
- Follow-up: patch the SPA's transitive Seroval dependency to `>=1.5.3`;
  the remaining audit command exits non-zero until that separate dependency
  path is upgraded.

## Secret scan

- Scope: `git diff --unified=0 fdc2a55..HEAD`
- Patterns checked: Stripe/OpenAI-style keys, Slack tokens, AWS access keys,
  GitHub tokens, private-key headers, JWT-shaped values, and changed `.env`
  paths.
- Hits: 0.

## Findings resolved during this audit

1. **Cache-result symlink and identity validation.** A planted result-file
   symlink was followed on read, and the payload identity was not checked
   against its fixed cache key. RED: `a9f68e0`; GREEN: `25061a2`.
2. **Affected Hono version.** The direct daemon dependency resolved to 4.12.16,
   below the advisory's patched version. Upgraded to 4.12.32 in `fee9fb8`.

## LLM trust boundary

Not applicable. The route constructs no prompt, invokes no model/tool API, and
renders no model output.

## Database sub-gate

Not triggered. The block touches no SQL, schema, RLS, security-definer function,
or storage policy.

## Verdict

**pass-with-followups**

The harness surface's identified security defects are fixed and covered by
tests. The remaining critical dependency advisory is pre-existing, confined to
the static SPA dependency tree, and not reachable from this daemon runner; it
must remain visible and be patched in separate SPA dependency work.
