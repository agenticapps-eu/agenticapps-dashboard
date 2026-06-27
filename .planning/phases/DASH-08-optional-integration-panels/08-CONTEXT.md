# Phase 8: Optional Integration Panels - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add read-only **Sentry** and **Linear** live-data panels plus the **Infisical-aware env plumbing** to the dashboard. Every integration is env-gated and degrades to a "configure to enable" empty state when its env vars are unset — the dashboard stays 100% functional without any of them.

**This phase delivers (HOW for the locked WHAT in REQUIREMENTS.md):**
- `GET /api/projects/{id}/sentry/recent` — env-gated, cached, returns recent errors (SENTRY-01..03)
- `GET /api/projects/{id}/linear/issue/{issueId}` — env-gated, cached, returns issue title/status/assignee (LINEAR-01..03)
- `agentic-dashboard env set` + `~/.agenticapps/dashboard/env.json` (mode `0600`) for non-Infisical users; `infisical run` awareness with no code change (INFI-01/02)
- Read-only Infisical **status reflection** (scope) folded into the existing IntegrationsHealth surface (INFI-03)
- SPA panels for Sentry + Linear with empty states + cached-data fallback
- Shared Zod schemas for every new wire shape (INV-04)

**This phase does NOT:**
- Rebuild integration *status detection* — `GET /api/projects/{id}/integrations` and the `IntegrationsHealth`/`ObservabilityHealth`/`SecretsHealth` panels already exist (Phase 5, D-5-19).
- Reimplement Sentry/Linear/Infisical — links out when configured; never a replacement.
- Build any secrets-management UI — secrets infra lives in `agenticapps-eu/secrets-platform`; the dashboard only *reflects* status.

</domain>

<decisions>
## Implementation Decisions

### Sentry data panel
- **D-08-01:** Resolve the target Sentry org/project **automatically** from the project's detected DSN / `.sentryclirc` (the existing `integrations.ts` already reads these), querying with the daemon's `SENTRY_AUTH_TOKEN`. Explicit per-project slug is a fallback only if DSN→slug resolution proves unreliable — researcher decides the resolution mechanism (likely list-projects-via-token and match by project ID).
- **D-08-02:** Panel shows a **compact top-5** of recent unresolved issues: title, level badge, event count, last-seen relative time.
- **D-08-03:** Render as a **new standalone panel** in the single-project view (alongside Observability/Integrations health), keeping "is it configured" (health) separate from "what are the errors" (data).
- **D-08-04:** Each error **links out** to its Sentry issue URL (spec §"links out to those when configured", line 17). Link only — no embedded data beyond the API response fields.

### Linear data panel
- **D-08-05:** Surface issues detected from **the current branch name AND recent commit messages** (deduped), via the existing `[A-Z]{2,}-\d+` regex. Capped (see D-08-07) to handle noisy repos.
- **D-08-06:** **Auto-fetch** title/status/assignee for detected IDs, cached ~60s (LINEAR-01 + the skills-route TTL pattern). The pre-existing static `Linear: ACME-123` header link stays **API-free** per LINEAR-02 — only the new panel makes API calls.
- **D-08-07:** Render as a **new standalone panel** in the single-project view, capped at **3** detected issues (title/status/assignee). Spec calls the full Linear panel "a separate optional integration" (line 478) — keep it separate from the header link.

### Outbound HTTP posture (daemon's first external calls)
- **D-08-08:** **~5s timeout, no retry.** On any failure, fall through to cached/empty state; never block or crash the daemon (SENTRY-02 "never crashes"). Researcher may add a single retry only if Sentry/Linear rate behavior demands it.
- **D-08-09:** On API failure, **serve the last successful response from memory** labeled "using cached data from {time}" (SENTRY-02 verbatim). A transient outage never blanks the panel. Implies retaining a last-good value beyond the 60s refresh TTL.
- **D-08-10:** **Document the data-boundary exception explicitly in the phase threat model.** These are the ONLY outbound calls in the product; they carry just the user's own token + issue/project IDs to Sentry/Linear's own APIs — never project file contents — and are opt-in via env var. Makes the carve-out from the "no data leaves the machine" ethos auditable.
- **D-08-11:** **Sanitize upstream errors to fixed categories** (`unreachable` / `unauthorized` / `rate-limited`) before they reach the SPA. Raw upstream error bodies stay in daemon logs only, with tokens redacted. Prevents token/PII leakage (INV-05) and preserves T-05-05 static-copy trust.

