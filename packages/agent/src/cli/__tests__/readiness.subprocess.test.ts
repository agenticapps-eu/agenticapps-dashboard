/**
 * AGE-462 — the readiness endpoints against a real daemon and three real repos.
 *
 * The unit suites mock the service or the assembler; this one starts the built
 * CLI, registers three repos on disk, and asks the running daemon. It exists to
 * catch what mocks cannot: a route that is not mounted, a schema the real
 * derivation violates, an absolute path that survives to the wire, and a repo
 * whose broken readiness file takes the fleet down with it.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, it, expect } from 'vitest'
import {
  FleetResponseSchema,
  RepoDetailResponseSchema,
} from '@agenticapps/dashboard-shared'

import { makeIsolatedHome, runAgent, startAgent } from './__shared__/spawnAgent.js'

const PASSING_REVIEW = '---\nverdict: PASS\nblocking_open: 0\n---\n\nAll good.\n'
const PASSING_SECURITY = '---\nverdict: PASS\n---\n\nNo findings.\n'

function git(root: string, args: string[]): void {
  spawnSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@test.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: root, encoding: 'utf8' },
  )
}

function write(root: string, file: string, body: string): void {
  mkdirSync(join(root, dirname(file)), { recursive: true })
  writeFileSync(join(root, file), body)
}

/** A committed git repo, seeded by the caller before the first commit. */
function makeRepo(prefix: string, seed: (root: string) => void): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `agentic-readiness-${prefix}-`)))
  git(root, ['init', '-b', 'main'])
  write(root, 'src/index.ts', 'export const x = 1\n')
  seed(root)
  git(root, ['add', '.'])
  git(root, ['commit', '-m', 'first'])
  return root
}

describe('AGE-462 readiness endpoints against a running daemon', () => {
  it(
    'answers fleet, detail and rescan for a complete, an empty and a broken repo',
    async () => {
      const port = 5500 + Math.floor(Math.random() * 100)
      const { home, cleanup } = makeIsolatedHome()

      const complete = makeRepo('complete', (root) => {
        write(root, 'openspec/specs/thing/spec.md', '# Thing\n')
        write(root, 'openspec/changes/archive/2026-01-01-done/REVIEW.md', PASSING_REVIEW)
        write(
          root,
          'openspec/changes/archive/2026-01-01-done/SECURITY.md',
          PASSING_SECURITY,
        )
        write(
          root,
          'coverage/coverage-summary.json',
          JSON.stringify({ total: { lines: { pct: 92.5 } } }),
        )
      })
      const empty = makeRepo('empty', () => {})
      const broken = makeRepo('broken', (root) => {
        write(root, '.agenticapps/readiness.json', '{ this is not json')
      })

      for (const root of [complete, empty, broken]) {
        expect(runAgent(['register', root], home).status).toBe(0)
      }

      const { child, ready } = startAgent(home, port)
      try {
        await ready
        const { token } = JSON.parse(
          readFileSync(join(home, '.agenticapps/dashboard/auth.json'), 'utf8'),
        ) as { token: string }
        const auth = { Authorization: `Bearer ${token}` }
        const base = `http://127.0.0.1:${port}/api/v2`

        // ── the fleet ───────────────────────────────────────────────────────
        const fleetRes = await fetch(`${base}/fleet`, { headers: auth })
        expect(fleetRes.status).toBe(200)
        const raw: unknown = await fleetRes.json()
        const fleet = FleetResponseSchema.parse(raw)

        expect(fleet.repos).toHaveLength(3)
        for (const repo of fleet.repos) {
          expect(repo.checks).toHaveLength(6)
        }

        // Registry order, not any ordering the server preferred.
        const registryRes = await fetch(
          `http://127.0.0.1:${port}/api/registry`,
          { headers: auth },
        )
        const registered = (await registryRes.json()) as {
          id: string
          root: string
        }[]
        expect(fleet.repos.map((repo) => repo.id)).toEqual(
          registered.map((project) => project.id),
        )

        const idOf = (root: string): string =>
          registered.find((project) => project.root === root)!.id
        const repoFor = (root: string) =>
          fleet.repos.find((repo) => repo.id === idOf(root))!

        // ── real derivation, not a uniform blank ────────────────────────────
        expect(
          repoFor(complete).checks.filter((check) => check.status === 'ok').length,
        ).toBeGreaterThan(0)
        expect(
          repoFor(empty).checks.filter((check) => check.status === 'ok'),
        ).toHaveLength(0)

        // ── a broken readiness file costs a notice, not the repo ────────────
        expect(repoFor(broken).notice).not.toBeNull()
        expect(repoFor(broken).checks).toHaveLength(6)

        // ── no machine path reaches the wire ────────────────────────────────
        const body = JSON.stringify(fleet)
        expect(body).not.toContain(tmpdir())
        expect(body).not.toContain(home)

        // ── detail and rescan ───────────────────────────────────────────────
        for (const root of [complete, empty, broken]) {
          const detailRes = await fetch(`${base}/repos/${idOf(root)}`, {
            headers: auth,
          })
          expect(detailRes.status).toBe(200)
          const detail = RepoDetailResponseSchema.parse(await detailRes.json())
          for (const check of detail.repo.checks) {
            expect(check.remedy.trim()).not.toBe('')
          }

          const rescanRes = await fetch(`${base}/repos/${idOf(root)}/rescan`, {
            method: 'POST',
            headers: auth,
          })
          expect(rescanRes.status).toBe(200)
          RepoDetailResponseSchema.parse(await rescanRes.json())
        }

        // ── the trust boundary holds on a live daemon ───────────────────────
        expect((await fetch(`${base}/fleet`)).status).toBe(401)
        expect(
          (await fetch(`${base}/repos/nobody`, { headers: auth })).status,
        ).toBe(404)
      } finally {
        child.kill('SIGTERM')
        cleanup()
      }
    },
    45_000,
  )
})
