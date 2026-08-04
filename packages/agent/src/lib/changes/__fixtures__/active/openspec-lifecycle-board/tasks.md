## 1. Evidence, decisions, and contract

- [ ] 1.1 Capture real active and archived OpenSpec change fixtures from disk, including `.openspec.yaml` provenance, and verify the captured inputs are unchanged by reader tests
- [ ] 1.2 Record the approved association, lifecycle, watcher, Ship-tip, aging, exact git allowlist, and 124-cell responsive decisions in a numbered ADR
- [ ] 1.3 Add and type-check the declaration-only public TypeScript surface for normalized change cards and OpenSpec tracking, then commit the Phase-1 contract atomically

## 2. Read-only discovery and lifecycle classification

- [ ] 2.1 RED: add disk-fixture and temporary-git-history tests for optional/invalid session cwd, ancestor-only repository discovery with `.git` directory/worktree file boundaries, exact `YYYY-MM-DD-` archived-slug parsing, branch-first/detached-HEAD one/many/duplicate-archive association, optional design, checklist row/progress and missing-verdict parsing, approved reviewer labels, every lifecycle predicate including either-ref archive reachability when `origin/HEAD` is stale, seven-day aging, corrupt input, sanitized git execution including `GIT_NAMESPACE`, and no-write invariants; capture the expected failures and commit atomically
- [ ] 2.2 GREEN: implement the shared file reader and lifecycle classifier plus the single allowlisted `git cat-file -e` Ship-tip probe with sanitized environment/config, 500 ms timeout, 64 KiB output cap, and cached per-repository result; make the focused and full suites green and commit atomically

## 3. Repository watching and adapter enrichment

- [ ] 3.1 RED: add tests for synchronously seeded file-only fingerprints, lazy initial Ship probing, unconditional active/archive directory coverage, no spurious first fire, relevant artifact/ref changes, Ship-cache invalidation with stale in-flight result rejection, unioned per-host repository contributions, last-contributor pruning, shared per-repository deduplication, and sub-second callbacks
- [ ] 3.2 GREEN: implement the shared 200 ms unref'd repository tracker and `withOpenSpecTracking` adapter wrapper without modifying concrete host parsing

## 4. Store integration and task preservation

- [ ] 4.1 RED: extend store tests to require fresh `changeCards` references on host/repository refresh while preserving normalized task records
- [ ] 4.2 GREEN: extend normalized snapshot/model/store aggregation and wrap all three adapters at the composition root
- [ ] 4.3 Add type/import-boundary regression checks proving timeline and notification consumers remain task-based and do not accept `changeCards`

## 5. Lifecycle board UI

- [ ] 5.1 RED: add pure tests for five lifecycle buckets, active-ready versus archived Archive markers, host-session card identity/order, 124-cell layout selection, wide/pager navigation and scrolling, narrow-stage auto-follow, stage counts, omitted-session footer persistence, strict card filtering, exact artifact/reviewer/checklist/archive/host-task detail fields, focus-follow on stage move, and stale-focus recovery
- [ ] 5.2 GREEN: replace the task board with five lifecycle columns, change cards, updated change/host-task detail and filter behavior, omitted-session footer, and the approved narrow stage pager while leaving timeline mode unchanged
- [ ] 5.3 Run UI-preview mode against populated wide and narrow states and save screenshot/interaction evidence under the change

## 6. Gates and completion evidence

- [ ] 6.1 Run `openspec validate --all`, `bun test`, and `bun run typecheck`; measure an end-to-end repository evidence change with subprocess work against the one-second Core Value; record fresh output and resolve every failure
- [ ] 6.2 Run `codex-cso`, including dependency and secret scans, and record `SECURITY.md`
- [ ] 6.3 Run live TUI phase QA across association, stage movement, filtering, narrow paging, timeline, and notification regression; record `QA.md`
- [ ] 6.4 Run the post-implementation visual audit against wide and narrow screenshots; resolve blocking findings and record `IMPECCABLE-AUDIT.md`
- [ ] 6.5 Obtain an independent Stage-3 code review, fix all Critical/Important findings, and record `REVIEW.md`
- [ ] 6.6 Re-read every requirement and task, attach evidence to each completed checkbox, and run the final verification-before-completion checks

## 7. OpenSpec closure

- [ ] 7.1 Invoke `openspec-sync-specs`, apply the delta requirements, create the `openspec-change-tracking` Purpose and rewrite the `board-view`, `host-adapters`, and `live-updates` Purpose sections to the exact outcomes in `design.md`, and re-run `openspec validate --all`
- [ ] 7.2 Confirm every implementation/evidence task is complete, then invoke `openspec-archive-change` and verify the dated archive exists before branch-close
