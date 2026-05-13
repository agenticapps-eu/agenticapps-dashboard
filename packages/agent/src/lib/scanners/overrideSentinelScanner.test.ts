/**
 * Test scaffold for overrideSentinelScanner.ts — sentinel discovery + git log timestamp + mtime fallback.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 */

import { describe, it } from 'vitest'

describe('scanOverrideSentinels', () => {
  it.todo('discovers sentinel files under .planning/phases/* matching the sentinel pattern')
  it.todo('reads sinceIso from git log -1 --format="%cI" for each sentinel file (source=git-log)')
  it.todo('falls back to mtime when git log returns no output for a sentinel (source=mtime)')
  it.todo('returns overrideCount=0 and empty overrides array when no sentinels are found')
})
