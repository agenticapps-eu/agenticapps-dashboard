# Workflow config — agenticapps-dashboard

This file is the project-specific configuration consumed by
`agentic-apps-workflow` and the `codex-*` gate skills.

## Project metadata

| Field | Value |
|---|---|
| Project name | agenticapps-dashboard |
| Repo | git@github.com:agenticapps-eu/agenticapps-dashboard.git |
| Client | internal |
| Budget tier | internal |
| Backend language | TypeScript |
| Frontend stack | React |
| Database | none |
| LLM provider | Anthropic |

## Gate quality bars

| Gate | Default | This project |
|---|---|---|
| `codex-design-critique` quality bar | ≥ 90 | 90 |
| `codex-impeccable-audit` quality bar | ≥ 90 | 90 |
| `codex-qa` viewport widths | 1280, 390 | 1280, 390 |
| `codex-database-sentinel-audit` blocking severity | Critical, High | Critical, High |

## Backend language routing

| Language | Test runner | TDD commit prefix | Notes |
|---|---|---|---|
| TypeScript | `vitest` | `test(RED):` / `feat(GREEN):` | New public modules also use the declare-first lint/discipline |

## External skill dependencies

Superpowers is installed as the official Codex plugin. The AgenticApps
gate skills, OpenSpec lifecycle skills, and observability skill are
installed through the local `codex-workflow` checkout.

This file contains no secrets and is intended to be committed.
