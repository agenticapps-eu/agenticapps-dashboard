import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { CHECK_IDS, CheckResultSchema } from '@agenticapps/dashboard-shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeCoverageResolver } from '../coverageResolver.js'
import type { OpenspecProjectState } from '../openspecReader.js'

import { assembleReadiness, type AssembleReadinessOptions } from './assemble.js'
import { READINESS_FILE_PATH } from './readinessFile.js'

const NOW = Date.parse('2026-07-31T12:00:00Z')
const PASSING_REVIEW = '---\nverdict: PASS\nblocking_open: 0\n---\n\nAll good.\n'

let sandbox: string
let family: string
let machine: string
let repo: string

const skill = (version: string, implementsSpec: string) =>
  `---\nname: agentic-apps-workflow\nversion: ${version}\nimplements_spec: ${implementsSpec}\n---\n`

function put(absolute: string, body: string): void {
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, body)
}

const write = (relative: string, body = 'x\n') => put(join(repo, relative), body)

function git(args: string[], date?: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=t@t.com', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd: repo,
      encoding: 'utf8',
      env: date
        ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
        : process.env,
    },
  )
}

function commit(files: string[], message: string, date: string): string {
  git(['add', ...files])
  git(['commit', '-m', message], date)
  return git(['rev-parse', 'HEAD']).trim()
}

const emptyProject = async (): Promise<OpenspecProjectState> => ({
  present: false,
  openChanges: [],
  capabilities: [],
  archived: [],
})

function options(over: Partial<AssembleReadinessOptions> = {}): AssembleReadinessOptions {
  return {
    root: repo,
    now: NOW,
    sources: {
      hostRepos: { claude: join(family, 'claude-workflow') },
      machineSkillRoots: {},
    },
    resolve: makeCoverageResolver({ sourcecodeRoot: sandbox }),
    readProject: emptyProject,
    ...over,
  }
}

const declare = (checks: unknown[], extra: Record<string, unknown> = {}) =>
  write(READINESS_FILE_PATH, JSON.stringify({ schemaVersion: 1, ...extra, checks }))

const byId = (checks: Awaited<ReturnType<typeof assembleReadiness>>['checks'], id: string) =>
  checks.find((check) => check.id === id)!

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-assemble-'))
  family = join(sandbox, 'agenticapps')
  machine = join(sandbox, 'machine')
  repo = join(family, 'a-project')
  mkdirSync(repo, { recursive: true })
  mkdirSync(machine, { recursive: true })
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
  put(join(family, 'claude-workflow', 'skill', 'SKILL.md'), skill('3.2.0', '1.0.0'))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('assembleReadiness — shape', () => {
  it('returns six results in the fixed order whatever the repo holds', async () => {
    const result = await assembleReadiness(options())
    expect(result.checks.map((check) => check.id)).toEqual([...CHECK_IDS])
  })

  it('returns results that satisfy the wire shape', async () => {
    write('packages/a.ts')
    commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')

    const result = await assembleReadiness(options())
    for (const check of result.checks) {
      expect(CheckResultSchema.safeParse(check).success).toBe(true)
    }
  })

  it('is not ready when nothing can be derived, and raises no notice', async () => {
    const result = await assembleReadiness(options())
    expect(result.ready).toBe(false)
    expect(result.notice).toBeNull()
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })
})

