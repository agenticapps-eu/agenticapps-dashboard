# Remove the GitNexus and Wiki integrations from the dashboard

## Workflow commitment

This medium change follows the AgenticApps lifecycle: amend and validate the
OpenSpec artifacts, obtain a fresh independent pre-code review, implement with
RED/GREEN tests, run browser QA and verification, obtain an independent code
review, then archive and ship as separate acts. Evidence consists of the review
artifacts, targeted and full test output, desktop and smallest-breakpoint
screenshots, and the QA report.

## Why

GitNexus is being removed from this product. Decided 2026-07-26 (GAP-04).
The compiled Wiki coverage signal is also being removed. Confirmed by human UAT
on 2026-07-28: the column does not answer a useful fleet-health question.

This is a **product decision, not a consequence of the workflow migration.**
Migration `0032` removed GitNexus from the AgenticApps workflow scaffold — the
reindex hook, install scripts, and CLAUDE.md block. The tool itself remains
installed and registered as an MCP server outside the dashboard.

What is going away is the dashboard's surface over GitNexus — scan actions,
health signal, coverage column, and the schemas and UI that carry them — plus
the Wiki scanner, freshness column, `/wiki-compile` clipboard hint, and their
schema and history fields. The fleet should not score or prompt for artifacts
it no longer treats as maintained invariants.

The independent Understand Anything viewer is backed by neither integration. It
reads `.understand-anything/` artifacts and remains untouched.

The Wiki column was never backed by a normative requirement. It appears in the
`fleet-coverage` Purpose prose and entered the live schema, snapshots, and
conformance score through implementation, but no requirement defines its
scanner, freshness semantics, or compile hint. Removing it therefore closes an
unspecified measurement rather than withdrawing a named promise.

Two open GitNexus defects (`family-scan-no-ui-feedback` and
`per-row-scan-repo-not-registered`) were previously staged as
`fix-coverage-scan-open-defects`. That change is withdrawn: the defects die
with the code, and fixing them first would be wasted work.

## What changes

- Delete the GitNexus daemon scan library, routes, and scanner, plus the Wiki
  scanner and clipboard-only refresh hint.
- Remove the code-graph and Wiki columns from the coverage matrix, the
  GitNexus health and refresh fields, their live and history schemas, and every
  SPA surface that renders or triggers them.
- Remove the workflow-update and CLAUDE.md help builders whose only consumer was
  the retired refresh popover; the remaining row actions are review overrides
  and Understand.
- Re-score current and retained historical conformance over the surviving
  measured columns so the cutover cannot manufacture a fleet-health change.
- Remove the vendored `.claude/skills/gitnexus/` from this repo.

The v1 coverage and conformance surfaces remain deployed for now because
`retire-v1-surfaces` is blocked on a replacement agent-change surface. This
change therefore updates snapshot readers, writers, drift responses, and score
functions instead of relying on their deletion.

## Capabilities

- `code-intelligence` — the code-graph half is removed; the knowledge-graph
  viewer half is untouched
- `fleet-coverage` — the matrix and drift history lose two columns
- `fleet-conformance` — live and historical scores use the surviving measured
  columns

## Standalone cutover while v1 remains

The earlier plan coupled GitNexus removal to `retire-v1-surfaces`. That
precondition no longer holds: the agent board was withdrawn while its upstream
viewer moves from agent tasks to OpenSpec changes, so v1 cannot yet retire.
Keeping GitNexus and Wiki visible until that unrelated replacement stabilises
would preserve two measurements the product has already rejected.

This amended change therefore ships independently. Coverage history and
conformance remain, and every point in the retained window is interpreted using
the same post-cutover column set.

## History continuity is part of correctness

Conformance is an equal-weight score across the tracked coverage columns.
Dropping two changes every score. An uncorrected cutover would put a step in the
90-day chart that reads as a change in fleet health but is really a change in
measurement — and if either removed column was mostly red, that step is a
**fake improvement**.

