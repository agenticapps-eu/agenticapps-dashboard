/**
 * Test scaffold for coverageSpawn.ts — spawns gitnexus analyze subprocess.
 * Plan 03 implements; Plan 01 provides it.todo placeholders + 1 GENUINELY FAILING RED test.
 *
 * D-5-21 CSO contract: spawn cmd must be an argv-array (never shell string);
 * 'npx' must NEVER appear in the spawn arguments.
 * CODEX MED-13: clipboard builders are imported from @agenticapps/dashboard-shared (no local redefinition).
 */

import { describe, it, expect, vi } from 'vitest'

describe('coverageSpawn', () => {
  it.todo('spawnGitNexusAnalyze invokes execa with argv-array (not shell string)')
  it.todo("returns kind=not-installed when gitnexus binary is absent (execa spawn failure)")
  it.todo("returns kind=ok with updated row on successful gitnexus analyze exit")
  it.todo(
    'imports clipboard builders FROM @agenticapps/dashboard-shared (CODEX MED-13 — no local clipboard string redefinition in coverageSpawn.ts)'
  )

  // GENUINELY-FAILING — D-5-21 + CODEX LOW-20 RED test
  // This fails at module import until Plan 03 creates coverageSpawn.ts.
  it('NEVER includes npx in spawnGitNexusAnalyze argv (D-5-21)', async () => {
    // Will fail at dynamic import until Plan 03 creates the module.
    const mod = await import('./coverageSpawn.js')
    const execaSpy = vi.fn().mockResolvedValue({ stdout: 'ok', exitCode: 0 })
    vi.doMock('execa', () => ({ execa: execaSpy }))
    await mod.spawnGitNexusAnalyze('/some/repo/path')
    const allArgs = execaSpy.mock.calls.flat(2).join(' ')
    expect(allArgs).not.toContain('npx')
  })
})
