// @vitest-environment node
/**
 * verify-contrast.test.ts — the contrast invariant, across every appearance.
 *
 * Locks every text-bearing colour token against its WCAG 2.1 floor, on every
 * background it actually renders on, in every appearance tokens.css ships.
 *
 * Three things distinguish this from the assertion it replaces, each of which
 * was a hole a real defect had already fallen through:
 *
 *   1. Both appearances. The product defaults to dark (lib/theme.ts D-02) and
 *      shipped the light palette in every theme, so half the product was
 *      unasserted because it did not exist.
 *   2. Every background, not two of four. `card-bg` and `card-bg-hover` carry
 *      text everywhere, and were never checked.
 *   3. Tinted and filled surfaces. `bg-status-warning/10` under
 *      `text-status-warning` is a background; so is a filled button under
 *      white text. Both were invisible to a test that only knew about opaque
 *      surface tokens — which is how --color-status-warning shipped at 3.03:1.
 *
 * The matrix is built from pairings that OCCUR in packages/spa/src, verified by
 * grep, not from a cartesian product. `status-info` has no tinted surface
 * anywhere; asserting one would move a value for a rendering that never happens.
 *
 * Source of truth: tokens.css, parsed here. Deliberately a node-environment
 * file-parsing test — jsdom does not run Tailwind, so computed-style assertions
 * would assert nothing.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { contrastRatio, hexToRgb } from '../lib/contrast.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(resolve(__dirname, './tokens.css'), 'utf-8')

/** WCAG floors. */
const BODY_TEXT = 4.5
/** text-primary is held far above AA; the tier design depends on the headroom. */
const PRIMARY_TEXT = 13.0
/** WCAG 1.4.11 — a control must be distinguishable from the surface behind it. */
const NON_TEXT = 3.0

/** Text placed on a fill at a luminance the palette does not control. */
const WHITE = '#FFFFFF'

/**
 * Return the body of a CSS block by its opening selector, matching braces so a
 * nested rule cannot truncate it early.
 */
function blockBody(css: string, selector: string): string {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`no ${selector} block in tokens.css`)
  const open = css.indexOf('{', start)
  if (open === -1) throw new Error(`${selector} has no opening brace`)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error(`${selector} block is unterminated`)
}

