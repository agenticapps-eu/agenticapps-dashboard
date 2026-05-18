/**
 * contrast.test.ts — TDD tests for the pure-JS WCAG 2.1 contrast calculator.
 *
 * Phase 11.1 Plan 01 Task 1 (RED): specifies the public API for lib/contrast.ts.
 *   - hexToRgb        — '#RRGGBB' parser (case-insensitive, optional leading '#')
 *   - relativeLuminance — WCAG 2.1 relative luminance formula
 *   - contrastRatio   — (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * Anchors:
 *   - black/white → 21:1 (canonical WCAG upper bound)
 *   - mid-gray [128,128,128] → L ≈ 0.21586 (WCAG canonical example)
 *   - current tertiary #807A92 vs app-bg #FAFAF7 → ~3.92:1 (the failing case — below AA)
 *   - candidate tertiary #706B85 vs app-bg #FAFAF7 → ~4.86:1 (the passing case — clears AA)
 */
import { describe, expect, it } from 'vitest'

import { contrastRatio, hexToRgb, relativeLuminance } from './contrast.js'

describe('hexToRgb', () => {
  it('parses pure black #000000 to [0, 0, 0]', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('parses pure white #FFFFFF to [255, 255, 255]', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })

  it('parses mixed-case hex #FaFaF7 to [250, 250, 247] (case-insensitive)', () => {
    expect(hexToRgb('#FaFaF7')).toEqual([250, 250, 247])
  })

  it('parses hex without the leading "#" (FaFaF7) to [250, 250, 247]', () => {
    expect(hexToRgb('FaFaF7')).toEqual([250, 250, 247])
  })

  it('throws on malformed input ("nothex")', () => {
    expect(() => hexToRgb('nothex')).toThrow()
  })
})

describe('relativeLuminance', () => {
  it('returns 0 for black [0, 0, 0]', () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 9)
  })

  it('returns 1 for white [255, 255, 255]', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 9)
  })

  it('returns ~0.21586 for mid-gray [128, 128, 128] (WCAG canonical)', () => {
    expect(relativeLuminance([128, 128, 128])).toBeCloseTo(0.21586, 3)
  })
})

describe('contrastRatio', () => {
  it('returns ~21:1 for black foreground on white background', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })

  it('returns ~21:1 for white foreground on black background (symmetric)', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2)
  })

  it('returns exactly 1 for identical foreground and background', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  })

  it('returns ~3.92:1 for the current tertiary #807A92 on app-bg #FAFAF7 (failing case — below AA 4.5)', () => {
    expect(contrastRatio('#807A92', '#FAFAF7')).toBeCloseTo(3.92, 2)
  })

  it('returns ~4.86:1 for the chosen tertiary #706B85 on app-bg #FAFAF7 (passing case — clears AA 4.5)', () => {
    expect(contrastRatio('#706B85', '#FAFAF7')).toBeCloseTo(4.86, 2)
  })
})
