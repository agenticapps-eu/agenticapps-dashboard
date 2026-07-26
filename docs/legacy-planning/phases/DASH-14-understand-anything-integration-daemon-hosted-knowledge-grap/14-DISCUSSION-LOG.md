# Phase 14: Understand-Anything integration — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 14-understand-anything-integration-daemon-hosted-knowledge-graph-viewer
**Areas discussed:** Pre-phase scoping (host model, scan trigger), Viewer build & version coupling, Auth & remote access posture, Link placement & navigation, Status semantics & copy-command

---

## Pre-phase scoping (before phase was added to roadmap)

| Option | Description | Selected |
|--------|-------------|----------|
| Daemon-hosted static viewer | Build plugin's dashboard SPA once, daemon serves it + 6 data endpoints in Hono with bearer auth | ✓ |
| Daemon spawns plugin's dev server | Per-click Vite child process with GRAPH_DIR, captured tokenized URL | |
| Link-only v1 | Deep link only when user manually runs /understand-dashboard | |

| Option | Description | Selected |
|--------|-------------|----------|
| Copy-command pill first | Status + copy-command in v1; daemon-triggered headless claude scans deferred | ✓ |
| Full daemon-triggered scans now | POST /api/understand/scan spawning headless `claude -p /understand` | |
| Both in one phase | Mirror GitNexus Phase 13 scope exactly | |

**Notes:** User confirmed routing through GSD (add phase + discuss) rather than spiking first.

---

## Viewer build & version coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit CLI install step | `agentic-dashboard install-understand-viewer` builds from plugin cache → `~/.agenticapps/dashboard/understand-viewer/<version>/` | ✓ |
| Daemon auto-builds lazily | First request triggers build; build toolchain becomes runtime dep | |
| Vendor built assets in repo | Check built viewer into packages/agent / npm package | |

| Option | Description | Selected |
|--------|-------------|----------|
| Detect + hint, manual re-run | Daemon compares installed vs plugin-cache version; /health exposes both; SPA hints | ✓ |
| Auto-rebuild on version change | Daemon startup rebuilds; violates no-auto-update spirit | |
| No detection | User re-runs on mystery failure | |

---

## Auth & remote access posture

| Option | Description | Selected |
|--------|-------------|----------|
| Scoped read-only viewer token | Separate 0600 token valid only for /understand/* data endpoints; TokenGate unmodified | ✓ |
| Reuse daemon bearer token | Full-privilege token in URLs/history | |
| No token on loopback | Breaks bearer-auth-on-every-route constraint | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full parity | Viewer + all data endpoints on every bind mode (read-only surface) | ✓ |
| Viewer yes, source previews loopback-only | file-content.json 403 on non-loopback | |
| Loopback-only | Entire /understand/* refuses non-loopback | |

| Option | Description | Selected |
|--------|-------------|----------|
| Graph-listed files only | Ratified constraint exception: file-content.json serves files listed in knowledge-graph.json, upstream guards replicated | ✓ |
| Keep allow-list, degrade previews | Only .planning/.claude previews | |
| No source previews in v1 | Omit file-content.json entirely | |

**Notes:** D-14-05 is an explicit, user-ratified exception to the `.planning`/`.claude` read allow-list. `/cso` audit mandatory.

---

## Link placement & navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar section + coverage cell | New "Code Intelligence" section with analyzed-projects page; coverage ✓ doubles as link | ✓ |
| Coverage cell + project page only | No new navigation | |
| Coverage cell only | Minimal | |

| Option | Description | Selected |
|--------|-------------|----------|
| New tab | /understand/{repoId}/?token=… in new tab | ✓ |
| Embedded iframe page | Viewer inside dashboard shell | |

**Notes:** Sidebar-section choice applies the user's recorded preference for sections with growth room over peer top-level items.

---

## Status semantics & copy-command

| Option | Description | Selected |
|--------|-------------|----------|
| Commit-hash mismatch | Stale when meta.json gitCommitHash ≠ HEAD | ✓ |
| Hash + age hybrid | Also stale past N days | |
| Age only | lastAnalyzedAt > N days | |

| Option | Description | Selected |
|--------|-------------|----------|
| Serve by repoId with FS fallback | Registry-first, deterministicRepoRoot() fallback (D-13-EXT-08 precedent) | ✓ |
| Registered projects only | Dead cells on most of the 22-repo fleet | |

| Option | Description | Selected |
|--------|-------------|----------|
| cd one-liner with claude | `cd ~/Sourcecode/{family}/{repo} && claude "/understand"` via shared {string, argv} helper | ✓ |
| Just /understand | Assumes open session in right cwd | |
| Per-repo tooltip with both | More UI surface | |

---

## Claude's Discretion

- Vite `base` config for sub-path serving (verify what the built bundle supports)
- `/health` `understand` block + coverage wire-schema shape (`.strict()`, optional for back-compat)
- domain-graph/diff-overlay 404 behavior parity
- Viewer-token rotation story
- Sidebar section/page naming (working name "Code Intelligence")
- Status-detection caching/TTL
- `install-understand-viewer` prerequisite checks + error messages

## Deferred Ideas

- Daemon-triggered understand scans (headless `claude -p "/understand"`) — candidate Phase 15
- Family-level "analyze all" actions — depends on scans
- `/understand-diff` overlay generation from the dashboard — scan-adjacent
- GitNexus explorer page in the Code Intelligence section
- Embedded iframe viewer — revisit only if new-tab switching annoys in dogfooding
- Auto-rebuild of viewer assets on plugin update
