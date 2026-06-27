# Phase 8: Optional Integration Panels - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 8-Optional Integration Panels
**Areas discussed:** Sentry data panel, Linear issue panel, Outbound HTTP posture, env.json + `env set`

> Pre-flight note: `init.phase-op 8` / `roadmap.get-phase 8` returned `malformed_roadmap` — Phase 8 was in the v1.2 summary checklist but had no `### Phase 8:` detail section, which the GSD parser requires for a phase with no directory yet. Added a `#### Phase 8: Optional Integration Panels` detail block (Goal + Success Criteria, grounded in the existing checklist + spec) to `.planning/ROADMAP.md` so the phase resolves. Structural fix only — no scope change.

---

## Sentry data panel

| Question | Options | Selected |
|----------|---------|----------|
| Resolve which Sentry org/project | Auto from DSN/config · Explicit slug in registry · You decide | Auto from DSN/config ✓ |
| Panel shape / count | Compact 5 (title+level+count+age) · Minimal 3 (title+age) · You decide | Compact 5 ✓ |
| Placement + link-out | New panel + link out · Extend ObservabilityHealth · You decide | New panel + link out ✓ |

**User's choice:** Auto-resolve target from DSN/config; compact top-5 (title/level/count/last-seen); new standalone panel; errors link out to Sentry.
**Notes:** Existing `integrations.ts` already detects DSN/`.sentriclirc`. Keep status (health) separate from data (panel).

---

## Linear issue panel

| Question | Options | Selected |
|----------|---------|----------|
| Which issues to surface | Branch + recent commits · Current branch only · You decide | Branch + recent commits ✓ |
| Fetch timing | Auto-fetch (60s cache) · On-demand (click) · You decide | Auto-fetch (60s cache) ✓ |
| Placement + cap | New panel, cap 3 · Enrich header link · You decide | New panel, cap 3 ✓ |

**User's choice:** Detect IDs from branch + recent commits (deduped); auto-fetch title/status/assignee cached 60s; new panel capped at 3.
**Notes:** The pre-existing static `Linear: ACME-123` header link stays API-free (LINEAR-02) — kept distinct from the new API-backed panel.

---

## Outbound HTTP posture

| Question | Options | Selected |
|----------|---------|----------|
| Timeout / retry | Short timeout, no retry · Timeout + 1 backoff retry · You decide | Short timeout, no retry ✓ |
| Stale-cache on failure | Serve last-good, label age · TTL-only, empty on fail · You decide | Serve last-good, label age ✓ |
| Privacy framing | Document as explicit exception · Treat as ordinary client · You decide | Document as explicit exception ✓ |
| Upstream error surfacing | Sanitize to fixed categories · Forward upstream messages · You decide | Sanitize to fixed categories ✓ |

**User's choice:** ~5s timeout, no retry; serve last-good with age label; document the outbound-data exception in the threat model; sanitize errors to fixed categories.
**Notes:** This is the daemon's first external network surface. Only the user's own token + issue/project IDs leave the machine — never file contents. Tokens redacted to daemon logs only (INV-05).

---

## env.json + `env set`

| Question | Options | Selected |
|----------|---------|----------|
| Precedence | process.env wins · env.json wins · You decide | process.env wins ✓ |
| Key policy | Allow-list only · Arbitrary keys · You decide | Allow-list only ✓ |
| Redaction | Redact (key + set/unset) · Show full values · You decide | Redact ✓ |
| Apply timing | On next daemon start · Hot-reload · You decide | On next daemon start ✓ |

**User's choice:** process.env wins / env.json fills gaps; allow-list of integration tokens only; redacted status output; load env.json on next daemon start.
**Notes:** process.env-wins is mandatory for INFI-01 (`infisical run` injects into process.env and must stay authoritative). env.json mirrors the auth.json 0600 file-read model.

---

## Claude's Discretion

No "you decide" selections — the user chose explicitly in all 14 questions. Remaining latitude is implementation-level only: Sentry DSN→slug resolution mechanism, shared Zod schema shapes, `/help` setup-guide copy, and how the Infisical `scope` field is populated (all noted in CONTEXT.md `<decisions>` → Claude's Discretion).

## Deferred Ideas

- Hot-reload of env values into a running daemon (deferred in favor of load-on-next-start).
- Arbitrary-key env store (rejected for allow-list; general secret storage belongs in secrets-platform).
- Forwarding rich upstream error diagnostics to the SPA (rejected for token/PII safety).
- Full Infisical secrets-management UI (out of scope; lives in `agenticapps-eu/secrets-platform`).
