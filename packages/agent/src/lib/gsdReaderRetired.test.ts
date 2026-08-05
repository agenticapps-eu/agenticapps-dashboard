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
 * The carve-out survived for a better reason: the scanner served the
 * `fleet-coverage` requirement `Review-Override Visibility`, removed by the
 * separate `retire-v1-surfaces` change. Retiring it there rather than here was
 * the correct scope, and that has now happened — the daemon teardown deleted
 * `overrideSentinelScanner.ts` along with `coverageScan.ts`, its only reader.
 *
 * So the carve-out is discharged and the guard tightens to what the original
 * group-5 task asked for and could not then have: **no** daemon path reads
 * `.planning/phases/`. A new reader cannot appear without this test failing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, it, expect } from 'vitest'

const SRC_ROOT = new URL('../', import.meta.url).pathname

/**
 * No sanctioned `.planning/phases/` reader remains. The last one,
 * `lib/scanners/overrideSentinelScanner.ts`, went with the coverage scan in
 * `retire-v1-surfaces` §2.
 */
const SANCTIONED: readonly string[] = []

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
  it('leaves no `.planning/phases/` reader in the daemon', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((f) => readsPhasesDir(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC_ROOT, f))
      .sort()

    expect(offenders).toEqual(SANCTIONED)
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
