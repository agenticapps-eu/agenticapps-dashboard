## Why

A repo can take the whole fleet readiness view offline by naming a file.

The outbound sanitiser that keeps absolute paths off the wire works on rendered
text, where `docs/notes:/Users/x.md` — a perfectly legal repo-relative evidence
path — is indistinguishable from an interpolated absolute path. When a repo's
readiness file cites such a path, the daemon builds a notice naming it, its own
outbound validation refuses its own message, and `GET /api/v2/readiness/fleet`
answers `500 schema_drift`. Every other repo's readiness disappears with it.

This is the failure class the previous change closed for hangs and for citation
blast radius — one repo withholding the fleet — reopened through a different
door. The trigger is author-controlled, needs no file to exist, and needs no
privilege beyond committing a filename.

The sanitiser's own comment bounds its residual risk on the claim that "no
message this daemon constructs interpolates anything but a repo-relative path".
A repo-relative path is precisely what breaks it. The reasoning, not just the
regex, is what this change corrects.

## What Changes

- A legal repo-relative path that a check's evidence cites SHALL reach the
  reader in the check's error text, including when it contains a colon. Today
  such a path is either deleted from the message or fatal to the response.
- No readiness response SHALL fail its own outbound validation because of
  author-controlled text. Where the daemon cannot certify a message it has
  built, it substitutes one it can, and answers. The full path remains in the
  check's summary in every case, so nothing is lost from the surface.
- The repo-level notice raised for unverifiable citations gains the same
  guarantee. It has none today — it is the site that returns 500.
- The residual ambiguity is stated rather than assumed: a colon in the **first**
  path segment (`ab:/Users/x`) remains indistinguishable from a leak and is
  still withheld. It fails soft, not fatal.
- No change to the wire shape, the response contract, or any rendered surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-readiness`: the requirement **"Error text carries no paths or secrets"**
  currently constrains only what must be kept off the wire. It gains the
  converse obligation — that a repo-relative reference MUST survive to the
  reader, and that failing to certify one MUST degrade a single message rather
  than the response carrying it.

## Impact

- `packages/shared` — the readiness schema's absolute-path detector and the
  text it admits; a predicate and a fail-soft constructor exported beside it so
  callers test with exactly what the boundary enforces.
- `packages/agent` — the two readiness sites that build wire text from author
  input: the unverifiable-citation notice and the refused-check error. The
  local colon workaround in `assemble.ts` is retired rather than generalised.
- `/api/v2/readiness/fleet`, `/api/v2/readiness/repos/:id` and its rescan —
  status codes only; no field added, removed, or retyped.
- No SPA change, so the `impeccable:critique` process gate is not engaged.
- Structural carriage of the path — a `path` field beside the message, which
  would remove the residual entirely — is deliberately **not** taken here. It is
  a wire and surface change; this change is confined to stopping the outage.
