/** Single source of truth for CoverageFamilySection <th> tooltip copy (Phase 11.2 D-11.2-05).
 *
 * Sibling SoT to coverageColumns.ts. Same locality discipline; future i18n
 * can swap this file's exported strings without touching call sites.
 */

export const coverageColumnTooltips = {
  claudeMd:        'Project AI instructions file. Must exist in repo root for AI coding agents to pick up project conventions.',
  gitNexus:        'Local code index for repo-aware AI search. Built by `gitnexus analyze`; stored under `~/.gitnexus`.',
  wiki:            'Compiled knowledge base from CLAUDE.md, ADRs, READMEs. Built by `/wiki-compile`.',
  workflowVersion: 'Installed version of `agenticapps-workflow`. Compared against the current scaffolder release.',
  understand:      'Understand-anything knowledge graph. Built by `/understand`; stored under `<repo>/.understand-anything/`.',
} as const

export type CoverageColumnWithTooltip = keyof typeof coverageColumnTooltips
