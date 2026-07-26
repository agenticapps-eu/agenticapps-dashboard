# Phase 14: Understand-Anything integration — daemon-hosted knowledge-graph viewer + coverage status — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate the **understand-anything** Claude Code plugin into the dashboard the way GitNexus was integrated in Phase 13 — but for the **read/viewer side only**:

1. **Daemon-hosted viewer.** The daemon serves a prebuilt static build of the plugin's dashboard SPA (`packages/dashboard` inside the plugin cache, currently v2.7.6) at `/understand/{repoId}/` and re-implements its six data endpoints in Hono (`knowledge-graph.json`, `meta.json`, `config.json`, `domain-graph.json`, `diff-overlay.json`, `file-content.json`), reading from each repo's `.understand-anything/` directory. Clicking a link in the dashboard opens the full interactive knowledge-graph viewer in a new tab.
2. **Coverage-matrix status.** A new Understand column per repo: analyzed ✓ (links to viewer) / stale (meta.json `gitCommitHash` ≠ current HEAD) / missing — with a copy-command pill (`cd … && claude "/understand"`) on stale/missing rows.
3. **Sidebar section.** A new sidebar section (e.g. "Code Intelligence") with a page listing analyzed projects → viewer links. Built with growth room (future: GitNexus explorer, scan triggers).
4. **Viewer asset install.** New CLI command `agentic-dashboard install-understand-viewer` builds the viewer from the plugin cache and installs it under `~/.agenticapps/dashboard/understand-viewer/<version>/`.

**Explicitly NOT in this phase:** daemon-triggered analysis scans. Unlike `gitnexus analyze`, understand-anything analysis is **LLM-driven** (the `/understand` skill orchestrates Claude subagents — there is no headless binary). Spawning headless `claude -p "/understand"` from the daemon is a deferred follow-up phase. This phase ships status + copy-command + viewer only.

**Bounded by:** no analysis execution, no SSE, no modifications to the upstream plugin, no embedding of the viewer inside the dashboard shell (new tab only).

</domain>

<decisions>
## Implementation Decisions

### A. Viewer build & version coupling

- **D-14-01** — Viewer assets are installed via an explicit CLI step: `agentic-dashboard install-understand-viewer`. It locates the plugin cache (`~/.claude/plugins/cache/understand-anything/understand-anything/<version>/packages/dashboard`), builds the viewer (core package first, then `vite build`), and copies `dist/` to `~/.agenticapps/dashboard/understand-viewer/<version>/`. The daemon serves whatever is installed; no build toolchain at daemon runtime. Mirrors the `install-launchd` CLI pattern and keeps writes inside the daemon-write boundary.
- **D-14-02** — Version-drift handling is **detect + hint, manual re-run**. Daemon compares the installed viewer version against the newest plugin-cache version at startup; `/health` exposes both (`understand: { viewerInstalled, viewerVersion, pluginVersion, … }`). SPA renders an "update available — run `agentic-dashboard install-understand-viewer`" hint on mismatch. No automatic rebuilds — consistent with PROJECT.md's "no auto-update of the daemon" stance.

### B. Auth & remote access posture

- **D-14-03** — The viewer's data endpoints accept a **scoped read-only viewer token**, minted by the daemon and stored 0600 alongside the existing auth files in `~/.agenticapps/dashboard/`. It is valid ONLY for `/understand/*` data endpoints. The dashboard SPA builds viewer links carrying it as `?token=` (the upstream `TokenGate` works unmodified). The full-privilege daemon bearer token never appears in viewer URLs/browser history.
- **D-14-04** — **Full Tailscale parity.** `/understand/*` (viewer assets + all data endpoints, including `file-content.json`) is served on every bind mode. Rationale: this is a read-only surface — categorically different from Phase 13's scan refusal (D-13-11), which gated subprocess execution. Scoped token + CORS still apply.
- **D-14-05 (CONSTRAINT EXCEPTION — ratified by user 2026-06-06)** — `file-content.json` may serve any file whose normalized path appears as a node `filePath` in that repo's `knowledge-graph.json`. This is broader than the `.planning`/`.claude` read allow-list of `/api/projects/{id}/read`; the knowledge graph itself defines the allow-list (the user generated it by running `/understand`). All upstream guards are replicated: reject `..`/absolute/NUL paths, realpath containment under the repo root, graph-membership check, 1 MB size cap, binary-content rejection. Reference implementation: `readSourceFile()` in the plugin's `packages/dashboard/vite.config.ts`. `/cso` must audit this route in the post-phase ritual.
- **D-14-05b** — Graph JSON served to the browser is **sanitized like upstream**: absolute `filePath` values are relativized to the repo root; absolute paths outside the root are reduced to basename (see vite.config.ts "FIX 2"). No `~/Sourcecode/...` layout leaks to the wire.

### C. Placement & navigation

- **D-14-06** — New **sidebar section** (working name "Code Intelligence") containing a page that lists analyzed projects with staleness + viewer links. Built as a section with growth room per the user's established sidebar-architecture preference, even though v1 has one entry. PLUS the Coverage matrix Understand-cell ✓ doubles as a link.
- **D-14-07** — Viewer opens in a **new tab** at `/understand/{repoId}/?token=…`. No iframe embedding — the viewer is a full SPA that wants the whole viewport.

