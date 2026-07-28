/** Single source of truth for CoveragePanel column widths consumed by colgroup + CoverageRow. */

export const COVERAGE_COL_WIDTHS = Object.freeze({
  repo:     'w-72',       // 288px — repo names (max measured 280)
  claudeMd: 'w-32',       // 128px — freshness + subtext
  workflow: 'w-32',       // 128px
  understand: 'w-48',     // 192px — viewer link + /understand copy pill
} as const)

export type CoverageColumnKey = keyof typeof COVERAGE_COL_WIDTHS
