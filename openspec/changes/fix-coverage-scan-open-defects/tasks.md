# Tasks

## 0. Gate on the deprecation decision

- [ ] Resolve `openspec/CAPABILITY-MAP.md` GAP-04 — is the GitNexus integration staying?
- [ ] If it is being removed, close this change unimplemented and open a removal change instead

## 1. family-scan-no-ui-feedback

- [ ] Reproduce; determine whether the scan starts at all
- [ ] Write the failing test that captures the missing feedback (TDD)
- [ ] Surface start, running, and settle states through to the family header control
- [ ] Confirm a failing scan reports its reason

## 2. per-row-scan-repo-not-registered

- [ ] Reproduce with a repo present in coverage but absent from the registry
- [ ] Write the failing test (TDD)
- [ ] Decide: resolve the repo path from the coverage scan, or refuse with a registration prompt
- [ ] Implement the chosen path and confirm the opaque failure is gone

## 3. Verify

- [ ] Both debug sessions closed with a recorded resolution
- [ ] `openspec validate --all` green; `pnpm lint` green; agent and SPA tests green
- [ ] Update `docs/legacy-planning/STATE.md` §"Deferred Items"
