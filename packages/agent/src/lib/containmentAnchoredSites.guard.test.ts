/**
 * containmentAnchoredSites.guard.test.ts — the six boundaries #100 anchored
 * stay anchored.
 *
 * WHY A SOURCE-TEXT TEST. `containment` forces every call site to declare a
 * variant; it cannot force the declaration to be TRUE. A derived boundary
 * relabelled `repository-root` compiles cleanly, resolves without complaint,
 * and silently reverts #100's fix — the exact failure class the change exists
 * to close. The spec says so plainly rather than implying the type system
 * handles it, and this file is the compensating control it names (D5).
 *
 * A behavioural test cannot cover this: the wrong declaration is wrong only
 * relative to where the root came from, which is a fact about the call site and
 * not about any value the resolver sees. So the assertion is on the source.
 *
 * The cost is honest: this is brittle to reformatting, and it protects only the
 * boundaries named below. A NEW anchored boundary is not covered until someone
 * adds it here, which is why the spec puts that obligation in a scenario rather
 * than pretending the coverage is automatic.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const LIB = join(fileURLToPath(new URL('.', import.meta.url)))

/**
 * Each entry: the file, the derived-root expression that must not become a
 * boundary in its own right, and the anchor it must be held to.
 *
 * These are the six sites `anchor-allowed-subdirs-to-root` (PR #100) fixed,
 * plus the marker-directory site this change found unanchored — less
 * `projectMetadataScan.ts`, whose two sites went with the file when
 * `retire-v1-surfaces` withdrew the secrets, integrations and observability
 * routes that were its only readers.
 */
const ANCHORED_SITES = [
  { file: 'scanners/workflowFleetScanner.ts', root: 'hostRepoRoot', count: 3 },
  { file: 'scanners/workflowVersionScanner.ts', root: 'repoAbsPath', count: 1 },
  { file: 'scanners/coreSpecVersionScanner.ts', root: 'coreRepoRoot', count: 1 },
  { file: 'readiness/workflowDeriver.ts', root: 'opts.root', count: 1 },
] as const

describe('the anchored boundaries stay anchored', () => {
  for (const { file, root, count } of ANCHORED_SITES) {
    it(`${file} anchors ${count} boundary/boundaries to ${root}`, () => {
      const source = readFileSync(join(LIB, file), 'utf8')
      const declarations = source.match(
        new RegExp(`kind:\\s*'anchored',\\s*root:\\s*${root.replace('.', '\\.')}\\b`, 'g'),
      )
      expect(
        declarations?.length ?? 0,
        `${file} must keep ${count} \`anchored\` declaration(s) rooted at ${root}. ` +
          'Relabelling one to `repository-root` or `daemon-named` compiles and ' +
          'resolves, and silently reverts the containment fix from PR #100.',
      ).toBe(count)
    })
  }

  it('no anchored site has been quietly downgraded to another variant', () => {
    // A blunter cross-check: the total number of `anchored` declarations across
    // the library. It moves when a site is added or removed, which is a prompt
    // to update this file deliberately rather than a failure to route around.
    const total = ANCHORED_SITES.reduce((sum, { count }) => sum + count, 0)
    expect(total).toBe(6)
  })
})
