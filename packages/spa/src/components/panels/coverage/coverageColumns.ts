/** Single source of truth for CoveragePanel column widths consumed by colgroup + CoverageRow. */

export const COVERAGE_COL_WIDTHS = Object.freeze({
  repo:     'w-72',       // 288px — repo names (max measured 280)
  claudeMd: 'w-32',       // 128px — 4-state freshness + subtext
  gitNexus: 'w-36',       // 144px — max measured 131px > 124px threshold (PD-11.1-06: bumped from w-32)
  wiki:     'w-[22rem]',  // 352px — sha + timestamp (max measured 364, truncates cleanly)
  workflow: 'w-32',       // 128px
  actions:  'w-8',        //  32px — refresh icon only
} as const)

export type CoverageColumnKey = keyof typeof COVERAGE_COL_WIDTHS