### D. Status semantics & copy-command

- **D-14-08** — Staleness is **commit-hash mismatch**: stale when `.understand-anything/meta.json` `gitCommitHash` ≠ the repo's current HEAD. Tooltip shows `lastAnalyzedAt`. Deterministic and consistent with Coverage-matrix freshness discipline.
- **D-14-09** — Unregistered-but-analyzed repos are served **by repoId with FS fallback**: viewer routes and status use the coverage `family/repo` id; the daemon resolves the root registry-first, then `deterministicRepoRoot()` (D-13-EXT-08/09 precedent — family allow-list, realpath-guarded, dot-segment rejection). Every analyzed repo visible in the matrix gets a working link.
- **D-14-10** — The copy pill copies a self-contained one-liner: `cd ~/Sourcecode/{family}/{repo} && claude "/understand"`. Built by a shared helper returning `{ string, argv }` (D-13-10 pattern) so a future daemon-scan phase reuses the same construction. Pill appears on missing AND stale rows (stale row keeps its link too).

### Claude's Discretion

Technical details the user trusts researcher/planner to resolve (capture in PLAN.md, not here):

- Vite `base` configuration for serving the viewer under the `/understand/{repoId}/` sub-path (relative base `./` vs path rewrite at the daemon) — planner verifies what the built bundle supports.
- Exact shape of the `understand` block in `/health` and in the coverage wire schema (`.strict()`, optional for back-compat per D-13-EXT-10 precedent).
- Whether `domain-graph.json` / `diff-overlay.json` 404 behavior matches upstream (they are optional artifacts — upstream returns 404 with empty body for some, JSON error for knowledge-graph).
- Viewer-token rotation story (probably rotate alongside `rotate-token`, or independent — planner picks, smallest correct surface).
- Sidebar section + page naming ("Code Intelligence" is a working name; UI-spec phase may refine).
- Caching/TTL for status detection (likely fold into the existing coverage scan; 143 kB graph files are served on demand, not cached).
- How `install-understand-viewer` verifies build prerequisites (pnpm present, plugin installed) and its error messages.

### Folded Todos

None — no pending todos matched Phase 14's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `docs/spec/dashboard-prompt.md` — Hard architectural constraints. Phase 14 touches two: the read allow-list (see D-14-05 ratified exception) and "bearer-token auth on every route" (scoped viewer token satisfies it — every `/understand/*` data route requires a token).
- `.planning/PROJECT.md` — Constraints list incl. "no auto-update" stance (motivates D-14-02), no native deps, zero third-party JS in the dashboard SPA (the viewer is a separate origin-path app, not imported into `packages/spa`).
- `.planning/ROADMAP.md` §"Phase 14" — Goal statement.

### Phase precedents
- `.planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-CONTEXT.md` — The integration template this phase follows: D-13-07 (install CTA pattern → copy pill), D-13-10 (shared `{string, argv}` command builder), D-13-11/11b (bind-mode posture — explicitly NOT copied here per D-14-04, read-only rationale), D-13-EXT-08/09 (`deterministicRepoRoot()` registry-first + FS fallback, realpath guards), D-13-EXT-10 (optional wire fields for back-compat), D-13-EXT-11 (repoId regex hardening).
- `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/` — Coverage wire schema, `CoverageRow`/`CoverageFamilySection` anatomy, column-width SoT (`COVERAGE_COL_WIDTHS`).
- `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — IMPECCABLE artifact requirement for the new sidebar page + coverage column (frontend-touching phase).
- `.planning/phases/DASH-12-observability-conformance-surface/12-CONTEXT.md` — Error-code mapping + invalidation discipline for any new query hooks.

### Upstream plugin (read, do not modify)
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/vite.config.ts` — **The contract to re-implement in Hono**: 6 data endpoints, token gate, path sanitization ("FIX 2"), `readSourceFile()` guards (graph-membership allow-list, 1 MB cap, binary rejection), `graphFileCandidates()` resolution. ~200 lines; D-14-05/05b mirror it.
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/packages/dashboard/src/App.tsx` (lines ~118–195) + `src/components/TokenGate.tsx` + `src/components/CodeViewer.tsx` — How the viewer fetches data (same-origin relative URLs + `?token=`); confirms the static build works against any server implementing the endpoints.
- `~/.claude/plugins/cache/understand-anything/understand-anything/2.7.6/skills/understand-dashboard/SKILL.md` — Upstream's own launch procedure (plugin-root resolution order, build prerequisites: core package built before dashboard) — input for `install-understand-viewer`.
- Per-repo data layout: `<repo>/.understand-anything/{knowledge-graph.json, meta.json, config.json, fingerprints.json, intermediate/}` — `meta.json` carries `{ lastAnalyzedAt, gitCommitHash, version, analyzedFiles }` (staleness source per D-14-08). Live example: `/Users/donald/Sourcecode/agenticapps/claude-workflow/.understand-anything/`.

### Code that Phase 14 touches or extends
- `packages/agent/src/routes/health.ts` — gains `understand: {…}` block (D-14-02).
- `packages/agent/src/lib/coverageScan.ts` — gains Understand-column detection (presence + hash comparison).
- `packages/agent/src/lib/gitnexusScan.ts` `deterministicRepoRoot()` — reuse/extract for D-14-09 path resolution (do NOT duplicate the realpath logic).
- `packages/spa/src/components/panels/coverage/{CoverageRow,CoverageFamilySection,CoveragePage}.tsx` + `coverageColumnTooltips.ts` + `COVERAGE_COL_WIDTHS` SoT — new column.
- `packages/spa/src/components/panels/coverage/InstallGitNexusButton.tsx` — pattern donor for the copy pill.
- `packages/shared/src/schemas/coverage.ts` — wire schema extension (optional field per D-13-EXT-10 precedent).
- Sidebar/section registry in `packages/spa` (AppShellV2 Sidebar) — new section + route.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deterministicRepoRoot()` (agent, Phase 13) — registry-first + `~/Sourcecode/{family}/{repo}` fallback with family allow-list, realpath guard, dot-segment rejection. Exactly the resolution D-14-09 needs; extract to a shared lib module rather than importing from `gitnexusScan.ts`.
- `InstallGitNexusButton` + `buildGitnexusIndexClipboardString` — copy-command CTA pattern + `{string, argv}` builder shape for D-14-10's `buildUnderstandCommand()`.
- Coverage column machinery — `COVERAGE_COL_WIDTHS` SoT, `coverageColumnTooltips.ts`, 3-state cell rendering, `Toast` for clipboard feedback (8 existing call sites).
- Static-file serving — Hono's `serveStatic` from `@hono/node-server` (already a dependency family; verify no native deps).
- Bearer/auth middleware + rate limiter (Phase 1) — daemon route scaffolding; `/understand/*` data routes get the scoped-token variant instead of bearer.

