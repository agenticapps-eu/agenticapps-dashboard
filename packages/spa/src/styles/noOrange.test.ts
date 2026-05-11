// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Resolve relative to this file (.../packages/spa/src/styles/) so the test works
// in both per-package vitest (cwd = packages/spa) and workspace vitest (cwd = repo root).
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string): string[] {
  const entries = readdirSync(dir)
  const out: string[] = []
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (['.ts', '.tsx', '.css'].includes(extname(p))) out.push(p)
  }
  return out
}

describe('Phase 5.1 anti-orange invariant (AC-04)', () => {
  const files = walk(SRC_DIR).filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))

  it('contains no FFA500 / FF8800 / FFB347 orange hex literals', () => {
    const offenders: string[] = []
    for (const f of files) {
      const content = readFileSync(f, 'utf8')
      if (/#FFA500|#FF8800|#FFB347/i.test(content)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  it('contains no Cloudflare-blue #0073EC literal (we are purple)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const content = readFileSync(f, 'utf8')
      if (/#0073EC/i.test(content)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  it('no #d97706 (legacy orange-ish warning) remains anywhere — alias layer deleted in Wave 5', () => {
    const offenders: string[] = []
    for (const f of files) {
      const content = readFileSync(f, 'utf8')
      if (/#d97706/i.test(content)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })
})
