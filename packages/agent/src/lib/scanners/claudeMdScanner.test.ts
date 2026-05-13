/**
 * Test scaffold for claudeMdScanner.ts — CLAUDE.md / AGENTS.md presence detection.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 */

import { describe, it } from 'vitest'

describe('scanClaudeMd', () => {
  it.todo('scans CLAUDE.md present at repo root — returns state=fresh')
  it.todo('scans AGENTS.md fallback when CLAUDE.md absent — returns state=fresh')
  it.todo('returns state=missing when neither CLAUDE.md nor AGENTS.md is present')
})
