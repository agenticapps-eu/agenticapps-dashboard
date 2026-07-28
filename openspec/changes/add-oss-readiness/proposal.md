# Open-source readiness

## Why

The dashboard has shipped v1.0, v1.1, and v1.2 as a private repo. The v1.3
milestone in the legacy roadmap is the one remaining unstarted item: make the
repo publishable. The original spec deferred this deliberately — "private until
phase 6 ships and looks good, then flip" — and phase 6 shipped in May 2026.

Four things are missing: a licence, contributor guidance and community norms,
publication hygiene, and a decision about whether the deployed dashboard drops
its access policy to become publicly reachable. The first three are
prerequisites for the fourth.

Carried forward from `docs/legacy-planning/ROADMAP.md` (v1.3, requirements
OSS-01..03) and `docs/legacy-planning/milestones/v1.2-REQUIREMENTS.md`
("Deferred — belongs to v1.3").

## What changes

- Add an MIT `LICENSE` at the repo root. MIT was the recommendation in the
  original spec's open questions, to match the surrounding skill ecosystem.
- Add `CONTRIBUTING.md` covering development setup, the two-stage review
  expectation and security spine, plus a PR template, `CODE_OF_CONDUCT.md`, and
  `SECURITY.md` with a private reporting channel.
- Audit dependencies, vendored content, source notices, the current tree, and
  every git object the publication host can expose before anything becomes
  public. Retain required third-party notices and audit public-fork workflows.
- Publish the source. The **deployment keeps its access policy** — decided
  2026-07-26.

## Capabilities

- `open-source-readiness` (new)

## Sequence: this change waits for the v2 cutover

Scheduled after Dashboard v2. Linear: AGE-482, and the *Sequence* section of
`openspec/CAPABILITY-MAP.md`.

Publishing today would publish 145 SPA source files, most of which
`retire-v1-surfaces` deletes within the same milestone. Anyone finding the repo
in the weeks after would read a codebase that is largely about to disappear, and
the contributor guidance would describe a structure that no longer exists by the
time they finished reading it.

The licence decision is unaffected by what the code looks like. The contributor
guide and publication audit are not: both must describe and inspect the tree
that actually becomes public. The v1.3 lineage explains where this work came
from; the v2 cutover explains why its execution moved later.

## Review findings, 2026-07-26 — resolved in the planning artifacts

Two reviewers (`gemini`, `opencode`) returned REQUEST-CHANGES; see `REVIEWS.md`.
`codex` was unavailable. The historical verdicts remain unchanged; the
dispositions below are the revision submitted for a fresh review.

1. **History and current-tree publication hygiene are prerequisites.** The
   specification now requires both to be audited before publication, with any
   finding remediated and exposed credentials rotated before visibility changes.

2. **Vendored content is inventoried rather than inferred.** The tracked tree
   currently contains one vendored subtree,
   `.claude/skills/agentic-apps-workflow`, and it is first-party. The audit
   requirement applies to the tracked tree at publication time and requires
   every vendored subtree to be covered by the root licence or carry its own
   compatible licence.

3. **Package scope is explicit.** `@agenticapps/dashboard-agent` is the only
   publishable package; every other workspace package remains private. The agent
   manifest declares SPDX `MIT`, and the root licence covers the source tree.

4. **The licence text is pinned** to the canonical SPDX MIT text.

5. **Dependency provenance is audited across every class.** Compatibility blocks
   publication for redistributed content; development-only dependencies are
   inventoried without pretending they are shipped. Required notices are retained.

6. **Contributor guidance names the security spine and review protocol**, and
   the PR template makes both review stages visible.

7. **Visibility or registry distribution changes only after this change is
   archived.** Publication is a post-archive human action, not an apply task that
   creates a lifecycle loop.

8. **The lineage and sequence are both retained with different roles.** v1.3 is
   provenance; post-v2 is the current execution order.

9. **History findings have explicit dispositions.** Credentials are removed and
   rotated, sensitive identifiers are redacted or excluded, and benign matches
   require an owner-approved rationale. Rewrite or clean-history impact is recorded.

## Non-goals

- Flipping repo visibility to public. That is a GitHub setting and a human
  post-archive decision, not a code change; this change makes it *possible*, not
  automatic.
- Relaxing the deployment's access policy. Explicitly decided against.
- Any change to the daemon's security posture. Publishing the source does not
  widen what the daemon exposes, and the constraints in
  `openspec/specs/filesystem-access-policy/spec.md` are unaffected.

## Resolved: source public, deployment gated

Decided 2026-07-26. The **source** becomes publicly readable; the **deployed
dashboard keeps its access policy**.

The reasoning: the deployed SPA is a personal tool that is useless without a
paired local daemon, so exposing it publicly buys nothing and creates a
public-facing surface to own. Publishing the code is the part with actual value —
it is what makes the licence and contributor guidance worth writing.

This is why the third requirement below is framed as *"any relaxation must be an
explicit decision"* rather than *"relax the policy"*. Source publication must not
drag deployment exposure along with it.
