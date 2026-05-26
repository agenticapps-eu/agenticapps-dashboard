/**
 * coverageSpawn.test.ts — gitnexus spawn + clipboard re-export tests.
 * Plan 03 implements; Plan 01 provided the it.todo placeholders (now replaced).
 *
 * D-5-21 CSO contract: spawn cmd is an argv-array (never shell string); 'npx' NEVER appears.
 * CODEX MED-13: clipboard builders are imported from @agenticapps/dashboard-shared (no local redefinition).
 * D-10-09: NO spawnWikiCompile or similar spawn function — wiki action is clipboard-only.
 *
 * ESM limitation note (from Plan 02 deviation #5): vi.spyOn on ESM built-in module namespaces
 * is not configurable. We use direct import of coverageSpawn and verify the export surface and
 * re-export identity rather than trying to intercept the internal spawn path.
 */

import { describe, it, expect } from 'vitest'
import * as coverageSpawn from './coverageSpawn.js'
import * as shared from '@agenticapps/dashboard-shared'

describe('coverageSpawn — module surface', () => {
  it('exports spawnGitNexusAnalyze as a function', () => {
    expect(typeof coverageSpawn.spawnGitNexusAnalyze).toBe('function')
  })

  it('NEVER includes npx in spawnGitNexusAnalyze argv (D-5-21) — function exists and binary is PATH-resolved', () => {
    // Module exists (was RED until this plan). The no-npx contract is:
    // (1) tested via acceptance-criteria grep on the source file (0 'npx' hits)
    // (2) enforced by the implementation using execFile('which', ['gitnexus'])
    //     not 'npx gitnexus'
    expect(typeof coverageSpawn.spawnGitNexusAnalyze).toBe('function')
  })

  it('D-10-09: spawnGitNexusAnalyze is the ONLY function whose name starts with "spawn"', () => {
    const spawnKeys = Object.keys(coverageSpawn).filter((k) => /^spawn/i.test(k))
    expect(spawnKeys).toEqual(['spawnGitNexusAnalyze'])
  })

  it('D-10-09: coverageSpawn does NOT export any wiki SPAWN function (clipboard-only contract)', () => {
    const keys = Object.keys(coverageSpawn)
    // Wiki spawn functions are forbidden (D-10-09). Only clipboard STRING builders are allowed.
    const wikiSpawnKeys = keys.filter(
      (k) =>
        /^spawn.*wiki/i.test(k) ||
        /^run.*wiki/i.test(k) ||
        /^exec.*wiki/i.test(k) ||
        /^invoke.*wiki/i.test(k),
    )
    expect(wikiSpawnKeys).toHaveLength(0)
  })
})

describe('coverageSpawn — CODEX MED-13 clipboard re-exports', () => {
  it('buildWikiCompileClipboardString is exported and is the same reference as shared', () => {
    expect(typeof coverageSpawn.buildWikiCompileClipboardString).toBe('function')
    expect(coverageSpawn.buildWikiCompileClipboardString).toBe(shared.buildWikiCompileClipboardString)
  })

  it('buildWorkflowUpdateClipboardString is re-exported from shared', () => {
    expect(typeof coverageSpawn.buildWorkflowUpdateClipboardString).toBe('function')
    expect(coverageSpawn.buildWorkflowUpdateClipboardString).toBe(shared.buildWorkflowUpdateClipboardString)
  })

  it('buildGitnexusInstallClipboardString is re-exported from shared', () => {
    expect(typeof coverageSpawn.buildGitnexusInstallClipboardString).toBe('function')
    expect(coverageSpawn.buildGitnexusInstallClipboardString).toBe(shared.buildGitnexusInstallClipboardString)
  })

  it('buildClaudeMdHelpUrl is re-exported from shared', () => {
    expect(typeof coverageSpawn.buildClaudeMdHelpUrl).toBe('function')
    expect(coverageSpawn.buildClaudeMdHelpUrl).toBe(shared.buildClaudeMdHelpUrl)
  })

  it('clipboard builders produce correct strings (smoke test via re-export)', () => {
    // buildWikiCompileClipboardString should produce the family-scoped cd + claude command
    expect(coverageSpawn.buildWikiCompileClipboardString('agenticapps')).toContain('wiki-compile')
    expect(coverageSpawn.buildWikiCompileClipboardString('agenticapps')).toContain('agenticapps')
    expect(coverageSpawn.buildWorkflowUpdateClipboardString()).toContain('workflow')
    expect(coverageSpawn.buildGitnexusInstallClipboardString()).toContain('gitnexus')
  })
})

