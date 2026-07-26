# Tasks

## 1. Resolve the open questions first

- [ ] Decide what "current phase" means for an OpenSpec project (home card primary line)
- [ ] Decide whether `fleet-coverage` gains an `openspec` column or reuses `workflowVersion`
- [ ] Decide whether the daemon reads relocated `docs/legacy-planning/` trees, and if so, how the path allow-list changes

## 2. Detection

- [ ] Add front-end detection to the project status computation (TDD)
- [ ] Extend the registry status shape to carry the detected front end
- [ ] Extend `register --auto` to accept an `openspec/` marker

## 3. OpenSpec progress reader

- [ ] Read active changes from `openspec/changes/`, excluding `archive/`
- [ ] Read archived changes as completed history
- [ ] Derive per-change task completion from each change's `tasks.md`
- [ ] Map the projection onto the existing progress wire shape, or extend the shared schema if it does not fit

## 4. Surfaces

- [ ] Home card renders the OpenSpec shape without regressing the GSD shape
- [ ] Single-project view renders OpenSpec progress
- [ ] Verify this repository's own row renders correctly (it is the first migrated project)

## 5. Verify

- [ ] Fixtures cover: GSD-only, OpenSpec-only, both present, neither present
- [ ] `openspec validate --all` green; `pnpm lint` green; per-package tests green
- [ ] If the path allow-list changed, re-run the security audit against `filesystem-access-policy`