/** Every `--name: value;` declaration in a block, comments stripped. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1] as string, (m[2] as string).trim())
  }
  return out
}

/** A plain CSS property, for declarations that are not custom properties. */
function property(selector: string, name: string): string | undefined {
  const body = blockBody(tokensCss, selector).replace(/\/\*[\s\S]*?\*\//g, '')
  const m = body.match(new RegExp(`(?:^|[\\s;])${name}\\s*:\\s*([^;]+);`))
  return m ? (m[1] as string).trim() : undefined
}

/**
 * Which tokens depend on the ground they render against. Radii, fonts and the
 * type scale live in @theme too but mean the same thing in every appearance, so
 * requiring each appearance to restate them would be noise, not safety.
 */
const APPEARANCE_SCOPED = /^--(color|shadow)-/

interface Appearance {
  readonly name: string
  /** the appearance-scoped declarations, for the completeness assertion */
  readonly all: Map<string, string>
  /** colour tokens by short name, e.g. 'app-bg' */
  readonly colour: (name: string) => string
}

function appearance(name: string, selector: string): Appearance {
  const every = declarations(blockBody(tokensCss, selector))
  const all = new Map([...every].filter(([k]) => APPEARANCE_SCOPED.test(k)))
  return {
    name,
    all,
    colour(short) {
      const value = all.get(`--color-${short}`)
      if (value === undefined) {
        throw new Error(`appearance "${name}" does not define --color-${short}`)
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        throw new Error(`--color-${short} in "${name}" is not a 6-digit hex: ${value}`)
      }
      return value
    },
  }
}

const APPEARANCES: readonly Appearance[] = [
  appearance('light', '@theme'),
  appearance('dark', '.dark'),
]

/**
 * Composite `fg` over `bg` at `alpha` — what Tailwind's `bg-token/NN` actually
 * paints. Contrast against the composited result is the real pairing; contrast
 * against the underlying surface is not.
 */
function tint(fg: string, bg: string, alpha: number): string {
  const f = hexToRgb(fg)
  const b = hexToRgb(bg)
  const channel = (i: number): string =>
    Math.round((f[i] as number) * alpha + (b[i] as number) * (1 - alpha))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(0)}${channel(1)}${channel(2)}`
}

/** The opaque surfaces text renders on. */
const SURFACES = ['app-bg', 'sidebar-bg', 'card-bg', 'card-bg-hover'] as const

/** Foregrounds, with the floor each is held to. */
const FOREGROUNDS: ReadonlyArray<readonly [string, number]> = [
  ['text-primary', PRIMARY_TEXT],
  ['text-secondary', BODY_TEXT],
  ['text-tertiary', BODY_TEXT],
  ['status-success', BODY_TEXT],
  ['status-warning', BODY_TEXT],
  ['status-error', BODY_TEXT],
  ['status-info', BODY_TEXT],
  ['accent', BODY_TEXT],
]

/**
 * Tokens rendered as text on a tint of themselves, at the alphas the SPA uses.
 * Verified usages: bg-status-{success,warning,error}/10 and /8, bg-accent/10.
 */
const SELF_TINTED: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['status-success', [0.1, 0.08]],
  ['status-warning', [0.1, 0.08]],
  ['status-error', [0.1, 0.08]],
  ['accent', [0.1]],
]

/** Fill-role tokens, each of which carries white text. */
const FILLS = [
  'accent-bg-strong',
  'accent-bg-strong-hover',
  'status-error-strong',
  'status-error-strong-hover',
] as const

/** The resting fills must also be visible against the page behind them. */
const RESTING_FILLS = ['accent-bg-strong', 'status-error-strong'] as const

describe.each(APPEARANCES.map((a) => [a.name, a] as const))(
  'contrast floors — %s appearance',
  (_name, appear) => {
    describe('text on opaque surfaces', () => {
      for (const [token, floor] of FOREGROUNDS) {
        for (const surface of SURFACES) {
          it(`${token} clears ${floor}:1 on ${surface}`, () => {
            expect(
              contrastRatio(appear.colour(token), appear.colour(surface)),
            ).toBeGreaterThanOrEqual(floor)
          })
        }
      }
    })

    describe('text on a tint of itself', () => {
      for (const [token, alphas] of SELF_TINTED) {
        for (const alpha of alphas) {
          for (const surface of SURFACES) {
            it(`${token} clears ${BODY_TEXT}:1 on ${token}/${alpha * 100} over ${surface}`, () => {
              const fg = appear.colour(token)
              expect(
                contrastRatio(fg, tint(fg, appear.colour(surface), alpha)),
              ).toBeGreaterThanOrEqual(BODY_TEXT)
            })
          }
        }
      }
    })

    describe('text on tinted and filled surfaces', () => {
      it(`accent clears ${BODY_TEXT}:1 on accent-bg`, () => {
        expect(
          contrastRatio(appear.colour('accent'), appear.colour('accent-bg')),
        ).toBeGreaterThanOrEqual(BODY_TEXT)
      })

      // CoverageCell's "scan failed" chip is drawn as bg-text-tertiary/10, and
      // labels itself one tier up. A 10% tint of a colour under that same colour
      // is inherently ~4:1 unless the colour is saturated — the status colours
      // clear it only because they are — so tertiary-on-tertiary/10 measured
      // 4.17 in light. Raising the label rather than flattening the chip keeps it
      // legible without making it invisible against the card (1.05:1).
      for (const surface of SURFACES) {
        it(`text-secondary clears ${BODY_TEXT}:1 on text-tertiary/10 over ${surface}`, () => {
          expect(
            contrastRatio(
              appear.colour('text-secondary'),
              tint(appear.colour('text-tertiary'), appear.colour(surface), 0.1),
            ),
          ).toBeGreaterThanOrEqual(BODY_TEXT)
        })
      }

      for (const fill of FILLS) {
        it(`white clears ${BODY_TEXT}:1 on ${fill}`, () => {
          expect(contrastRatio(WHITE, appear.colour(fill))).toBeGreaterThanOrEqual(BODY_TEXT)
        })
      }

      for (const fill of RESTING_FILLS) {
        for (const surface of ['app-bg', 'card-bg'] as const) {
          it(`${fill} clears ${NON_TEXT}:1 against ${surface} so the control edge reads`, () => {
            expect(
              contrastRatio(appear.colour(fill), appear.colour(surface)),
            ).toBeGreaterThanOrEqual(NON_TEXT)
          })
        }
      }
    })

    it('keeps secondary and tertiary text perceptibly apart', () => {
      const secondary = contrastRatio(appear.colour('text-secondary'), appear.colour('app-bg'))
      const tertiary = contrastRatio(appear.colour('text-tertiary'), appear.colour('app-bg'))
      expect(secondary).toBeGreaterThan(tertiary)
      expect(secondary / tertiary).toBeGreaterThanOrEqual(1.1)
    })
  },
)

describe('appearance completeness', () => {
  it('every appearance defines exactly the same appearance-scoped tokens', () => {
    const [first, ...rest] = APPEARANCES as Appearance[]
    const reference = new Set((first as Appearance).all.keys())
    for (const other of rest) {
      const missing = [...reference].filter((k) => !other.all.has(k)).sort()
      const extra = [...other.all.keys()].filter((k) => !reference.has(k)).sort()
      expect(
        { appearance: other.name, missing, extra },
        `"${other.name}" must define the same tokens as "${(first as Appearance).name}"`,
      ).toEqual({ appearance: other.name, missing: [], extra: [] })
    }
  })

  it('covers non-colour appearance-scoped tokens, not colours alone', () => {
    for (const appear of APPEARANCES) {
      expect(appear.all.has('--shadow-card'), `${appear.name} defines --shadow-card`).toBe(true)
    }
  })

  // Without color-scheme, UA-rendered chrome — scrollbars, and the native radio
  // inputs in ThemeToggle itself — stays light-styled in dark, so the appearance
  // control visibly fails to restyle its own controls.
  it('declares a colour scheme for each appearance so UA chrome follows', () => {
    expect(property(':root', 'color-scheme')).toBe('light')
    expect(property('.dark', 'color-scheme')).toBe('dark')
  })
})
