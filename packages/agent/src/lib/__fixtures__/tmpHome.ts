import { mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Create a tmp directory that mimics ~/.agenticapps/dashboard layout.
 *
 * @param opts.overrideHomeEnv  When true, sets process.env.HOME (or
 *   USERPROFILE on win32) to the tmp homeDir for the lifetime of the
 *   fixture so any code that calls `os.homedir()` resolves to the
 *   sandbox. Restored on cleanup. Use for tests whose production-code
 *   under test reads homedir() and would otherwise touch the real
 *   ~/Sourcecode/* tree (I-1 / Stage-2 review).
 */
export function makeTmpHome(opts: { overrideHomeEnv?: boolean } = {}): {
  homeDir: string
  configDir: string
  cleanup: () => void
} {
  const homeDir = mkdtempSync(join(tmpdir(), 'agentic-test-'))
  const configDir = join(homeDir, '.agenticapps', 'dashboard')
  mkdirSync(configDir, { recursive: true, mode: 0o700 })

  const envKey = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
  const restoreEnv: (() => void) | null = opts.overrideHomeEnv
    ? (() => {
        const prev = process.env[envKey]
        process.env[envKey] = homeDir
        return () => {
          if (prev === undefined) delete process.env[envKey]
          else process.env[envKey] = prev
        }
      })()
    : null

  return {
    homeDir,
    configDir,
    cleanup: () => {
      if (restoreEnv) restoreEnv()
      rmSync(homeDir, { recursive: true, force: true })
    },
  }
}

/** Create a tmp project root with `.planning` and `.claude` subdirs and an optional escaping symlink. */
export function makeTmpProject(opts: { withSymlinkEscape?: boolean } = {}): {
  root: string
  cleanup: () => void
} {
  // Canonicalise via realpath so fixture roots match what addProject() stores
  // (on macOS, /var/folders/... realpaths to /private/var/folders/...).
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-proj-')))
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
