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
import { CHECK_STATUSES } from '@agenticapps/dashboard-shared'

import { contrastRatio, hexToRgb } from '../lib/contrast.js'
import { STATUS_PRESENTATION } from '../components/panels/readiness/ReadinessIndicator.js'

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
 *
 * Comments are blanked before the search rather than searched through. The
 * first literal `.dark` in tokens.css is prose, 22 lines above the rule it
 * describes; a plain indexOf lands there and only reaches the real block
 * because no `{` happens to sit in between. Add one — a comment mentioning
 * `.dark { }` — and every dark assertion silently re-parses the light palette
 * and passes. A test that reports 82 green assertions about a palette it never
 * read is worse than no test, so this failure mode is closed rather than
 * documented. Blanking (not deleting) keeps every offset intact.
 */
function blockBody(css: string, selector: string): string {
  const searchable = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))
  const start = searchable.indexOf(selector)
  if (start === -1) throw new Error(`no ${selector} block in tokens.css`)
  const open = searchable.indexOf('{', start)
  if (open === -1) throw new Error(`${selector} has no opening brace`)
  let depth = 0
  for (let i = open; i < searchable.length; i++) {
    if (searchable[i] === '{') depth++
    else if (searchable[i] === '}') {
      depth--
      // Slice the ORIGINAL: declarations() strips comments itself, and the
      // offsets match because blanking preserved every length.
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
/**
 * The opaque surfaces a filled control actually sits on, verified by grep:
 * modals and cards (`card-bg`), toolbars and routes (`app-bg`), and the sidebar
 * active pill (`sidebar-bg`). `card-bg-hover` is deliberately absent — no filled
 * control renders on a hovered card, and asserting it would move a value for a
 * rendering that never happens (D-5).
 *
 * Every fill is checked, resting and hover alike. A hover fill that darkened
 * until the control's edge vanished into the page would otherwise pass CI:
 * hover fills were previously checked only for white legibility, which a
 * too-dark fill satisfies trivially.
 */
const FILL_SURFACES = ['app-bg', 'card-bg', 'sidebar-bg'] as const

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

    // `border-subtle` is a border token, but UnderstandCopyPill uses it as the
    // hover ground under a text label — the one place a border token carries
    // text. It is asserted here rather than added to SURFACES because nothing
    // else renders on it, and widening SURFACES would assert 30 pairings that
    // never occur (D-5). text-secondary measured 4.494 here in light — short of
    // the floor by 0.006 — which is why the pill raises its label on hover.
    it(`text-primary clears ${BODY_TEXT}:1 on border-subtle`, () => {
      expect(
        contrastRatio(appear.colour('text-primary'), appear.colour('border-subtle')),
      ).toBeGreaterThanOrEqual(BODY_TEXT)
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

      for (const fill of FILLS) {
        for (const surface of FILL_SURFACES) {
          it(`${fill} clears ${NON_TEXT}:1 against ${surface} so the control edge reads`, () => {
            expect(
              contrastRatio(appear.colour(fill), appear.colour(surface)),
            ).toBeGreaterThanOrEqual(NON_TEXT)
          })
        }
      }
    })

    /**
     * The readiness cells, read out of the component's own map rather than
     * restated here. Six statuses share four pairings, and every one of them is
     * a tint of a token under text — the shape this file exists to catch.
     *
     * Driving the loop from `STATUS_PRESENTATION` is the point. The pairings it
     * currently uses are each asserted above by other names, so copying them
     * into a list would assert nothing new and would keep passing after the
     * component moved off them. This fails when the component changes, which is
     * the only moment the question is live.
     */
    describe('readiness cells', () => {
      for (const status of CHECK_STATUSES) {
        const { bg, text } = STATUS_PRESENTATION[status]
        const [bgToken, alpha] = bg.replace(/^bg-/, '').split('/')
        const textToken = text.replace(/^text-/, '')

        it(`${status} declares a tinted background, not an opaque fill`, () => {
          expect(alpha).toBeDefined()
        })

        for (const surface of SURFACES) {
          it(`${status} clears ${BODY_TEXT}:1 — ${text} on ${bg} over ${surface}`, () => {
            expect(
              contrastRatio(
                appear.colour(textToken),
                tint(
                  appear.colour(bgToken as string),
                  appear.colour(surface),
                  Number(alpha) / 100,
                ),
              ),
            ).toBeGreaterThanOrEqual(BODY_TEXT)
          })

          /**
           * The full variant renders the check's value in `text-secondary` on
           * the SAME status tint, which is a second pairing the cell introduces
           * and the loop above does not reach — it only ever checks a status
           * colour against its own tint.
           *
           * It is the tightest pairing in the palette: `status-error/10` over
           * `sidebar-bg` measures 4.551:1 in light, 0.051 above the floor.
           * Nothing would have caught a status token darkening past it.
           */
          it(`${status}'s value clears ${BODY_TEXT}:1 — text-secondary on ${bg} over ${surface}`, () => {
            expect(
              contrastRatio(
                appear.colour('text-secondary'),
                tint(
                  appear.colour(bgToken as string),
                  appear.colour(surface),
                  Number(alpha) / 100,
                ),
              ),
            ).toBeGreaterThanOrEqual(BODY_TEXT)
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

  // A black drop shadow over a near-black ground casts nothing — there is
  // nothing darker to cast onto. Depth on a dark ground comes from light
  // catching the upper edge, so the dark elevation carries an inset highlight
  // rather than a larger black blur. Asserted because the failure is invisible:
  // the token still exists, still parses, and simply does nothing.
  it('gives the dark appearance an elevation that is not a pure black drop shadow', () => {
    const dark = APPEARANCES.find((a) => a.name === 'dark') as Appearance
    expect(dark.all.get('--shadow-card')).toMatch(/inset/)
  })

  // Without color-scheme, UA-rendered chrome — scrollbars, and the native radio
  // inputs in ThemeToggle itself — stays light-styled in dark, so the appearance
  // control visibly fails to restyle its own controls.
  it('declares a colour scheme for each appearance so UA chrome follows', () => {
    expect(property(':root', 'color-scheme')).toBe('light')
    expect(property('.dark', 'color-scheme')).toBe('dark')
  })

  // `:root` and `.dark` are both specificity (0,1,0), so whichever is written
  // last wins. Declaring both is not enough — with `.dark` first, `:root`
  // overrides it and the browser renders light-scheme scrollbars and radios on
  // a dark page. Caught in the browser, not by the assertion above, which is
  // why source order is asserted rather than assumed.
  it('orders .dark after :root so equal-specificity rules resolve to dark', () => {
    // Match the RULES, not the first mention. tokensCss discusses `.dark` in
    // prose well above the block, so a raw indexOf compares a comment against a
    // rule — it fails on a harmless sentence, and would equally be satisfied by
    // one while the real blocks were the wrong way round.
    const ruleAt = (sel: string): number =>
      tokensCss
        .replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))
        .search(new RegExp(`(^|\\n)\\s*${sel.replace('.', '\\.')}\\s*\\{`))
    expect(ruleAt('.dark')).toBeGreaterThan(ruleAt(':root'))
  })
})
