---
phase: 08-optional-integration-panels
audited_at: 2026-06-11
auditor: gsd-security-auditor (claude-sonnet-4-6)
asvs_level: 1
block_on: high
threats_total: 28
threats_closed: 28
threats_open: 0
unregistered_flags: 0
verdict: SECURED
---

# Security Audit — Phase 8: Optional Integration Panels

**Phase:** 08 — Optional Integration Panels
**Threats Closed:** 28/28
**ASVS Level:** 1
**Verdict:** SECURED

---

## Threat Verification

### MITIGATE Threats — Code Evidence Required

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-08-01 | Information Disclosure | mitigate | CLOSED | `packages/shared/src/index.ts:128-129` — explicit comment: "env.ts (EnvFileSchema) is intentionally NOT re-exported here (T-08-01/INV-05/D-08-13)". Grep for `schemas/env` in index.ts returns 0 matches. env.ts is accessible daemon-only via the `daemon.ts` subpath barrel. |
| T-08-02 | Tampering | mitigate | CLOSED | `packages/shared/src/schemas/env.ts:14` — `AllowedEnvKeySchema = z.enum(ALLOWED_ENV_KEYS)` where `ALLOWED_ENV_KEYS = ['SENTRY_AUTH_TOKEN','LINEAR_API_KEY','INFISICAL_TOKEN'] as const`. The `z.record(AllowedEnvKeySchema, z.string())` at line 24 rejects any key not in the enum at parse time. |
| T-08-04 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/lib/outboundFetch.ts:101-116` — `classifyError` returns exactly one of `'unreachable' \| 'unauthorized' \| 'rate-limited'`. No raw body is returned by the helper; callers receive only the classified category. Both routes pass only `category` to error responses. |
| T-08-05 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/routes/sentry.ts:425` — `agentError(\`...status=${status ?? 'n/a'} category=${category}\`)` — no token interpolation. `packages/agent/src/routes/linear.ts:286-288` — identical pattern with `issueId` + `status` + `category` only. Neither `token` nor `apiKey` variable appears in any `agentError`/`agentLog` call. |
| T-08-06 | Tampering | mitigate | CLOSED | `packages/agent/src/lib/envFile.ts:23` — imports `assertSecurePermissions` from `auth.ts`. Called at `envFile.ts:45` in `loadEnvFile` before any `readFileSync`, and at `envFile.ts:93` in `readEnvFile`. `assertSecurePermissions` uses `lstatSync` internally (symlink rejection). |
| T-08-07 | Tampering | mitigate | CLOSED | `packages/agent/src/lib/envFile.ts:75` — `atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)`. `atomicWriteFile` uses tmp+rename with `O_EXCL\|O_NOFOLLOW`. Mode `0o600` passed explicitly. |
| T-08-08 | Denial of Service | mitigate | CLOSED | `packages/agent/src/lib/envFile.ts:48` — `parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')` throws `StateCorruptionError` on schema mismatch. The caller (`start.ts:51-57`) wraps `loadEnvFile()` in `try/catch` and logs then continues, so corrupt env.json never blocks daemon boot. |
| T-08-09 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/routes/sentry.ts:418-447` — token variable is not present in any `c.json(...)` call. Error responses use only `category` (a fixed string). The stale path at lines 429-440 serializes `prev.lastGood.value` (issue fields only) plus `staleReason: category`. The S-07 test asserts the token string never appears in any response body. |
| T-08-10 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/routes/sentry.ts:424-425` — `agentError` logs `requestId`, `status`, and `category` only. The `token` variable declared at line 290 is never passed to `agentError`. |
| T-08-11 | Spoofing/SSRF | mitigate | CLOSED | `packages/agent/src/routes/sentry.ts:65` — `const SENTRY_API = 'https://sentry.io/api/0'` (module-level constant). URL is built at lines 349-351 by interpolating only `slugs.orgSlug` (daemon-resolved from .sentryclirc or API) and `slugs.numericProjectId` (parsed integer, daemon-derived). No user-supplied URL component. |
| T-08-12 | Elevation of Privilege | mitigate | CLOSED | `packages/agent/src/routes/sentry.ts:58-59` — `issuesCache` and `slugCache` are both `Map<string, ...>` keyed by `projectId`. `projectId` is bound to a registry entry via `readRegistry().find(p => p.id === projectId)` at lines 299-305. Cross-project isolation holds. |
| T-08-14 | Tampering | mitigate | CLOSED | `packages/agent/src/cli/envCmd.ts:39-44` — `AllowedEnvKeySchema.safeParse(key)` on entry; on failure `agentError(\`unknown env key: ${key}. Allowed: ${ALLOWED_ENV_KEYS.join(', ')}\`)` + `process.exit(1)`. Same guard at line 81 in `runEnvUnset`. |
| T-08-15 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/cli/envCmd.ts:135-143` — masking logic: `const tail = value.length > 8 ? value.slice(-4) : ''` then `masked = '****' + tail`. The full value is only ever passed to `tail` calculation; `agentLog` at line 148 outputs only `masked`. The WR-04 fix ensures values ≤8 chars show `****` with no tail. |
| T-08-17 | Denial of Service | mitigate | CLOSED | `packages/agent/src/cli/start.ts:51-57` — `try { loadEnvFile() } catch (e) { agentError(\`env.json corrupt ...\`) /* daemon continues */ }`. The `catch` block does not call `process.exit`, so boot proceeds regardless of env.json corruption. |
| T-08-18 | Tampering | mitigate | CLOSED | Same evidence as T-08-07 (writeEnvFile atomicWriteFile at 0o600) and T-08-06 (assertSecurePermissions on read). Both paths covered in a single `writeEnvFile` / `loadEnvFile` / `readEnvFile` implementation. |
| T-08-19 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/routes/linear.ts:209-337` — `apiKey` variable declared at line 213 is used only in `fetchLinearIssue` as `Authorization: apiKey`. Error responses at lines 311-314 and the stale path use only `overallStaleReason` (a category string). The L-10 test asserts the key string never appears in any response body. |
| T-08-20 | Information Disclosure | mitigate | CLOSED | `packages/agent/src/routes/linear.ts:286-288` — `agentError(\`...issueId=${issueId} status=${status ?? 'n/a'} category=${category}\`)`. The `apiKey` variable is never passed to `agentError`. |
| T-08-21 | Spoofing/SSRF | mitigate | CLOSED | `packages/agent/src/routes/linear.ts:52` — `const LINEAR_API = 'https://api.linear.app/graphql'` (module-level constant). The GraphQL call at line 156 targets `LINEAR_API` directly. The issue identifier is interpolated only into the GraphQL `variables` payload (line 164-166), never into the URL. |
| T-08-22 | Elevation of Privilege | mitigate | CLOSED | `packages/agent/src/routes/linear.ts:254` — `const cacheKey = \`${projectId}:${issueId}\``. `projectId` is validated against the registry via `readRegistry().find(p.id === projectId)` at lines 223-229. Same issueId under different projectIds produces different cache keys. |
| T-08-24 | Tampering | mitigate | CLOSED | `packages/spa/src/components/panels/SentryPanel.tsx:88-99` — configure copy is a JSX string literal `"Set SENTRY_AUTH_TOKEN to enable..."`. No `{data.*}` interpolation. Identical pattern in `LinearPanel.tsx:87-98` for `LINEAR_API_KEY`. |
| T-08-26 | Cross-site (link-out) | mitigate | CLOSED | `packages/spa/src/components/panels/SentryPanel.tsx:128` — `rel="noopener noreferrer"` on the permalink anchor. `packages/spa/src/components/panels/LinearPanel.tsx:122` — identical on the url anchor. Additionally, both panels include a CR-01 defense-in-depth render guard: `{/^https?:/i.test(issue.permalink) ? <a ...> : <span>}` (SentryPanel.tsx:124; LinearPanel.tsx:118). Schema-level `HttpUrl` refine in `shared/src/schemas/sentry.ts:8-11` and `linear.ts:8-11` also constrains to http(s). |
| T-08-27 | Schema drift | mitigate | CLOSED | `packages/spa/src/lib/projectQueries.ts:298` — `if (!result.ok) throw new Error(\`schema_drift:${result.drift.path}\`)` in `useSentryRecent`. Line 321 — identical in `useLinearIssues`. Both panels check `query.error?.message?.startsWith('schema_drift:')` at SentryPanel.tsx:54 and LinearPanel.tsx:53, rendering `InlineDrift` on match. |
| T-08-28 | Tampering/data boundary | mitigate | CLOSED | `packages/spa/src/components/panels/IntegrationsHealth.tsx` — grep for `useLinearIssues\|linear/issues` returns 0. `packages/spa/src/components/SingleProjectView.tsx:78-80` — `<IntegrationsHealth>` rendered alongside `<SentryPanel>` and `<LinearPanel>`; IntegrationsHealth is not modified. |

### ACCEPT Threats — Rationale Confirmation

| Threat ID | Category | Disposition | Status | Rationale |
|-----------|----------|-------------|--------|-----------|
| T-08-03 | Information Disclosure | accept | CLOSED | `workspaceId` and `defaultEnvironment` from `.infisical.json` are project-configuration identifiers (workspace slug, environment name), not secret values. Rendered read-only. Confirmed by `integrations.ts:97-104` where only these two fields are spread, not the token or any credential. Research Finding 8 documents the non-sensitive classification. |
| T-08-13 | Information Disclosure | accept | CLOSED | D-08-10 carve-out: outbound Sentry call is opt-in via `SENTRY_AUTH_TOKEN`. The payload is the user's own token sent to their own Sentry organization's API. No project file contents cross the boundary. `sentry.ts:354-356` confirms the request body is only the URL + Bearer header. |
| T-08-16 | Information Disclosure | accept | CLOSED | Same rationale as T-08-03. The `infisicalWorkspaceId` and `infisicalEnvironment` fields in the IntegrationsResponse are non-secret config identifiers. They are optional and backward-compatible. |
| T-08-23 | Information Disclosure | accept | CLOSED | D-08-10 carve-out: outbound Linear call is opt-in via `LINEAR_API_KEY`. Payload is the user's own API key + a human-readable issue identifier sent to the Linear GraphQL API. No project file contents cross. `linear.ts:156-167` confirms body is only the GraphQL query + variables. |
| T-08-25 | Information Disclosure | accept | CLOSED | Rendered issue fields (title, level, count, url, state, assignee) are non-secret metadata. Daemon strips all tokens before assembly (`sentry.ts:388-402`, `linear.ts:193-202`). React auto-escapes text nodes. |
| T-08-SC (x6) | Tampering | accept | CLOSED | Phase 8 introduces zero new npm packages. `outboundFetch.ts` uses Node 22 global `fetch` and `AbortController` with no import statement. `packages/agent/package.json` is unchanged. Confirmed by REVIEW.md "No native deps" finding and VERIFICATION.md INV-02 evidence. |

---

## Unregistered Threat Flags

None. The SUMMARY.md `## Threat Flags` sections across all six plans map entirely to the threat register above. No new attack surface appeared during implementation that lacks a threat mapping.

---

## Accepted Risks Log

The following risks are accepted per plan-time decisions. No code control is required.

| Risk ID | Rationale | Decision Reference |
|---------|-----------|--------------------|
| T-08-03 / T-08-16 | Infisical workspaceId + defaultEnvironment are project-config identifiers, not secrets. Rendered read-only. | D-08-10, Research Finding 8 |
| T-08-13 | Sentry outbound is user-opt-in; payload is the user's own token to their own Sentry API. | D-08-10 |
| T-08-23 | Linear outbound is user-opt-in; payload is the user's own key to their own Linear API. | D-08-10 |
| T-08-25 | Issue metadata (title/level/count/url/state/assignee) is non-secret. Tokens never reach panels. | T-08-09, T-08-19 (mitigated upstream) |
| T-08-SC | Zero new npm packages in Phase 8; Node 22 built-ins used for fetch/AbortController. | 08-RESEARCH §"Package Legitimacy Audit" |

---

## Notes on CR-01 (XSS-class URL injection — found post-plan, fixed pre-ship)

CR-01 was identified during the code review pass (08-REVIEW.md) and fixed before verification. It strengthens T-08-26 by adding two independent guards:

1. **Schema level** (`sentry.ts:8-11`, `linear.ts:8-11`): `HttpUrl` refine `(u) => /^https?:\/\//i.test(u)` — `javascript:` and `data:` schemes fail parse and surface as schema-drift rather than live links.
2. **Render level** (`SentryPanel.tsx:124`, `LinearPanel.tsx:118`): defense-in-depth check `{/^https?:/i.test(url) ? <a> : <span>}` — a bypassed-schema scenario degrades to plain text rather than an executable href.

Both guards are verified present in implementation. T-08-26 is CLOSED with defense-in-depth.

---

## Outstanding Items (Non-Security Gaps)

These items were identified by the verifier but are not security blockers. They do not affect the threat register verdict.

1. **TypeCheck failure** (`cliLockTimeout.test.ts` lines 150-161, 178): WR-05 test mock objects missing `version: 1 as const`. Breaks `pnpm -r typecheck`. Fixed in commit `64922db` per git log. Confirm `pnpm -r typecheck` clean before phase close.

2. **08-IMPECCABLE.md missing**: CLAUDE.md mandates a composite >= 80 impeccable critique artifact for every frontend-touching phase. This is a UX gate, not a security gate. Must be completed before phase sign-off.

---

_Audited: 2026-06-11_
_Auditor: gsd-security-auditor (claude-sonnet-4-6)_
_ASVS Level: 1 | block_on: high_