### Established Patterns
- **Wire schema discipline** — `.strict()` everywhere, optional fields for back-compat (D-13-EXT-10), discriminated unions for error responses, fixed error-code enums (no stderr/path leakage).
- **Detection without execution** — Phase 10.6's stat-based probes; Understand detection is pure FS reads (`existsSync` + JSON parse of `meta.json`) + existing git HEAD lookup, no subprocess.
- **Frontend gate** — every frontend-touching phase commits `14-IMPECCABLE.md` (composite floor per D-10.5-03 calibration).
- **Two-stage review + `/cso`** — `/cso` is mandatory here: new auth surface (scoped token) + ratified read-scope exception (D-14-05).

### Integration Points
- **Daemon**: new `packages/agent/src/routes/understandViewer.ts` (static assets + 6 data endpoints), mounted in `app.ts`; new `packages/agent/src/lib/understandScan.ts` (status detection) folded into coverage scan; `health.ts` extension; new CLI subcommand in the commander setup.
- **SPA**: new sidebar section + route (e.g. `/code-intelligence`), new query hook for the analyzed-projects listing, Coverage column wiring.
- **Shared**: `understand` schemas (status enum, health block, listing response) + `buildUnderstandCommand()`.

</code_context>

<specifics>
## Specific Ideas

- The user ran `/understand` + `/understand-dashboard` on `~/Sourcecode/agenticapps/claude-workflow` (110 files analyzed, 143 kB graph) and wants exactly that experience reachable from the dashboard: "click on a link and get to the generated website".
- "Integrate this similar to gitnexus" — Phase 13 is the explicit template; deviations (no scan execution, Tailscale parity) are deliberate and documented above.
- The upstream viewer at `http://127.0.0.1:5173/?token=…` is the visual reference for what `/understand/{repoId}/` must render.
- User's sidebar-architecture preference (recorded feedback): new section with growth room over peer top-level items, even when v1 has only one entry — applied in D-14-06.

</specifics>

<deferred>
## Deferred Ideas

- **Daemon-triggered understand scans** — headless `claude -p "/understand"` per repo with Phase-13-style lock/poll/shutdown machinery, long timeout, token-cost warning in the UI. Deliberately split out: LLM-driven subprocess is a materially different risk/cost surface than `gitnexus analyze`. Candidate Phase 15.
- **Family-level "analyze all" actions** — depends on daemon-triggered scans landing first.
- **`/understand-diff` overlay surfacing** — the viewer already renders `diff-overlay.json` if present; generating it from the dashboard is scan-adjacent, deferred with scans.
- **GitNexus explorer page in the Code Intelligence section** — the section is built with growth room (D-14-06); content beyond understand-anything is future work.
- **Embedded viewer (iframe) inside the dashboard shell** — rejected for v1 (D-14-07); revisit only if new-tab context switching proves annoying in dogfooding.
- **Auto-rebuild of viewer assets on plugin update** — rejected (D-14-02); revisit only if manual re-runs become a recurring nuisance.

</deferred>

---

*Phase: 14-understand-anything-integration-daemon-hosted-knowledge-graph-viewer*
*Context gathered: 2026-06-06*
