# ADR 0001: Coverage v2 history compatibility

**Status:** Accepted
**Date:** 2026-07-28

## Context

Removing the dashboard's GitNexus and Wiki integrations changes the live
coverage row, per-cell history response, snapshot writer, and conformance
measurement set. A direct shape change would either break a current SPA paired
with a still-running version-1 daemon or create a false improvement in the
historical conformance chart on the deployment date.

The retained NDJSON window can also contain the version-1
`not-applicable` value. That value described optional integration state, but it
is not part of the current three-state coverage vocabulary.

## Decision

The daemon emits strict schema version 2 for live coverage and coverage history.
The current SPA accepts both deployed version-1 responses and strict version-2
responses. Its version-1 compatibility parsers validate the envelope and
retained cells, discard retired integration data, preserve Understand Anything
when supplied, and present it as unavailable—not missing—when an older daemon
does not supply it.

New snapshots contain exactly `claudeMd` and `workflowVersion`. Existing
snapshots are retained byte-for-byte. Readers ignore retired fields and
normalise `not-applicable` to `missing` only when it appears in a retained cell.

Every day in the retained conformance window is re-scored at read time using the
same two fields, including days written before deployment. Understand Anything
is excluded from conformance because it was never recorded in the historical
snapshot set.

A version-1 SPA receiving a version-2 response follows the existing explicit
schema-drift recovery path; the daemon does not emit a hybrid response.

## Consequences

- Deploying the SPA before the daemon remains safe.
- Deploying the daemon before the SPA produces a visible reload/recovery state,
  not partially rendered data.
- The deployment date does not introduce a measurement-set discontinuity.
- Legacy snapshot files remain recoverable and auditable.
- A retained legacy neutral value becomes a current missing value, so historical
  scores and drift indicators may change where that value occurred; this is
  recorded separately from the effect of removing columns.
- A future change to the measured fields requires another schema version and an
  explicit history decision.

## References

- `openspec/changes/remove-gitnexus-integration/`
- `openspec/specs/fleet-coverage/spec.md`
- `openspec/specs/fleet-conformance/spec.md`
