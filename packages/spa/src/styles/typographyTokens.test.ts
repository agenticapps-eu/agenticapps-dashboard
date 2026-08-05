// @vitest-environment node
/**
 * typographyTokens.test.ts — the automated check named by `retire-v1-surfaces`
 * for `design-system` → **A Bounded Type Scale**.
 *
 * The requirement binds two halves and this file exercises both:
 *
 *   1. "Sizes and weights SHALL come from enumerated design tokens" — the
 *      enumeration is read out of tokens.css rather than restated here, so the
 *      token file stays the single source of truth (same contract as
 *      tokenSourceOfTruth.test.ts holds for colour).
 *   2. "a component MUST NOT introduce a value outside them" — the MUST NOT,
 *      which until now had no oracle at all. Round-1 and round-3 reviewers both
 *      flagged that the scenario asserted an outcome and named no mechanism.
 *      This file is that mechanism.
 *
 * It also holds the two-family rule: exactly one interface family and one
 * monospace family are declared, and no component may reach for a third.
 *
 * Scope: production `.ts`/`.tsx` under src/components/** and src/help/**.
 * Test files are excluded — a test asserting `text-4xl` is rejected must be
 * able to write `text-4xl`.
 *
 * The scanner is a pure function over file text so it can be given synthetic
 * input below and proven to fail. A static invariant that has never been
 * watched rejecting anything is indistinguishable from one that matches
 * nothing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(STYLES_DIR, '..', 'components')
const HELP_DIR = resolve(STYLES_DIR, '..', 'help')
const TOKENS_FILE = resolve(STYLES_DIR, 'tokens.css')

/**
 * Every font-size utility Tailwind ships by default. A name in this list is
 * *size-shaped*: seeing it after `text-` means a size was requested, so it must
 * resolve to a token. Names outside it (`text-text-primary`, `text-right`,
 * `text-accent`) are colour or alignment and are none of this file's business.
 */
const SIZE_SHAPED = [
  'xs',
  'sm',
  'base',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
]

/** Every font-weight utility Tailwind ships by default. */
const WEIGHT_SHAPED = [
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
]

/** Every font-family utility Tailwind ships by default. */
const FAMILY_SHAPED = ['sans', 'serif', 'mono']

interface TokenSet {
  sizes: string[]
  weights: string[]
  families: string[]
}

/**
 * Read the enumeration out of tokens.css.
 *
 * `--font-weight-normal:` cannot match the family pattern because the capture
 * stops at the first hyphen, so the two namespaces separate without an
 * exclusion list.
 */
export function readTokenSet(css: string): TokenSet {
  const collect = (re: RegExp): string[] => {
    const out: string[] = []
    for (const m of css.matchAll(re)) out.push(m[1]!)
    return out
  }
  return {
    sizes: collect(/^\s*--text-([a-z0-9]+):/gm),
    weights: collect(/^\s*--font-weight-([a-z]+):/gm),
    families: collect(/^\s*--font-([a-z]+):/gm),
  }
}

/**
 * Return every typography value in `content` that is not one of the enumerated
 * tokens. An empty array is conformance.
 */
export function collectTypographyViolations(content: string, tokens: TokenSet): string[] {
  const found: string[] = []

  // Two branches rather than one alternation with a trailing `\b`: a `]`
  // followed by a quote is two non-word characters, so `\b` never fires there
  // and every arbitrary value would slip past unseen. The bare-word branch
  // carries its own boundary, and `(?![\w-])` is what stops `text-text-primary`
  // from being read as the size `text`.
  for (const m of content.matchAll(/\btext-(?:(\[[^\]]+\])|([a-z0-9]+)(?![\w-]))/g)) {
    const value = (m[1] ?? m[2])!
    if (value.startsWith('[')) {
      found.push(`text-${value} (arbitrary size — the scale is enumerated, not open)`)
    } else if (SIZE_SHAPED.includes(value) && !tokens.sizes.includes(value)) {
      found.push(`text-${value} (no --text-${value} token)`)
    }
  }

  for (const m of content.matchAll(/\bfont-(?:(\[[^\]]+\])|([a-z]+)(?![\w-]))/g)) {
    const value = (m[1] ?? m[2])!
    if (value.startsWith('[')) {
      found.push(`font-${value} (arbitrary weight or family)`)
    } else if (WEIGHT_SHAPED.includes(value) && !tokens.weights.includes(value)) {
      found.push(`font-${value} (no --font-weight-${value} token)`)
    } else if (FAMILY_SHAPED.includes(value) && !tokens.families.includes(value)) {
      found.push(`font-${value} (no --font-${value} token — the product declares two families)`)
    }
  }

  // A style object sidesteps the utility layer entirely, so the class scan
  // above would never see it.
  for (const m of content.matchAll(/\bfont(Size|Weight|Family)\s*:/g)) {
    found.push(`inline font${m[1]!} (typography must come from the token utilities)`)
  }

  return found
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      out.push(...walk(p))
    } else if (
      ['.ts', '.tsx'].includes(extname(p)) &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx')
    ) {
      out.push(p)
    }
  }
  return out
}

const tokens = readTokenSet(readFileSync(TOKENS_FILE, 'utf8'))

describe('design-system → A Bounded Type Scale — the scale is enumerable', () => {
  it('tokens.css enumerates the permitted sizes as named tokens', () => {
    expect(tokens.sizes).toEqual(['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'])
  })

  it('tokens.css enumerates the permitted weights as named tokens', () => {
    expect(tokens.weights).toEqual(['normal', 'medium', 'semibold'])
  })

  it('tokens.css declares exactly two families — one interface, one monospace', () => {
    expect(tokens.families).toEqual(['sans', 'mono'])
  })
})

describe('design-system → A Bounded Type Scale — a value outside the scale is rejected', () => {
  // The positive control. Without it a green suite proves only that the
  // scanner found nothing, never that it is capable of finding anything.
  it('the scanner rejects an arbitrary size, an untokenised size, a third family and an inline style', () => {
    const offending = [
      '<span className="text-[10px]">a</span>',
      '<span className="text-4xl">b</span>',
      '<span className="font-serif">c</span>',
      '<span style={{ fontSize: 13 }}>d</span>',
    ].join('\n')

    expect(collectTypographyViolations(offending, tokens)).toEqual([
      'text-[10px] (arbitrary size — the scale is enumerated, not open)',
      'text-4xl (no --text-4xl token)',
      'font-serif (no --font-serif token — the product declares two families)',
      'inline fontSize (typography must come from the token utilities)',
    ])
  })

  it('the scanner leaves colour and alignment utilities alone', () => {
    const legitimate =
      '<span className="text-sm font-medium text-text-primary text-right font-mono">a</span>'
    expect(collectTypographyViolations(legitimate, tokens)).toEqual([])
  })

  it('no production component declares typography outside the token set', () => {
    const files = [...walk(COMPONENTS_DIR), ...walk(HELP_DIR)]
    const offenders: { file: string; violations: string[] }[] = []
    for (const f of files) {
      const violations = collectTypographyViolations(readFileSync(f, 'utf8'), tokens)
      if (violations.length > 0) offenders.push({ file: f, violations })
    }
    expect(offenders).toEqual([])
  })
})
