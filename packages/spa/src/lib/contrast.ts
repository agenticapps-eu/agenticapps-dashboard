/**
 * contrast.ts — pure-JS WCAG 2.1 relative-luminance + contrast-ratio calculator.
 *
 * No React, no DOM, no external deps. Consumed by styles/verify-contrast.test.ts
 * to lock the token-contrast invariant for every text-* token in tokens.css.
 *
 * Reference: WCAG 2.1 §1.4.3 (Contrast Minimum) — https://www.w3.org/TR/WCAG21/
 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const gamma = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * gamma(rgb[0]) + 0.7152 * gamma(rgb[1]) + 0.0722 * gamma(rgb[2])
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const L1 = relativeLuminance(hexToRgb(fgHex))
  const L2 = relativeLuminance(hexToRgb(bgHex))
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (lighter + 0.05) / (darker + 0.05)
}
