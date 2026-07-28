# Tasks

## 1. Licence

- [ ] Add the SPDX MIT `LICENSE` at the repo root with the owner-approved copyright holder and publication year
- [ ] Set `"license": "MIT"` in `packages/agent/package.json`; confirm it is the only publishable workspace package
- [ ] Inventory tracked vendored subtrees and source notices; record how each is covered or excluded
- [ ] Audit runtime, development, transitive, and bundled dependency licences; apply compatibility blocking to redistributed content
- [ ] Generate `THIRD-PARTY-NOTICES` (or equivalent) retaining every required redistributed attribution

## 2. Contributor guidance

- [ ] Write `CONTRIBUTING.md`: prerequisites, install, build, per-package test commands
- [ ] Document the OpenSpec lifecycle and link `docs/review-protocol.md` plus the filesystem-access-policy spec
- [ ] Add `CODE_OF_CONDUCT.md` and link it from the contributing guide
- [ ] Add `SECURITY.md` with a private vulnerability-reporting channel and response expectations
- [ ] Add a pull-request template under `.github/` naming the pre-code and post-implementation review stages
- [ ] Verify a clean clone can reach a green test run following only the written steps

## 3. Publication audit

- [ ] Audit the current tree and every git object the publication host can expose for secrets, tokens, pairing URLs, private hostnames, and personal paths
- [ ] Classify findings; remove/rotate credentials, redact sensitive identifiers, and record owner-approved rationale for benign matches
- [ ] Record whether history is rewritten or republished cleanly, including clone/reference impact
- [ ] Audit public-fork workflow trust, especially `pull_request_target` and secret-bearing jobs
- [ ] Record a publication checklist stating that visibility remains private until this change is validated, approved, implemented, folded, and archived
- [ ] Record the post-archive human action to make the source public and verify that the deployment access policy remains unchanged

## 4. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` and per-package tests green
- [ ] Fresh independent OpenSpec review approves the revised change
- [ ] Two-stage implementation review complete
