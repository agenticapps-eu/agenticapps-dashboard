import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Create a tmp directory that mimics ~/.agenticapps/dashboard layout.
 * Returns { homeDir, configDir, cleanup }.
 */
export function makeTmpHome(): { homeDir: string; configDir: string; cleanup: () => void } {
  const homeDir = mkdtempSync(join(tmpdir(), 'agentic-test-'))
  const configDir = join(homeDir, '.agenticapps', 'dashboard')
  mkdirSync(configDir, { recursive: true, mode: 0o700 })
  return {
    homeDir,
    configDir,
    cleanup: () => rmSync(homeDir, { recursive: true, force: true }),
  }
}

/** Create a tmp project root with `.planning` and `.claude` subdirs and an optional escaping symlink. */
export function makeTmpProject(opts: { withSymlinkEscape?: boolean } = {}): {
  root: string
  cleanup: () => void
} {
  const root = mkdtempSync(join(tmpdir(), 'agentic-proj-'))
  mkdirSync(join(root, '.planning'), { recursive: true })
  mkdirSync(join(root, '.claude', 'skills', 'foo'), { recursive: true })
  mkdirSync(join(root, '.git'), { recursive: true })
  writeFileSync(join(root, '.planning', 'PROJECT.md'), 'test')
  writeFileSync(join(root, '.claude', 'skills', 'foo', 'SKILL.md'), 'test')
  writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main')
  if (opts.withSymlinkEscape) {
    const outside = mkdtempSync(join(tmpdir(), 'agentic-escape-'))
    writeFileSync(join(outside, 'secret.txt'), 'should not be readable')
    symlinkSync(join(outside, 'secret.txt'), join(root, '.planning', 'symlink-to-outside'))
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
