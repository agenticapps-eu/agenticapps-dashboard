# Phase 14: Understand-Anything integration — daemon-hosted knowledge-graph viewer + coverage status

**Archived from GSD phase `DASH-14-understand-anything-integration-daemon-hosted-knowledge-grap`. Completed 2026-06-08.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-14-understand-anything-integration-daemon-hosted-knowledge-grap/` — that tree, not this file, is the authoritative record.

## Why

Integrate the **understand-anything** Claude Code plugin into the dashboard the way GitNexus was integrated in Phase 13 — but for the **read/viewer side only**:

1. **Daemon-hosted viewer.** The daemon serves a prebuilt static build of the plugin's dashboard SPA (`packages/dashboard` inside the plugin cache, currently v2.7.6) at `/understand/{repoId}/` and re-implements its six data endpoints in Hono (`knowledge-graph.json`, `meta.json`, `config.json`, `domain-graph.json`, `diff-overlay.json`, `file-content.json`), reading from each repo's `.understand-anything/` directory. Clicking a link in the dashboard opens the full interactive knowledge-graph viewer in a new tab.
2. **Coverage-matrix status.** A new Understand column per repo: analyzed ✓ (links to viewer) / stale (meta.json `gitCommitHash` ≠ current HEAD) / missing — with a copy-command pill (`cd … && claude "/understand"`) on stale/missing rows.
3. **Sidebar section.** A new sidebar section (e.g. "Code Intelligence") with a page listing analyzed projects → viewer links. Built with growth room (future: GitNexus explorer, scan triggers).
4. **Viewer asset install.** New CLI command `agentic-dashboard install-understand-viewer` builds the viewer from the plugin cache and installs it under `~/.agenticapps/dashboard/understand-viewer/<version>/`.

**Explicitly NOT in this phase:** daemon-triggered analysis scans. Unlike `gitn

## Capabilities affected

- `openspec/specs/code-intelligence/spec.md`

## What shipped

**14-01**

### HealthResponseSchema.understand (D-14-02)

Appended to `HealthResponseSchema` after the `gitnexus` block, mirroring its `.strict().optional()` discipline:

```ts
understand: z.object({
  viewerInstalled: z.boolean(),
  viewerVersion: z.string().nullable(),
  pluginVersion: z.string().nullable(),
  updateAvailable: z.boolean(),
}).strict().optional()
```

Key design decisions:
- `viewerVersion` and `pluginVersion` are **nullable** (not just optional) — viewer not installed or plugin cache absent are valid runtime states
- **No `viewerToken` field** — per T-14-01-01 threat mitigation; tokens

**14-02**

Agent-side foundation for the understand-anything viewer: three new lib modules (repoRoot, viewerToken, viewerInstall) with full TDD suites, plus constants additions and boot/rotation wiring.

**14-03**

### Task 1: UnderstandCopyPill Component

New composite cell component for the Understand column. Props: `{ family, repo, viewerUrl?, state }`.

Render rules:
- `state=fresh`: viewer link only (`<a target="_blank" rel="noopener noreferrer">`)
- `state=stale`: viewer link + copy pill (D-14-10: stale row keeps its link)
- `state=missing`: copy pill only

Copy pill writes `buildUnderstandCommand(family, repo).string` to clipboard via `writeToClipboard` with success/error toast (mirrors InstallGitNexusButton pattern). Viewer link is suppressed when `viewerUrl` is absent.

Column SoT updates:
- `CO

**14-04**

### CodeIntelligencePage (D-14-06, D-14-07, D-14-02)

Full page at `/code-intelligence`:

- **Filtered project listing:** `useCoverage` rows filtered to `understand.state === 'fresh' || 'stale'`; rows with `missing`, `not-applicable`, or undefined understand column are excluded
- **Viewer links (D-14-07):** Each fresh/stale row with a `viewerToken` gets an "Open viewer" link: `{agentUrl}/understand/{family}/{repo}/?token={encodeURIComponent(viewerToken)}`, `target="_blank"`, `rel="noopener noreferrer"`. Links suppressed when viewer not installed.
- **Install hint (D-14-02):** `health.understan

**14-05**

Hono implementation of the understand-anything dev-server contract: scoped-token data router (6 endpoints) + static viewer SPA serving at `/understand/{family}/{repo}/`, both mounted before `bearerAuth` in `app.ts`.

**14-06**

### Task 1: understandScanner.ts

New `packages/agent/src/lib/scanners/understandScanner.ts` with:
- `readRepoHeadSha(repoRoot)` — pure FS reading of `.git/HEAD` → ref form + branch ref file + packed-refs fallback + detached HEAD. Returns `null` on any I/O error. No subprocess.
- `scanUnderstandForRepo(repoRoot, currentHeadSha)` — reads `.understand-anything/meta.json`; returns `{ state: 'fresh' | 'stale' | 'missing', lastAnalyzedAt?, analyzedCommit?, analyzedFiles? }`. Full SHA equality required for 'fresh'; null head SHA → 'stale' (conservative). Malformed JSON → 'missing', never throws (T-1

**14-07**

`agentic-dashboard install-understand-viewer` — build the upstream understand-anything viewer from the plugin cache with `--base=./` and install it into `~/.agenticapps/dashboard/understand-viewer/<version>/`.

**14-08**

Closes Phase 14 (understand-anything integration, daemon-hosted knowledge graph). All four close tasks complete across two sessions (2026-06-07 build + ritual; 2026-06-08 security fixes + /qa).

## Gates recorded

- verification — `14-VERIFICATION.md`
- design critique — `14-IMPECCABLE.md`
- validation — `14-VALIDATION.md`