Daily snapshots store every per-column state inline, so old days can be
re-scored while ignoring `gitNexus` and `wiki`. Existing NDJSON files are not
rewritten or deleted; tolerant readers keep accepting the legacy fields and use
only `claudeMd` and `workflowVersion`. A legacy `not-applicable` value in a
retained field normalises to `missing`, and that mapping is included in the
before/after measurement evidence. New records stop writing the removed fields.
Understand Anything is not currently snapshotted or scored and this change does
not add or remove it from either path.

Re-scoring the full retained window prevents a discontinuity at the deployment
date; it does not promise the numeric level or tier distribution will stay the
same. Two equally weighted binary-ish signals quantise scores more sharply than
four. Verification therefore records the before/after score and tier
distribution across the retained window so the intended recalibration is
visible rather than mistaken for a runtime regression.

## Non-goals

- Uninstalling GitNexus or removing its MCP server registration.
- Deleting compiled Wiki artifacts from source families. The dashboard stops
  scanning and prompting for them; it does not mutate another repository.
- Touching the Understand Anything viewer, endpoints, schema, or static assets.
- Removing v1 coverage, history, or conformance surfaces in this change.
- Removing the standalone Wiki compiler install/rollback utilities under
  `.claude/scripts/`; this change removes dashboard scanning and prompting only.

## Compatibility findings

Repository search found no consumer of `/api/gitnexus/scan*` outside the
dashboard daemon, SPA, tests, and historical planning artifacts. Removing the
routes is still a breaking API change: old POST/GET locations return not-found,
and no compatibility payload is retained.

Wiki compilation has no daemon action route; its UI hint is clipboard-only, so
removing it introduces no additional route migration. Scan jobs and locks are
process-local maps; no job state is persisted. During the deployment restart,
active GitNexus child processes are terminated through the existing shutdown
path, in-memory jobs disappear, and later polling of an old job URL returns
not-found.

The live coverage and coverage-history responses do not change atomically with
their SPA consumer: Cloudflare Pages and a separately upgraded local daemon can
remain skewed for days. The current SPA accepts both response schemas at v1 and
v2. It normalises v1 by ignoring `gitNexus`, `wiki`, and the GitNexus install
envelope and by mapping any `not-applicable` value in a retained cell to
`missing`. It preserves Understand when supplied by a later v1 daemon; when an
older v1 daemon does not supply it, the SPA presents `Unavailable from this
daemon` without inventing a freshness state and excludes that presentation from
aggregates and filters. Daemon v2 emits only v2. Deploy the compatible SPA
before the daemon. A pre-update SPA left open against daemon v2 reaches the
product's existing explicit schema-drift state and recovers by reloading the
current static build.

Both pre-change responses already carry literal `schemaVersion: 1` in their
deployed shared schemas. The v1 compatibility tests use payloads captured from
the running pre-change daemon, not fixtures reconstructed from this proposal.
The compatibility parser validates the version, envelope identity, and retained
cells; discarded GitNexus/Wiki fields are tolerated rather than made a new
reason to reject an otherwise usable old-daemon payload.

The GitNexus health field is not part of `daemon-runtime`'s ratified `/health`
shape (`{ ok, daemonVersion, registryCount, paired }`), so removing the
implementation-only extension restores rather than changes that capability
contract. During the SPA-first skew window, the current SPA tolerates and
ignores an old daemon's additional `gitnexus` health key. Likewise,
`filesystem-access-policy` names the dedicated scanner boundary, not
`.wiki-compiler.json` or `.knowledge/wiki`; deleting those reads narrows the
implementation within the existing boundary and requires no policy delta.

On-disk snapshots remain backward-readable data, not a mixed public wire
contract.

The in-product help capability has no requirement change, but authored help
content is swept in the same implementation so it does not teach the removed
columns, scan flow, install hint, or compile hint.
