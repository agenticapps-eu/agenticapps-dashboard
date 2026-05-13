/**
 * Test scaffold for gitNexusScanner.ts — ~/.gitnexus/registry.json parsing.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 */

import { describe, it } from 'vitest'

describe('scanGitNexus', () => {
  it.todo('returns installed=false with state=not-applicable when ~/.gitnexus directory absent')
  it.todo('returns installed=true with state=missing when registry.json absent but gitnexus dir exists')
  it.todo('parses RegistryEntry top-level array from registry.json')
  it.todo('rates repo fresh when last gitnexus scan ≤ 14 days ago')
  it.todo('rates repo stale when last gitnexus scan > 14 days ago')
  it.todo('rates repo missing when repo absPath not found in gitnexus entries')
  it.todo('tries realpath fallback when canonical path lookup misses (symlink-followed path)')
})
