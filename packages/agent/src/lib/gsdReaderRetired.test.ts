/**
 * Guard test for task group 5 of `add-openspec-project-reader`: the GSD phase
 * reader is retired.
 *
 * The group-5 task reads "confirm no daemon path reads `.planning/phases/`
 * afterwards". Taken literally that is unsatisfiable alongside the very next
 * task, which says to leave `overrideSentinelScanner.ts` alone — and that
 * scanner does read `.planning/phases/<slug>/multi-ai-review-skipped`. (The
 * session handoff justified the carve-out by saying the scanner reads
 * `.planning/skill-observations/`; it does not. `routes/commitment.ts` does.)
 *
 * The carve-out survives for a better reason: the scanner serves the
 * `fleet-coverage` requirement `Review-Override Visibility`, which is removed by
 * the separate `retire-v1-surfaces` change. Retiring it here would be foreign
 * scope. So the invariant this change can actually enforce is the stronger,
 * honest one below: exactly one reader remains, it is named, and no new one may
 * appear without this test failing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, it, expect } from 'vitest'

const SRC_ROOT = new URL('../', import.meta.url).pathname

/** The single sanctioned `.planning/phases/` reader, owned by another change. */
const SANCTIONED = 'lib/scanners/overrideSentinelScanner.ts'

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__' || entry.name === '__tests__') continue
      sourceFiles(full, acc)
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      acc.push(full)
    }
  }
  return acc
}

/**
 * Match a real filesystem join of `.planning` + `phases`, not prose. Comments
 * that merely name the retired path are not readers and must not fail the guard.
 */
function readsPhasesDir(source: string): boolean {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const withoutComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, '')
  return /['"`]\.planning['"`]\s*,\s*['"`]phases['"`]/.test(withoutComments)
}

describe('the GSD phase reader is retired', () => {
  it('leaves exactly one sanctioned `.planning/phases/` reader in the daemon', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((f) => readsPhasesDir(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC_ROOT, f))
      .sort()

    expect(offenders).toEqual([SANCTIONED])
  })

  it('keeps `.planning/skill-observations/` load-bearing', () => {
    const observationReaders = sourceFiles(SRC_ROOT).filter((f) =>
      readFileSync(f, 'utf8').includes('skill-observations'),
    )
    expect(observationReaders.length).toBeGreaterThan(0)
  })

  it('has removed the phase-artifact reader modules entirely', () => {
    for (const gone of ['routes/phaseProgress.ts', 'routes/security.ts']) {
      expect(() => statSync(join(SRC_ROOT, gone))).toThrow()
    }
  })
})
