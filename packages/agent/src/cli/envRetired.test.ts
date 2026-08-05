/**
 * envRetired.test.ts — the `env` command group and the boot-time env loader
 * are retired (`retire-v1-surfaces` §2).
 *
 * The integration credential store exists to serve the Sentry, Linear,
 * Infisical and observability panels, all withdrawn by this change. §2 makes
 * the point the file deletion alone would miss: deleting `env.json` while its
 * writer and its loader survive is not a deletion, because
 * `agentic-dashboard env set` recreates it and every daemon boot reads it back
 * into `process.env`. So the two maintaining paths are what this guards, not
 * the file.
 *
 * Both halves are asserted at the surface a user actually meets — the built
 * CLI's own help output — with a source-level sweep behind it so a path that
 * reads or writes the store cannot reappear under a different command name.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '../..')
const cliBundle = resolve(packageRoot, 'dist/cli.js')
const SRC_ROOT = resolve(__dirname, '..')

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
 * Prose naming the retired store is not a maintainer of it. Strip comments
 * before looking, the same way the `.planning/phases/` guard does, so a
 * comment recording the removal does not fail the test that records it.
 */
function touchesEnvStore(source: string): boolean {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const withoutComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, '')
  return /envFile\.js|loadEnvFile|writeEnvFile|readEnvFile|EnvFileSchema/.test(withoutComments)
}

describe('the env credential store is retired', () => {
  it('registers no `env` command on the CLI', () => {
    const result = spawnSync('node', [cliBundle, '--help'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).not.toMatch(/^\s*env\b/m)
    expect(result.stdout).not.toMatch(/env\.json/)
  })

  it('leaves no daemon path that reads or writes the env store', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((f) => touchesEnvStore(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC_ROOT, f))
      .sort()

    expect(offenders).toEqual([])
  })

  it('has removed the env command and loader modules entirely', () => {
    for (const gone of ['cli/envCmd.ts', 'lib/envFile.ts']) {
      expect(() => statSync(join(SRC_ROOT, gone))).toThrow()
    }
  })
})
