/**
 * helpRouteTable — single source of truth for the /help/* route tree.
 *
 * Discriminated union of 5 entry kinds. Plan 07-05 Task 3's buildHelpRoutes
 * factory turns this table into TanStack createRoute() instances.
 *
 * Counts: 1 index + 5 anchor (4 v1.0 overview anchors + HELP-06 shortcuts) + 32 stubs
 * (workflow 11 incl. D-7-13 + repos 6 + observability 7 + operations 4 +
 * reference 4) + 4 redirects + 1 catch-all = 43 total entries.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-06, D-7-13
 */
export type HelpRouteEntry =
  | { kind: 'index' }
  | {
      kind: 'anchor'
      path: string
      lazyImport: () => Promise<{ Route: unknown }>
    }
  | { kind: 'stub'; path: string; section: string; title: string }
  | { kind: 'redirect'; from: string; to: string }
  | { kind: 'catchAll'; to: string }

// ── Stubs (32 entries) ──────────────────────────────────────────────
const STUBS: { path: string; section: string; title: string }[] = [
  // Workflow (11 — includes 2 D-7-13 additions: rationalization-table, red-flags)
  { path: '/help/workflow/commitment-ritual', section: 'workflow', title: 'Commitment Ritual' },
  { path: '/help/workflow/gates', section: 'workflow', title: 'Gates' },
  { path: '/help/workflow/superpowers', section: 'workflow', title: 'Superpowers' },
  { path: '/help/workflow/gsd', section: 'workflow', title: 'GSD' },
  { path: '/help/workflow/gstack', section: 'workflow', title: 'gstack' },
  { path: '/help/workflow/impeccable', section: 'workflow', title: 'Impeccable' },
  { path: '/help/workflow/two-stage-review', section: 'workflow', title: 'Two-Stage Review' },
  { path: '/help/workflow/verification', section: 'workflow', title: 'Verification' },
  { path: '/help/workflow/adrs', section: 'workflow', title: 'ADRs' },
  {
    path: '/help/workflow/rationalization-table',
    section: 'workflow',
    title: 'Rationalization table',
  },
  { path: '/help/workflow/red-flags', section: 'workflow', title: 'Red flags' },
  // Repos (6)
  { path: '/help/repos/core', section: 'repos', title: 'core' },
  { path: '/help/repos/claude', section: 'repos', title: 'claude-workflow' },
  { path: '/help/repos/pi', section: 'repos', title: 'pi-workflow' },
  { path: '/help/repos/codex', section: 'repos', title: 'codex-workflow' },
  { path: '/help/repos/dashboard', section: 'repos', title: 'dashboard' },
  { path: '/help/repos/projects', section: 'repos', title: 'Client projects' },
  // Observability (7)
  {
    path: '/help/observability/spec-section-10',
    section: 'observability',
    title: 'Spec §10 walkthrough',
  },
  { path: '/help/observability/stacks', section: 'observability', title: 'Stack templates' },
  { path: '/help/observability/install', section: 'observability', title: 'Install' },
  { path: '/help/observability/scan', section: 'observability', title: 'Scan' },
  { path: '/help/observability/apply', section: 'observability', title: 'Apply' },
  { path: '/help/observability/policy', section: 'observability', title: 'Policy' },
  {
    path: '/help/observability/pi-codex-status',
    section: 'observability',
    title: 'Pi & Codex status',
  },
  // Operations (4)
  { path: '/help/operations/update', section: 'operations', title: 'Updating' },
  {
    path: '/help/operations/slash-commands',
    section: 'operations',
    title: 'Slash command catalog',
  },
  { path: '/help/operations/troubleshooting', section: 'operations', title: 'Troubleshooting' },
  {
    path: '/help/operations/migration-runbook',
    section: 'operations',
    title: 'Migration runbook',
  },
  // Reference (4) — Keyboard shortcuts is an ANCHOR, not a stub
  { path: '/help/reference/glossary', section: 'reference', title: 'Glossary' },
  { path: '/help/reference/adr-index', section: 'reference', title: 'ADR index' },
  { path: '/help/reference/changelog', section: 'reference', title: 'Changelog' },
  { path: '/help/reference/contributing', section: 'reference', title: 'Contributing' },
]

export const helpRouteTable: HelpRouteEntry[] = [
  { kind: 'index' },
  // 4 v1.0 overview anchors + HELP-06 shortcuts = 5 anchors
  {
    kind: 'anchor',
    path: '/help/workflow/overview',
    lazyImport: () => import('./pages/workflow.overview.lazy.js'),
  },
  {
    kind: 'anchor',
    path: '/help/repos/overview',
    lazyImport: () => import('./pages/repos.overview.lazy.js'),
  },
  {
    kind: 'anchor',
    path: '/help/observability/overview',
    lazyImport: () => import('./pages/observability.overview.lazy.js'),
  },
  {
    kind: 'anchor',
    path: '/help/operations/install',
    lazyImport: () => import('./pages/operations.install.lazy.js'),
  },
  {
    kind: 'anchor',
    path: '/help/reference/shortcuts',
    lazyImport: () => import('./pages/reference.shortcuts.lazy.js'),
  },
  // 32 stubs
  ...STUBS.map(({ path, section, title }) => ({
    kind: 'stub' as const,
    path,
    section,
    title,
  })),
  // 4 redirects
  { kind: 'redirect', from: '/help/workflow', to: '/help/workflow/overview' },
  { kind: 'redirect', from: '/help/repos', to: '/help/repos/overview' },
  { kind: 'redirect', from: '/help/observability', to: '/help/observability/overview' },
  { kind: 'redirect', from: '/help/operations', to: '/help/operations/install' },
  // 1 catch-all
  { kind: 'catchAll', to: '/help' },
]
