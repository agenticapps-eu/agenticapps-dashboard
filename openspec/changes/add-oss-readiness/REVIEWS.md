## Reviewer: gemini
_generated 2026-07-26T14:45:31Z · timeout 180s_

VERDICT: REQUEST-CHANGES
- The spec is missing a requirement to audit third-party dependency licenses for compatibility with MIT. This is a critical step before open-sourcing.
- The requirement for `package.json` to contain a `license` field is too narrow. It mentions only the "agent package", but it should apply to all publishable packages within the repo (e.g., the SPA).
- The spec omits a `CODE_OF_CONDUCT.md`, which is a standard and important part of establishing community norms for an open-source project.
- There is no requirement to audit the codebase for embedded secrets, internal hostnames, or other sensitive information that should not be made public.
- The `CONTRIBUTING.md` section mentions a "two-stage review expectation" but doesn't require a link to the document that defines it (e.g., `docs/review-protocol.md`), making it harder for new contributors to understand the process.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: opencode
_generated 2026-07-26T14:49:04Z · timeout 180s_

# Adversarial Review — add-oss-readiness

**VERDICT: REQUEST-CHANGES**

## Concrete issues

- **Spec delta misses the published agent package's surface area.** The first requirement's second scenario asserts "the agent package manifest declares the matching licence identifier," but no requirement/scenario actually defines *which* manifest (package.json? the CLI binary?), nor the licence identifier string (SPDX `MIT`?), nor what happens if the shared/SPA packages also publish. With a monorepo (`@agenticapps/dashboard-agent`, `-shared`, `-spa`), "the published agent package" is singular and undefined — if only the agent is published, say so; if all three are, the requirement must cover all three.

- **`package.json` `license` field is not specified, and CI may enforce it.** CI enforces `pnpm lint` and the phase gate runs eslint. Many eslint configs (including `eslint-plugin-package-json`) *fail* on a missing/empty `license` field or a `license` that doesn't match the file. The change adds a `LICENSE` file but the delta never touches `package.json` `private`/`license`/publish config. If any package has `"private": false` or a publish step, declaring the licence in the manifest is a build-time requirement, not just a discoverability nice-to-have — the scenario should assert the manifest lint passes.

- **No requirement that existing copyright notices / headers are consistent or absent.** Adding MIT at the root does not, alone, make the repo cleanly MIT-licensable. If existing source files carry no copyright header (or carry a different one, or none), the licence is still valid but downstream users get ambiguous provenance. The spec is silent on whether headers must be added, removed, or left as-is. A scenario like "every source file's provenance is unambiguous w.r.t. the root LICENSE" would close this.

- **`CONTRIBUTING.md` scenarios do not cover the security-spec carve-outs contributors must learn.** This repo's spine is `filesystem-access-policy`. A contributor who follows the test-run scenario but later touches a daemon route could easily relax the read-only/allow-list invariants without realizing they're load-bearing. The requirement lists "install, build, test, two-stage review" but omits "where the security spec lives and which constraints are non-negotiable." Given the change explicitly defers to that spec for the daemon's posture, the contributor guide should point at it — otherwise the delta under-specifies the most dangerous contributor surface.

- **No scenario covers the PR template actually matching the two-stage review described.** The two-stage-review requirement is restated twice (once per scenario), but there is no assertion that the committed PR template *contains* the two-stage review steps. A template can exist and be silent on review staging; the scenario "PRs follow a known shape" only asserts "a template presents the expected sections" without naming the two stages. The intent ("template describes the stages") is weaker than the requirement implies.

- **`LICENSE` content provenance is unspecified — MIT variant risk.** There is more than one MIT text in wide circulation (with/without the optional warranty paragraph wording, standard vs. X11-style header). The scenario asserts "MIT terms" but not the exact text or a hash/source. For a publishable repo, pinning the canonical text (e.g., "the SPDX MIT text") prevents a slightly-off licence from being rejected by licence-check tooling or downstream lawyers. Low risk, but trivial to specify and the delta doesn't.

- **"Waits for the v2 cutover" is a sequencing statement, not a spec invariant — and it conflicts with the requirement that nothing here is time-dependent.** The *Why* section argues "the licence question is unaffected by what the code looks like," yet *Sequence* delays the entire change. If the licence and contributor guidance are genuinely independent of the code shape (the change argues they are), splitting the change — `add-mit-license` now, `oss-contributor-and-publish` after v2 — would ship the zero-risk half immediately and remove the only real sequencing dependency. The bundling isn't wrong, but the rationale ("nothing becomes harder by waiting") cuts against the bundling and isn't reconciled in the design.

- **Third-party attribution / vendored content is not addressed.** This repo vendors a substantial workflow skill bundle, GSD, gstack, GitNexus skills, `claude-workflow`, etc. (visible in CLAUDE.md and the skills list). Publishing the source publishes those vendored trees too unless `.gitignore`/publish excludes them. MIT at the repo root is inaccurate for vendored GPL/proprietary content. The delta should assert either (a) no vendored content is published (via package/files fields or `.gitignore`), or (b) each vendored subtree keeps its own licence. This is the highest-severity gap — it could make a published MIT `LICENSE` *false*.

- **PII / secrets hygiene before publish is not a requirement.** Publishing a previously-private repo means git history becomes public; any committed secrets, internal URLs, Tailscale IPs, or pairing tokens in history are now public. The change's *Non-goals* say "no change to the daemon's security posture," but that addresses the *daemon*, not the *history*. A pre-publish requirement (e.g., `git secrets` / `trufflehog` clean, `openspec validate --all` green, daemon token rotated) is a real prerequisite for "source public" that the delta omits entirely. This is the second-highest-severity gap.

- **`openspec validate --all` and the §18 change-gate are not named as a publish prerequisite.** CLAUDE.md states the change-gate blocks edits while a change is open. Publishing mid-change would ship a repo with an open `openspec/changes/add-oss-readiness/` directory. The delta should either require the change be archived *before* visibility flips, or explicitly accept that the `openspec/` tree publishes with open changes — neither is stated.

## Lower-severity notes

- The *Why* cites `v1.2-REQUIREMENTS.md` saying OSS was deferred "to v1.3" while the *Sequence* defers it to "after v2 cutover." The two milestones are different (v1.3 vs v2). The rationale for the second deferral is sound, but the lineage ("carried forward from v1.3") is now stale and should be acknowledged or the citation updated.
- The second scenario reuses "two-stage review expectation" verbatim across both scenarios; one could be tightened to cover the *template's* content rather than restating the *guide's* content.
- The "published agent package manifest" phrasing reads as if there is already a published package; if none is currently published, the requirement should be conditional ("IF the agent package is published THEN its manifest declares…") or framed as a precondition to first publish.