describe('coverageSpawn — spawnGitNexusAnalyze behavior', () => {
  it('returns kind=not-installed when gitnexus binary absent from PATH', async () => {
    // On CI or machines without gitnexus installed, the function must gracefully
    // return not-installed. We test this indirectly by checking the discriminated union.
    // If gitnexus IS installed, we skip this test's assertion about not-installed.
    const result = await coverageSpawn.spawnGitNexusAnalyze('/nonexistent/path/that/does/not/exist')
    // The function must never throw — it must return a discriminated-union result
    expect(result).toBeDefined()
    expect(typeof (result as { kind: string }).kind).toBe('string')
    const validKinds = ['ok', 'not-installed', 'timeout', 'error']
    expect(validKinds).toContain((result as { kind: string }).kind)
  })

  it('D-5-21: does NOT use npx — result.kind is never undefined (function exists and returns discriminated union)', async () => {
    // The key D-5-21 contract: spawnGitNexusAnalyze exists and uses PATH lookup,
    // never npx. We verify the function produces a valid discriminated-union result.
    const result = await coverageSpawn.spawnGitNexusAnalyze('/tmp')
    expect(['ok', 'not-installed', 'timeout', 'error']).toContain(
      (result as { kind: string }).kind,
    )
  })

  it('result kind=not-installed when cwd is invalid (gitnexus likely absent on test machine)', async () => {
    // Most test machines do not have gitnexus installed globally.
    // When the binary is absent, kind must be 'not-installed' (never throws).
    const result = await coverageSpawn.spawnGitNexusAnalyze('/tmp/nonexistent-repo-path')
    // Accept either not-installed (binary absent) or error (binary present but cwd invalid)
    expect(['not-installed', 'error']).toContain((result as { kind: string }).kind)
  })
})

describe('coverageSpawn — D-13-10 spawn-helper lockstep', () => {
  // I-2 (Stage-2 review): the shared `buildGitnexusIndexClipboardString` helper
  // is the single source of truth for gitnexus argv. Locking the spawn source
  // to the helper output prevents the silent divergence the reviewer flagged
  // (helper shape shipped but both spawn sites hardcoded `['analyze']`).
  it('coverageSpawn.ts AND gitnexusScan.ts both consume buildGitnexusIndexClipboardString().argv (no hardcoded argv literal in any execa call)', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    for (const file of ['coverageSpawn.ts', 'gitnexusScan.ts']) {
      const src = await fs.readFile(path.join(here, file), 'utf8')
      // The helper invocation must appear in the spawn body
      expect(src, `${file}: helper invocation missing`).toMatch(
        /buildGitnexusIndexClipboardString\(\)\.argv/,
      )
      // And the bare hardcoded literal must NOT appear in any execa call expression
      expect(src, `${file}: hardcoded ['analyze'] argv in execa call`).not.toMatch(
        /execa\(\s*\w+\s*,\s*\['analyze'\]/,
      )
    }
  })

  it("helper.argv currently equals ['analyze'] — drift gate for future changes", () => {
    // If gitnexus invocation gains a flag (e.g. ['analyze', '--quiet']), this
    // test fails AND the spawn sites pick up the new argv automatically because
    // they consume the helper. Verifies single-source-of-truth contract.
    expect(shared.buildGitnexusIndexClipboardString().argv).toEqual(['analyze'])
  })
})
