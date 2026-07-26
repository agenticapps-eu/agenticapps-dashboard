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
- Decide and record whether the production deployment relaxes its access policy
  to serve a public landing experience.

## Capabilities

- `open-source-readiness` (new)

## Non-goals

- Flipping repo visibility to public. That is a GitHub setting and a human
  decision, not a code change; this change makes it *possible*, not automatic.
- Any change to the daemon's security posture. Publishing the source does not
  widen what the daemon exposes, and the constraints in
  `openspec/specs/filesystem-access-policy/spec.md` are unaffected.

## Open questions

> [GAP: Does the public landing actually happen, or does the deployment keep its
> access policy and only the *source* become public? The original spec listed
> this as "only when public-readiness criteria met" without defining the
> criteria. Needs a decision before the third task is actionable.]
