# Tasks

## 1. Licence

- [ ] Add MIT `LICENSE` at the repo root with the correct copyright holder and year
- [ ] Set the matching `license` field in `packages/agent/package.json`
- [ ] Confirm no bundled dependency carries a licence incompatible with MIT redistribution

## 2. Contributor guidance

- [ ] Write `CONTRIBUTING.md`: prerequisites, install, build, per-package test commands
- [ ] Document the two-stage review expectation and the OpenSpec change lifecycle
- [ ] Add a pull-request template under `.github/`
- [ ] Verify a clean clone can reach a green test run following only the written steps

## 3. Publish the source only

- [ ] Confirm no secret, token, internal hostname, or personal path is committed anywhere in history
- [ ] Flip repository visibility to public (human action)
- [ ] Verify the deployment's access policy is UNCHANGED after the flip — source publication must not widen it

## 4. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` and per-package tests green
- [ ] Two-stage review complete
