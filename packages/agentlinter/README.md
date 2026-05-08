# @agenticapps/agentlinter

AgenticApps-vendored fork of [agentlinter](https://github.com/seojoonkim/agentlinter) (upstream owned by simonkim).

## Why this exists

Phase 5's SkillHealth panel needs the agentlinter CLI. Resolving `agentlinter` from the public npm registry crosses a third-party trust boundary: every cache miss could fetch a fresh, unreviewed version with no integrity pin (CVE-class supply-chain risk — see `.gstack/security-reports/2026-05-08T04-50-46Z.json`). Instead, we vendor a reviewed fork as a workspace package.

## What was changed from upstream v2.3.0

- **Removed `src/upload.ts`** — entire share/telemetry path eliminated. The fork makes zero network calls.
- **Removed the share-by-default branch in `bin.ts`** — no fingerprint, no POST to agentlinter.com.
- **Removed `analytics/`** — upstream ships 15MB of third-party historical scan reports we don't redistribute.
- **Renamed package** to `@agenticapps/agentlinter` (workspace-local, never published to npm).

The CLI scoring engine and lint rules are unchanged from upstream v2.3.0.

## Upstream tracking

Source-of-truth template for weekly upstream-watch lives at `docs/agentlinter-fork-upstream-watch.yml`. Ship that into the github fork (`agenticapps-eu/agentlinter`) under `.github/workflows/` to get a tracking issue when upstream `seojoonkim/agentlinter` diverges from our vendored snapshot.

## How the dashboard daemon spawns it

`packages/agent/src/lib/agentLinterRunner.ts` resolves the bin path via `createRequire('@agenticapps/agentlinter/package.json')` and reads `pkg.bin.agentlinter`. Spawn is `node <resolved-bin> --local --json <projectRoot>`.

The `--local` flag is now a no-op (no upload code remains) but kept for argv-compatibility with upstream and as belt-and-suspenders if upstream is ever swapped back in.
