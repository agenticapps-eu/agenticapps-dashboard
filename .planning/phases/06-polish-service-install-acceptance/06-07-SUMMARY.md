---
phase: 06
plan: 07
status: PARTIAL
wave: 3
started_at: 2026-05-11
---

# SUMMARY — Plan 06-07: Closure ritual + review protocol + README + CF Access

## Objective

Land all remaining POLISH requirements + close all carry-forwards in a single composed plan:

1. POLISH-05 protocol doc (D-6-12..14) — docs/review-protocol.md.
2. POLISH-06 README (D-6-15..17) — README.md rewrite + structure test.
3. D-6-16 screenshots — docs/img/{home,project,onboarding}.png from live SPA.
4. D-6-18 CF Access doc — docs/deploy/cf-access-policy.md.
5. Closure ritual — open v1.0 PR (per D-6-24), Stage 1 + Stage 2 reviews, update STATE/ROADMAP/REQUIREMENTS.

## Commits (so far this plan)

| Commit | Description |
|--------|-------------|
| `c8cf97f` | docs(06-07): two-stage review protocol + CF Access policy reference |
| `9638264` | test(06-07): readme-structure assertions per D-6-15 (RED) |
| `58a78f5` | feat(06-07): rewrite README per D-6-15 + commit live SPA screenshots (GREEN) |
| `8ceaa29` | chore(06-07): fix pre-existing lint errors blocking v1.0 CI |

## Manual UAT

### POLISH-02 reboot UAT — **DEFERRED** (D-6-22)

Per D-6-22 (Phase 6 CONTEXT.md): the launchd reboot survival test is **opt-in**. During Plan 06-07 closure (2026-05-11), the user elected to defer the live reboot validation.

Coverage in place without the live reboot:

- `packages/agent/src/cli/installLaunchd.test.ts` — unit-level vitest assertions on plist content + mode bits.
- `packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts` — subprocess test that spawns the built CLI in a tmpdir HOME and asserts the file written + permissions.

What is NOT covered without the live test:

- `launchctl load ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist` actually loading the agent on this user's Mac.
- Daemon being auto-started by launchd after a real reboot.
- `KeepAlive` actually restarting the daemon on crash.

This validation will happen when the developer first deploys the LaunchAgent in real use — tracked as a v1.x post-ship UAT item.

### POLISH-03 systemd UAT — **DEFERRED** (Linux required)

The systemd unit install logic is covered by `packages/agent/src/cli/installSystemd.test.ts` and `packages/agent/src/cli/__tests__/install-systemd.subprocess.test.ts`, which confirm the unit file content + path are correct.

Live `systemctl --user enable --now eu.agenticapps.dashboard` activation requires a Linux machine and is out of scope on a macOS dev box. Will be validated on the first Linux deploy (out-of-band).

## Stage 1 + Stage 2 — pending

(PR opened below; review findings appended to PR description as `<finding>` blocks. This SUMMARY.md will be updated with finding counts after both stages complete.)

## PR

(Created via `gh pr create --base main --head phase-06-polish-service-install` — URL recorded once issued.)

## Closure tasks remaining

- [ ] Stage 1 (gstack /review) — run in this session
- [ ] Stage 2 (superpowers:requesting-code-review) — fresh session per project memory
- [ ] PR `## Stage 1` + `## Stage 2` sections each contain at least one `<finding>` block
- [ ] All `block`-severity findings resolved
- [ ] STATE.md / ROADMAP.md / REQUIREMENTS.md updated for v1.0 closure
- [ ] Merge + tag v1.0 (HUMAN gate — pause for explicit approval)
