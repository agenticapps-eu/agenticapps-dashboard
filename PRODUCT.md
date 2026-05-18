# AgenticApps Pipeline Dashboard

> Synthesized from `docs/spec/dashboard-prompt.md`, `.planning/PROJECT.md`, and `CLAUDE.md` for the impeccable critique flow. The spec is the authoritative source.

register: product

## What this is

A registry-based, multi-project dashboard that visualizes the running state of the AgenticApps Superpowers + GSD + gstack pipeline across every registered project. One page, accessible from any device, surfaces what fired, what's pending, and the verification status — without ever sending project data to a remote service.

Architecture: static SPA hosted on Cloudflare Pages + a single local daemon (`@agenticapps/dashboard-agent`) on `127.0.0.1:5193` that reads `.planning/`, `.claude/`, and `git log` from each registered project. The SPA never holds project data; it renders what the local daemon serves over a bearer-token-authenticated HTTP boundary.

## Core value

A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without sending project data to a remote service.

## Users

**Primary persona — Donald, a solo operator running multiple client + internal AgenticApps projects from one machine.**
- Power user of his own tool. Knows the discipline contract intimately (Superpowers + GSD + gstack workflow).
- Switches between client projects (factiv/cparx, factiv/fx-signal-agent) and internal projects (agenticapps-dashboard, agenticapps-workflow-core, claude-workflow, etc.) several times a day.
- Uses iPad over Tailscale to glance at dashboard while away from desk.
- Reflexively triages: which projects are healthy, which need attention, what fired last, what's overdue.
- Will absolutely notice if discipline mechanics fail silently.

**Implicit secondary — future Claude Code instances reading the same dashboard via Tailscale to inform their own work.**

## Brand & tone

- Warm paper aesthetic. Light theme primary. Calm. Confident.
- Cloudflare dashboard–inspired sidebar shell (Phase 5.1 design); minimal chrome; content density without crowding.
- Reads like an instrument panel, not a marketing landing page. No emoji, no celebratory motion, no "you crushed it!" copy.
- Honest data: when something is missing, say "never compiled" / "not installed" / "no skill installed" not "0%".
- Status pills (✓ via CLAUDE.md, ✗, ⚠ never compiled) carry semantic weight; consistent color tokens for state.

## Anti-references (what we are NOT)

- **Not Pilot Shell.** They ship per-project, gradient-heavy, SaaS-cream UI. We ship cross-project, calm, instrument-panel UI.
- **Not Vercel / Netlify dashboards.** No dark glassmorphism. No accent gradients. No big-number-on-card hero metrics.
- **Not Datadog / Grafana.** No dense data-viz dashboards with 12 charts per row. Coverage is a matrix, not a graph.
- **Not Linear / Notion.** No command-palette-as-primary-nav. Sidebar is the primary nav.
- **Not generic AI-generated dashboards** — no purple gradients, no "Recently active" hero card, no identical 3×N card grids.

## Strategic principles

- **Read-only on project filesystems.** Sole exception: `POST /open` spawns `$EDITOR` at the user's click.
- **Path allow-list per project.** Strict — only under `<root>/.planning` and `<root>/.claude`.
- **Daemon writes confined to `~/.agenticapps/dashboard/`** at mode 0600.
- **No native dependencies in the daemon** — keeps `npx` install portable.
- **No third-party JS beyond Vite + React + TS + Tailwind + TanStack Query + Zod + lucide-react** in the SPA.
- **No cloud-side data storage** — daemon never uploads project files.
- **Impeccable composite floor ≥ 87** (D-6-09.v1, provisional per D-10.5-03). Every frontend-touching phase commits a `<N>-IMPECCABLE.md` artifact from this critique.
- **Phase boundary discipline** — Phases 0–6 ship a complete dashboard; Phase 7+ are additive integrations (Sentry, Linear, Infisical). Phases 10–11 add cross-family observability (Coverage matrix + Coverage trends + Skill drift).

## Surfaces in focus this session

- `/coverage` (Phase 10/10.5/10.6/11) — the Coverage Matrix page with three family sections (agenticapps, factiv, neuroflash), four columns per repo (CLAUDE.md, GitNexus, Wiki, Workflow), and Phase 11's inline `▲Nd/▼Nd` drift badges on `CoverageCell`. Sticky `PageHeader` (Phase 11 PLI-03) opt-in. Sticky family-section headers and column-headers per Phase 10.

## Out of scope

Cloud-side data storage, multi-tenant SaaS, real-time push, embedded chat, trigger-this-skill buttons, time tracking, auto-updates of the daemon, native dependencies. See `.planning/PROJECT.md` for the full out-of-scope list.
