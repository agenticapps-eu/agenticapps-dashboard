// @vitest-environment node
/**
 * tokenSourceOfTruth.test.ts — AC-05 invariant.
 *
 * tokens.css is the ONLY file permitted to contain hex color literals.
 * Every production component (.ts / .tsx) under packages/spa/src/components/
 * must be hex-free — all colors must come via Tailwind utility classes that
 * resolve to the tokens defined in tokens.css.
 *
 * Scope: packages/spa/src/components/** (production code only — test files excluded).
 * NOT scanned: src/styles/** (tokens.css is the authorised source; noOrange.test.ts
 * keeps its own allow-list of orange-family hex literals used purely for regression
 * assertions, so it is excluded by the .test.ts suffix filter).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Resolve relative to this file (.../packages/spa/src/styles/) so the test
// works in both per-package vitest (cwd = packages/spa) and workspace vitest
// (cwd = repo root).
const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(STYLES_DIR, '..', 'components')
const TOKENS_FILE = resolve(STYLES_DIR, 'tokens.css')

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

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/

describe('AC-05 — tokens.css is the single source of truth for color hex values', () => {
  const componentFiles = walk(COMPONENTS_DIR)

  it('no production component file contains a hex literal (every color must come via tokens)', () => {
    const offenders: { file: string; match: string }[] = []
    for (const f of componentFiles) {
      const content = readFileSync(f, 'utf8')
      const m = content.match(HEX_RE)
      if (m) offenders.push({ file: f, match: m[0] })
    }
    expect(offenders).toEqual([])
  })

  it('tokens.css does contain locked accent hex #6B46C1 (positive control)', () => {
    const content = readFileSync(TOKENS_FILE, 'utf8')
    expect(content).toMatch(/#6B46C1/i)
  })

  it('test files are excluded from the scan (test-file hex literals for assertions are allowed)', () => {
    // Verify the walk function correctly excludes test files.
    const testFiles = componentFiles.filter(
      (f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'),
    )
    expect(testFiles).toHaveLength(0)
  })
})
