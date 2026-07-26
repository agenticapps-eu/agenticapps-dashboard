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