### env.json + `env set` CLI
- **D-08-12:** **`process.env` wins; env.json only fills gaps** (supplies a value when the matching `process.env` var is unset). This is mandatory for INFI-01 — `infisical run` injects into `process.env`, so it must remain authoritative with zero code change. env.json is purely the no-Infisical fallback (INFI-02).
- **D-08-13:** `env set` accepts an **allow-list only** — the known integration vars (`SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, and the Infisical token key); unknown keys are rejected with a clear error. Keeps env.json from becoming a general secret dump ("deliberately minimal, not a secrets manager", INFI-03).
- **D-08-14:** `env list`/status output is **redacted** — shows key + set/unset + source (env.json vs process.env), never the value (masked last-4 at most). Honors INV-05 (no token logged/printed).
- **D-08-15:** env.json is **loaded at daemon boot** (mirrors `auth.json`), merged *under* `process.env`. A running daemon keeps its env until restart; `env set` prints a "restart to apply" hint. No live-mutation race windows.

### Claude's Discretion
All four areas were decided by the user (no "you decide" selections). Remaining latitude is implementation-level only:
- Exact Sentry DSN→slug resolution mechanism (D-08-01).
- Shared Zod schema shape for the new `sentry/recent` and `linear/issue` payloads — must follow the established `packages/shared/src/schemas/*.ts` one-file-per-domain + dual export pattern (INV-04).
- `/help` setup-guide copy for each integration (SENTRY-03 / LINEAR-03 link target).
- How the Infisical `scope` field (INFI-03) is populated from `.infisical.json` — keep it read-only, no privileged calls.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements (read first)
- `.planning/REQUIREMENTS.md` §"v1.2 Requirements" — SENTRY-01..03, LINEAR-01..03, INFI-01..03, and cross-cutting INV-01..05. **This is the WHAT lock for Phase 8** — requirements are not duplicated into the decisions above.
- `.planning/ROADMAP.md` §"Phase 8: Optional Integration Panels" — phase goal + success criteria.

### Binding spec
- `docs/spec/dashboard-prompt.md` §"Optional integrations: the contract" (lines 508–544) — the configure/unconfigured/configured rule for all three; env var names; setup snippets.
- `docs/spec/dashboard-prompt.md` §"Optional integration routes" (lines 354–369) — `sentry/recent` (60s cache, 404 when unset) and `linear/issue/{issueId}` route contracts.
- `docs/spec/dashboard-prompt.md` lines 347–351 — `/api/projects/{id}/integrations` status shape (already implemented).
- `docs/spec/dashboard-prompt.md` lines 474–478 — the static `Linear: ACME-123` header link (API-free, distinct from the new panel).

### Hard constraints
- `CLAUDE.md` §"Hard architectural constraints" — read-only FS, path allow-list, no native deps, `0600` secrets, optional-stays-optional, no CF Workers, IMPECCABLE composite floor ≥ 80.
- `.planning/REQUIREMENTS.md` §"Out of Scope" / "Deferred" — no cloud storage, no native deps, no secrets-manager UI.

### Cross-repo context (read-only)
- `agenticapps-eu/secrets-platform` (separate repo) — the Infisical/cparx pilot that INFI-03 *reflects*. The dashboard makes **no** privileged Infisical calls and stores no secrets. See memory `project_secrets_platform_separate_from_dashboard`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/agent/src/routes/integrations.ts:34-107` — existing `GET /api/projects/:id/integrations`; 3-state detection (D-5-19) for Sentry/Linear/Infisical incl. env var names (`SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, `INFISICAL_TOKEN`/`INFISICAL_API_TOKEN`), DSN/`.sentryclirc`/`.infisical.json` signal detection, branch regex `[A-Z]{2,}-\d+`, and a per-projectId inline-Map cache. **Extend its detection for slug/scope resolution; do NOT rebuild.**
- `packages/agent/src/routes/read.ts:25-129` — canonical per-project route handler shape (`:id/<verb>`) with path allow-list; closest analog for the new `sentry/recent` + `linear/issue/:issueId` routes.
- `packages/agent/src/lib/auth.ts:67-88,124-141,148-174` — `auth.json` 0600 model: `ensureAuthFile` (dir 0700 / file 0600), `assertSecurePermissions` (lstat, reject symlink), `atomicWriteFile`, D-15 write-file-then-flip-ref. **The precedent for the new env.json store.**
- `packages/agent/src/lib/constants.ts:9-10` — `CONFIG_DIR = ~/.agenticapps/dashboard`, `AUTH_FILE`. Add `ENV_FILE = <CONFIG_DIR>/env.json` here.
- `packages/agent/src/server/middleware/errors.ts:22-37` — `outbound()` D-16 schema-drift defense for route responses. Wrap new route payloads with it.
- `packages/spa/src/lib/api.ts:68-122` — `apiFetch` bearer-token wrapper + `parseOrDrift` → `schema_drift:<path>`. Use for the new panels' fetches.
- `packages/spa/src/lib/projectQueries.ts:267-280` — `useIntegrations` TanStack Query hook pattern (queryKey `['x', id]`, `staleTime`/`refetchInterval`, `enabled: id !== null`). Model the new `useSentryRecent` / `useLinearIssues` hooks on it.
- `packages/spa/src/components/panels/PanelContainer.tsx` — shared section wrapper (`defaultCollapsed`, `unreachable`, stale props). Reuse for the two new panels + their empty states.
- `packages/spa/src/components/panels/IntegrationsHealth.tsx`, `ObservabilityHealth.tsx`, `SecretsHealth.tsx` — existing status panels; INFI-03 "scope" reflection folds into IntegrationsHealth.

### Established Patterns
- **Cache:** inline `Map<string, {value, cachedAtMs}>` + timestamp check. 5s on integrations, **60s on the skills route (`projectQueries.ts`, `SKILLS_TTL_MS = 60_000`)** — copy the 60s variant for SENTRY-02/LINEAR-01. Add last-good retention for D-08-09.
- **Shared schema:** `packages/shared/src/schemas/<domain>.ts` exports `XSchema` + `type X`, re-exported from `src/index.ts`; both daemon and SPA import the same symbol (INV-04). Add `sentry.ts` + `linear.ts` (and extend `integrations.ts` for scope).
- **Empty-state copy is a JSX literal** — no daemon content interpolation in "configure to enable" copy (T-05-05-Static-Copy-Trust). The integration *data* (error titles, issue titles) is daemon-supplied and React-escaped — keep the trust-sensitive configure copy static.
- **Route mounting:** `packages/agent/src/server/app.ts:174-197` — `app.route(path, hono)`; bearer auth middleware at 161-172.

### Integration Points
- **New outbound surface:** `packages/agent` currently makes **zero** external HTTP calls — only internal daemon calls + `execa` for git. Sentry/Linear use Node's built-in `fetch` (Node 18+, no new dep — satisfies INV-02). This is the first remote-service surface; gate behind D-08-08..11.
- **env.json load:** wire env.json read into daemon boot (`boot.ts` / startup), merged under `process.env` (D-08-12/15). New CLI subcommand alongside existing `cli/` commands (`rotate-token`, `pair`, etc.).

</code_context>

<specifics>
## Specific Ideas

- Reuse the exact SENTRY-02 fallback string: **"Sentry API unreachable — using cached data from {time}"** (and a Linear equivalent).
- Keep the Infisical surface **deliberately minimal** — a status reflection, never a secrets manager (INFI-03). Don't over-build now that secrets-platform is unblocked.
- The static `Linear: ACME-123` header link and the new API-backed Linear panel are two distinct things — don't merge them (LINEAR-02 keeps the link API-free).

</specifics>

<deferred>
## Deferred Ideas

- **Hot-reload of env values into a running daemon** — considered for `env set` (D-08-15); deferred in favor of load-on-next-start. Revisit only if restart friction becomes a real complaint.
- **Arbitrary-key env store** — rejected in favor of an allow-list (D-08-13). A general secrets store belongs in `secrets-platform`, not the dashboard.
- **Forwarding rich upstream error diagnostics to the SPA** — rejected (D-08-11) for token/PII safety; raw errors stay in daemon logs.
- **Full Infisical secrets-management UI** — explicitly out of scope (REQUIREMENTS.md "Deferred"); lives in `agenticapps-eu/secrets-platform`.

None of the above are scope creep into this phase — they are conscious "not now" calls.

</deferred>

---

*Phase: 8-Optional Integration Panels*
*Context gathered: 2026-06-11*
