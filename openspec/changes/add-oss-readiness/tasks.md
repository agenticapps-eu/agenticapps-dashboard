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

## 3. Public access decision

- [ ] Resolve the open question: does the deployment go public, or only the source?
- [ ] Record the decision and its criteria
- [ ] If going public: apply the access-policy change and verify the deployed surface exposes no daemon endpoint

## 4. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` and per-package tests green
- [ ] Two-stage review complete
