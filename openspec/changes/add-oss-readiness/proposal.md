# Open-source readiness

## Why

The dashboard has shipped v1.0, v1.1, and v1.2 as a private repo. The v1.3
milestone in the legacy roadmap is the one remaining unstarted item: make the
repo publishable. The original spec deferred this deliberately — "private until
phase 6 ships and looks good, then flip" — and phase 6 shipped in May 2026.

Three things are missing: a licence, contributor guidance, and a decision about
whether the deployed dashboard drops its access policy to become publicly
reachable. The first two are prerequisites for the third.

Carried forward from `docs/legacy-planning/ROADMAP.md` (v1.3, requirements
OSS-01..03) and `docs/legacy-planning/milestones/v1.2-REQUIREMENTS.md`
("Deferred — belongs to v1.3").

## What changes

- Add an MIT `LICENSE` at the repo root. MIT was the recommendation in the
  original spec's open questions, to match the surrounding skill ecosystem.
- Add `CONTRIBUTING.md` covering development setup, the two-stage review
  expectation, and a PR template.
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

Nothing about this change becomes harder by waiting, and the licence question is
unaffected by what the code looks like.

## Review findings, 2026-07-26 — recorded, not yet resolved

Two reviewers (`gemini`, `opencode`) returned REQUEST-CHANGES; see `REVIEWS.md`.
`codex` was unavailable. Verified against the repo where checkable. **None is
fixed yet.**

1. **Publishing makes git history public, and nothing here audits it.** The
   non-goals say the daemon's security posture is unchanged — true, and beside
   the point. Flipping visibility exposes every commit ever made, including any
   token, pairing URL, tailnet hostname, or internal path committed and later
   removed. A history scan is a prerequisite for publication, not an
   afterthought. This is the highest-severity finding.

2. **Vendored content provenance is unstated — but the scope is narrower than
   reported.** A reviewer warned that vendored GPL or proprietary trees would
   make a root MIT licence false. Checked: `git ls-files` shows exactly one
   vendored tree, `.claude/skills/agentic-apps-workflow`, which is first-party.
   The reviewer inferred the wider set from its own skill list rather than from
   the repo. The residual finding is real though: **no `LICENSE` file exists
   anywhere in this repo**, including in that vendored tree, so its licence
   status is unstated.

3. **Which packages are licensed is undefined.** The delta refers to "the agent
   package manifest" in a workspace with three publishable packages. State
   whether one, some, or all publish, and which manifests declare the identifier.

4. **The licence text is not pinned.** Several MIT variants circulate. Pin the
   canonical SPDX text so licence tooling does not reject a near-miss.

5. **No dependency licence audit.** Compatibility of third-party dependencies
   with MIT is unchecked.

6. **Contributor guidance should point at the security spine.** A contributor can
   follow the setup instructions and then relax a `filesystem-access-policy`
   invariant without knowing it is load-bearing. That is the most dangerous
   contributor surface in this repo and the guide does not name it.

7. **Publishing mid-change is unaddressed.** With changes open, the published
   tree includes `openspec/changes/`. Either require the change be archived
   before visibility flips, or state that publishing with open changes is
   accepted.

8. **The lineage citation is stale.** The *Why* cites the v1.3 milestone; the
   sequence now defers to after the v2 cutover. Different milestones — worth
   reconciling so the provenance stays readable.

## Non-goals

- Flipping repo visibility to public. That is a GitHub setting and a human
  decision, not a code change; this change makes it *possible*, not automatic.
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
