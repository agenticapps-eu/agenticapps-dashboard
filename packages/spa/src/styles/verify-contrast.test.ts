// @vitest-environment node
/**
 * verify-contrast.test.ts — Token-contrast invariant (Phase 11.1 Plan 01 Task 3).
 *
 * Locks every text-* token in tokens.css against the WCAG 2.1 AA floor (4.5:1
 * body text) for BOTH the app background and the sidebar background. Future
 * token edits that regress contrast fail this test.
 *
 * Closes the v1.0.1 -> v1.1 regression class: the v1.0.1 bump from #9C95A8
 * (2.8:1) to #807A92 (3.92:1) cleared only the impeccable detector's 3:1
 * heuristic, NOT the WCAG body-text floor — this test would have caught it.
 *
 * Source of truth: tokens.css is parsed via readFileSync + regex (no real CSS
 * parser needed; the only patterns we read are `--color-NAME: #HEX;` lines).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { contrastRatio } from '../lib/contrast.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokens = readFileSync(resolve(__dirname, './tokens.css'), 'utf-8')

function extractToken(name: string): string {
  const match = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!match) throw new Error(`token --color-${name} not found in tokens.css`)
  return match[1] as string
}

const APP_BG = extractToken('app-bg')
const SIDEBAR_BG = extractToken('sidebar-bg')

describe('Token contrast invariant (WCAG 2.1 AA body text)', () => {
  const tiers: Array<{ name: string; minRatio: number }> = [
    { name: 'text-primary', minRatio: 13.0 },
    { name: 'text-secondary', minRatio: 4.5 },
    { name: 'text-tertiary', minRatio: 4.5 },
  ]

  for (const { name, minRatio } of tiers) {
    const hex = extractToken(name)
    it(`--color-${name} (${hex}) clears ${minRatio}:1 vs app-bg (${APP_BG})`, () => {
      expect(contrastRatio(hex, APP_BG)).toBeGreaterThanOrEqual(minRatio)
    })
    it(`--color-${name} (${hex}) clears ${minRatio}:1 vs sidebar-bg (${SIDEBAR_BG})`, () => {
      expect(contrastRatio(hex, SIDEBAR_BG)).toBeGreaterThanOrEqual(minRatio)
    })
  }
})
