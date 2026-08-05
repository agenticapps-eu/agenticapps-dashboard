// @vitest-environment node
/**
 * fillRole.test.ts — foreground tokens are not used as fills under white text.
 *
 * A colour that reads as text on the page ground and a colour that sits behind
 * white text impose opposite luminance constraints. The light appearance
 * satisfies both with one value by coincidence — its ground is light and its
 * accent is dark — so the conflation was invisible until a dark appearance
 * existed. In dark, `text-white` on `bg-accent` measures 2.75:1.
 *
 * The palette separates the roles (`--color-accent` foreground,
 * `--color-accent-bg-strong` fill). This test stops a component quietly putting
 * them back together: verify-contrast.test.ts can only assert the pairings it is
 * told about, and it cannot know that a component decided to place white text on
 * a foreground token.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(STYLES_DIR, '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (
      ['.ts', '.tsx'].includes(extname(p)) &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx')
    ) {
      out.push(p)
    }
  }
  return out
}

/**
 * Tokens whose role is foreground. Matched so that the fill-role siblings —
 * `bg-accent-bg-strong`, `bg-status-error-strong` — do not trip the check, and
 * so that opacity modifiers (`bg-accent/10`, a tinted surface rather than a
 * fill) are left alone.
 */
const FOREGROUND_AS_FILL =
  /\b(?:hover:|focus:|active:|group-hover:)?bg-(?:accent|accent-hover|status-error|status-warning|status-success|status-info)(?![\w/-])/

/**
 * Text colours that do not follow the fill. `text-white` is fixed outright;
 * `text-card-bg` and `text-app-bg` invert with the appearance, which makes them
 * legible in both but does not make the fill correct — a control painted with
 * the foreground token is a different purple from the twelve painted with the
 * fill token, and in dark that divergence is plainly visible side by side.
 */
const FIXED_ROLE_TEXT = /\btext-(?:white|card-bg|app-bg)(?![\w/-])/

/**
 * A class list is any quoted string long enough to hold several utilities.
 *
 * Scope, stated plainly because it bounds what the assertion is worth: this
 * matches one quoted string at a time, so it catches a pairing a component
 * wrote adjacently and not one split across two concatenated literals. cn()/
 * clsx/CVA are banned by D-5.1-10, which removes the usual way that happens,
 * but array-join composition is used here (`ManualPairForm.tsx:225`) and a
 * determined split would evade this. The check is a floor, not a proof.
 *
 * Widening to file scope was tried and reverted — it flagged `SidebarSubItem`,
 * where `bg-status-success` was a status dot carrying no text and the file's
 * `text-white` sat on `bg-accent-bg-strong` two branches away. A check that
 * cannot tell a dot from a fill costs more than the case it would catch.
 *
 * `SidebarSubItem` was deleted with the sidebar's project list
 * (`retire-v1-surfaces`), so the counter-example that settled this no longer
 * exists. Whether file scope is affordable now is an open question, not a
 * settled no — it needs re-testing against the surviving components rather
 * than inheriting a verdict about a file that is gone.
 */
const CLASS_STRINGS = /(['"`])((?:[^'"`\\\n]|\\.){8,}?)\1/g

describe('fill and foreground roles stay separate', () => {
  const files = walk(SRC_DIR)

  it('no component places fixed-role text on a foreground-role token', () => {
    const offenders: { file: string; classes: string }[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const [, , classes] of source.matchAll(CLASS_STRINGS)) {
        const value = classes as string
        if (!FIXED_ROLE_TEXT.test(value)) continue
        if (!FOREGROUND_AS_FILL.test(value)) continue
        offenders.push({
          file: relative(SRC_DIR, file),
          classes: value.replace(/\s+/g, ' ').trim().slice(0, 120),
        })
      }
    }
    expect(offenders).toEqual([])
  })

  it('no component fills with a Tailwind built-in colour that no appearance controls', () => {
    // `hover:bg-red-700` follows Tailwind's own palette, so it stays put while
    // the surrounding status colour changes with the appearance.
    const builtIn =
      /\b(?:hover:|focus:|active:|group-hover:)?(?:bg|text|border)-(?:red|green|blue|slate|gray|zinc|neutral|stone|amber|yellow|emerald|teal|cyan|sky|indigo|violet|fuchsia|pink|rose|orange|lime)-[0-9]{2,3}\b/
    const offenders: { file: string; match: string }[] = []
    for (const file of files) {
      const m = readFileSync(file, 'utf8').match(builtIn)
      if (m) offenders.push({ file: relative(SRC_DIR, file), match: m[0] })
    }
    expect(offenders).toEqual([])
  })
})
