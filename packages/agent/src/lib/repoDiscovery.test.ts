/**
 * Test scaffold for repoDiscovery.ts — one-level-deep walk of 3 family roots.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 *
 * CODEX HIGH-2: symlink escape rejection — symlinks pointing outside the family root
 * must be excluded AND must emit a `safety` warn log. Realpath canonicalisation prevents
 * path traversal attacks via symlinked directories.
 */

import { describe, it } from 'vitest'

describe('discoverRepos', () => {
  it.todo(
    'walks 3 family roots (agenticapps, factiv, neuroflash) one level deep under ~/Sourcecode'
  )
  it.todo('skips missing family directories gracefully (not an error)')
  it.todo('skips dotfiles (entries starting with .) and node_modules directories')
  it.todo('includes .git directories and .git files (worktree markers) — only dotfile names are skipped')
  it.todo(
    'REALPATH escape rejection (CODEX HIGH-2): a symlink pointing outside the family root is excluded AND emits a `safety` warn log'
  )
  it.todo(
    'returns {family, name, absPath} tuples sorted by (family, name) for deterministic output'
  )
})