describe('assembleReadiness — per-check precedence', () => {
  it('lets a repo declaring only pen-test keep five derived results', async () => {
    declare([
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        validUntil: '2027-07-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'b'.repeat(40),
      },
    ])

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'pen-test').source).toBe('declared')
    expect(byId(result.checks, 'pen-test').status).toBe('ok')
    expect(result.checks.filter((check) => check.source === 'derived')).toHaveLength(5)
    expect(result.notice).toBeNull()
  })

  it('lets a declaration override a worse derived value without a discrepancy warning', async () => {
    declare([{ id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' }])

    const result = await assembleReadiness(options())
    const spec = byId(result.checks, 'spec')
    expect(spec.status).toBe('ok')
    expect(spec.source).toBe('declared')
    expect(spec.error).toBeNull()
    expect(result.notice).toBeNull()
  })

  it('applies no declaration at all when the file is unusable, and says so', async () => {
    write(READINESS_FILE_PATH, '{ not json')

    const result = await assembleReadiness(options())
    expect(result.notice?.code).toBe('readiness-file-unparsable')
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })

  it('discards an unknown check id and keeps the rest of the file', async () => {
    declare([
      { id: 'accessibility', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      { id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
    ])

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'spec').source).toBe('declared')
    expect(result.notice).toBeNull()
  })

  it('is ready when every check is declared ok', async () => {
    declare([
      { id: 'workflow', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      { id: 'spec', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        evidence: 'docs/review.md',
        commit: 'c'.repeat(40),
      },
      {
        id: 'security-review',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        evidence: 'docs/security.md',
        commit: 'c'.repeat(40),
      },
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2026-07-01T09:00:00Z',
        validUntil: '2027-07-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'c'.repeat(40),
      },
      { id: 'coverage', status: 'ok', observedAt: '2026-07-01T09:00:00Z', value: 91.2 },
    ])

    const result = await assembleReadiness(options())
    expect(result.ready).toBe(true)
  })

  it('renders a declared na without a timestamp or evidence, but with its reason', async () => {
    declare([
      {
        id: 'coverage',
        status: 'na',
        observedAt: '2026-07-01T09:00:00Z',
        summary: 'this repo ships no executable code',
      },
    ])

    const result = await assembleReadiness(options())
    const coverage = byId(result.checks, 'coverage')
    expect(coverage.status).toBe('na')
    expect(coverage.at).toBeNull()
    expect(coverage.evidence).toBeNull()
    expect(coverage.summary).toContain('no executable code')
  })
})

describe('assembleReadiness — declared evidence still ages', () => {
  it('turns a declared review stale when production code moved on, keeping its provenance', async () => {
    write('packages/a.ts')
    const reviewed = commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('packages/b.ts')
    commit(['packages/b.ts'], 'later code', '2026-02-01T00:00:00Z')
    declare([
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-01-01T10:00:00Z',
        evidence: 'docs/review.md',
        commit: reviewed,
      },
    ])

    const result = await assembleReadiness(options())
    const review = byId(result.checks, 'code-review')
    expect(review.status).toBe('stale')
    expect(review.source).toBe('declared')
  })

  it('keeps a declared review current when it covers the last production commit', async () => {
    write('packages/a.ts')
    const reviewed = commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    declare([
      {
        id: 'code-review',
        status: 'ok',
        observedAt: '2026-01-01T10:00:00Z',
        evidence: 'docs/review.md',
        commit: reviewed,
      },
    ])
    commit([READINESS_FILE_PATH], 'declare', '2026-01-02T00:00:00Z')

    const result = await assembleReadiness(options())
    expect(byId(result.checks, 'code-review').status).toBe('ok')
  })

  it('turns an expired declared pen test stale, keeping its provenance', async () => {
    declare([
      {
        id: 'pen-test',
        status: 'ok',
        observedAt: '2025-01-01T09:00:00Z',
        validUntil: '2026-01-01T09:00:00Z',
        evidence: 'docs/pen-test.md',
        commit: 'b'.repeat(40),
      },
    ])

    const result = await assembleReadiness(options())
    const pen = byId(result.checks, 'pen-test')
    expect(pen.status).toBe('stale')
    expect(pen.source).toBe('declared')
  })
})

describe('assembleReadiness — degradation', () => {
  it('keeps the other five checks when one deriver throws', async () => {
    const result = await assembleReadiness(
      options({
        readProject: async () => {
          throw new Error('boom')
        },
      }),
    )
    const spec = byId(result.checks, 'spec')
    expect(spec.status).toBe('fail')
    expect(spec.error?.code).toBeTruthy()
    expect(result.checks).toHaveLength(6)
    expect(result.ready).toBe(false)
  })

  it('keeps the other five checks when a deriver throws outright', async () => {
    put(join(repo, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), skill('3.2.0', '1.0.0'))
    const exploding = {
      get hostRepos(): never {
        throw new Error('boom')
      },
      machineSkillRoots: {},
    }

    const result = await assembleReadiness(
      options({ sources: exploding as unknown as AssembleReadinessOptions['sources'] }),
    )
    const workflow = byId(result.checks, 'workflow')
    expect(workflow.status).toBe('fail')
    expect(workflow.error?.code).toBeTruthy()
    expect(result.checks).toHaveLength(6)
    expect(result.checks.filter((check) => check.error === null)).not.toHaveLength(0)
  })

  it('rejects a configured production scope that leaves no production path', async () => {
    write('packages/a.ts')
    commit(['packages/a.ts'], 'code', '2026-01-01T00:00:00Z')
    declare([], { productionPaths: { include: ['nothing-here/**'] } })

    const result = await assembleReadiness(options())
    expect(result.notice?.code).toBe('readiness-file-invalid')
    expect(result.checks.every((check) => check.source === 'derived')).toBe(true)
  })

  it('accepts a configured production scope that still finds production paths', async () => {
    write('packages/a.ts')
    write('openspec/changes/one/REVIEW.md', PASSING_REVIEW)
    commit(['packages/a.ts', 'openspec/changes/one/REVIEW.md'], 'code', '2026-01-01T00:00:00Z')
    declare([], { productionPaths: { include: ['packages/**'] } })

    const result = await assembleReadiness(options())
    expect(result.notice).toBeNull()
    expect(byId(result.checks, 'code-review').status).toBe('ok')
  })
})
