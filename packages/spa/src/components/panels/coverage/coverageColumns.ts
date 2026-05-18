/** Single source of truth for CoveragePanel column widths consumed by colgroup + CoverageRow. */

export const COVERAGE_COL_WIDTHS = Object.freeze({
  repo:     'w-72',       // 288px — repo names (max measured 280)
  claudeMd: 'w-32',       // 128px — 4-state freshness + subtext
  gitNexus: 'w-36',       // 144px — max measured 131px > 124px threshold (PD-11.1-06: bumped from w-32)
  // PD-11.2-01: w-[22rem] (352px) → w-72 (288px) — 11.1-IMPECCABLE.md P2 #3, D-11.2-09.
  //   Over-allocated: max measured content 150px (sha+timestamp); 288px = 138px breathing room.
  //   Matches repo column (w-72) for visual rhythm. Net table delta vs Plan 02: −64px.
  wiki:     'w-72',       // 288px — sha + timestamp (max measured 150)
  workflow: 'w-32',       // 128px
  actions:  'w-8',        //  32px — refresh icon only (Plan 04 widens to w-12 for HIG 44px touch target)
} as const)

export type CoverageColumnKey = keyof typeof COVERAGE_COL_WIDTHS
