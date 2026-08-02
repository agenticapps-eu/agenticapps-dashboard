import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeCoverageResolver } from '../coverageResolver.js'

import { deriveWorkflow, type WorkflowSources } from './workflowDeriver.js'

const NOW = Date.parse('2026-07-31T12:00:00Z')

let sandbox: string
let family: string
let machine: string
let repo: string

const skill = (version: string, implementsSpec: string, name = 'agentic-apps-workflow') =>
  `---\nname: ${name}\nversion: ${version}\nimplements_spec: ${implementsSpec}\ndescription: x\n---\n\nbody\n`

function put(absolute: string, body: string): void {
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, body)
}

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

/**
 * Host repos ship 3.2.0/1.0.0 (claude), 1.2.0/1.0.0 (codex) and 1.0.0/1.0.0
 * (opencode). opencode's lower pair is deliberate — the opencode case below
 * depends on it to report `ok`.
 */
function shipHostRepos(): void {
  put(join(family, 'claude-workflow', 'skill', 'SKILL.md'), skill('3.2.0', '1.0.0'))
  put(
    join(family, 'codex-workflow', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
    skill('1.2.0', '1.0.0'),
  )
  put(
    join(family, 'opencode-workflow', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
    skill('1.0.0', '1.0.0'),
  )
}

function sources(): WorkflowSources {
  return {
    hostRepos: {
      claude: join(family, 'claude-workflow'),
      codex: join(family, 'codex-workflow'),
      opencode: join(family, 'opencode-workflow'),
      pi: join(family, 'pi-agentic-apps-workflow'),
    },
    machineSkillRoots: {
      codex: join(machine, 'codex', 'skills'),
      opencode: join(machine, 'opencode', 'skills'),
      pi: join(machine, 'pi', 'skills'),
    },
  }
}

const derive = (over: Partial<WorkflowSources> = {}) =>
  deriveWorkflow({
    root: repo,
    now: NOW,
    sources: { ...sources(), ...over },
    resolve: makeCoverageResolver({ sourcecodeRoot: sandbox }),
  })

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'readiness-workflow-'))
  family = join(sandbox, 'agenticapps')
  machine = join(sandbox, 'machine')
  repo = join(family, 'a-project')
  mkdirSync(repo, { recursive: true })
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
  shipHostRepos()
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('deriveWorkflow — a repo-scoped host', () => {
  const CLAUDE_SKILL = join('.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md')

  function installClaude(version: string, implementsSpec: string): void {
    put(join(repo, CLAUDE_SKILL), skill(version, implementsSpec))
  }

  it('reports ok when both the skill version and implements_spec match', async () => {
    installClaude('3.2.0', '1.0.0')
    const sha = commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.value).toContain('3.2.0')
    expect(result.evidence).toEqual({ path: '.claude/skills/agentic-apps-workflow/SKILL.md', commit: sha })
    expect(result.at).toBe(Date.parse('2026-02-01T00:00:00Z'))
    expect(result.error).toBeNull()
  })

  it('reports warn when only the skill version trails', async () => {
    installClaude('3.1.0', '1.0.0')
    commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('warn')
  })

  // A version pattern anchored only at the front accepted the trailing text and
  // carried it into the comparison, where the patch component became NaN. Every
  // ordering test against NaN is false, so the artifact matched no branch and
  // came out `ok` — a malformed artifact reporting the healthiest possible state.
  it.each([
    ['a trailing suffix on the version', '3.2.0garbage', '1.0.0'],
    ['a trailing suffix on implements_spec', '3.2.0', '1.0.0garbage'],
  ])('does not report ok for %s', async (_label, version, implementsSpec) => {
    installClaude(version, implementsSpec)
    commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).not.toBe('ok')
  })

  it('reports fail when implements_spec trails', async () => {
    installClaude('3.2.0', '0.9.0')
    commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error).toBeNull()
  })

  it('reports fail when implements_spec trails even though the skill version is ahead', async () => {
    installClaude('9.9.9', '0.9.0')
    commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('fail')
  })

  it('reports fail, not warn, when the version and implements_spec both trail', async () => {
    installClaude('3.1.0', '0.9.0')
    commit([CLAUDE_SKILL], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('fail')
  })

  it('reports never when the host marker is present but no artifact is', async () => {
    mkdirSync(join(repo, '.claude', 'skills'), { recursive: true })

    const result = await derive()
    expect(result.status).toBe('never')
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
  })

  it('uses scan time when the artifact is not committed', async () => {
    installClaude('3.2.0', '1.0.0')

    const result = await derive()
    expect(result.at).toBe(NOW)
    expect(result.evidence?.commit).toBeNull()
  })
})

describe('deriveWorkflow — a machine-global host', () => {
  const STAMP = join('.codex', 'workflow-version.txt')

  function installCodex(scaffolder: string, globalVersion: string, globalSpec: string): void {
    put(join(repo, STAMP), `${scaffolder}\n`)
    put(
      join(machine, 'codex', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      skill(globalVersion, globalSpec),
    )
  }

  it('reports ok when the scaffolder and the machine-global spec both match', async () => {
    installCodex('1.2.0', '1.2.0', '1.0.0')
    commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.error).toBeNull()
  })

  it('carries both values and marks the machine-global one as not repo-specific', async () => {
    installCodex('1.2.0', '1.2.0', '1.0.0')
    commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(String(result.value)).toContain('1.2.0')
    expect(String(result.value)).toContain('1.0.0')
    expect(String(result.value).toLowerCase()).toContain('machine')
    expect(result.summary.toLowerCase()).toContain('every project')
  })

  it('reports fail when the machine-global implements_spec trails, whatever the scaffolder says', async () => {
    installCodex('1.2.0', '1.2.0', '0.9.0')
    commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('fail')
  })

  it('reports warn when only the per-repo scaffolder trails', async () => {
    installCodex('1.1.0', '1.2.0', '1.0.0')
    commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('warn')
  })

  it('reports fail, not warn, when the scaffolder and the machine-global spec both trail', async () => {
    installCodex('1.1.0', '1.2.0', '0.9.0')
    commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')
    expect((await derive()).status).toBe('fail')
  })

  it('timestamps from the repo-scoped stamp, never from the machine-global skill', async () => {
    installCodex('1.2.0', '1.2.0', '1.0.0')
    const sha = commit([STAMP], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.at).toBe(Date.parse('2026-02-01T00:00:00Z'))
    expect(result.evidence).toEqual({ path: '.codex/workflow-version.txt', commit: sha })
  })

  it('detects opencode by its own marker', async () => {
    put(join(repo, '.opencode', 'workflow-version.txt'), '1.0.0\n')
    put(
      join(machine, 'opencode', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      skill('1.0.0', '1.0.0'),
    )
    commit([join('.opencode', 'workflow-version.txt')], 'workflow', '2026-02-01T00:00:00Z')

    const result = await derive()
    expect(result.status).toBe('ok')
    expect(result.evidence?.path).toBe('.opencode/workflow-version.txt')
  })
})

describe('deriveWorkflow — hosts that cannot be pinned or read', () => {
  it('reports na with a reason for an unpinnable host', async () => {
    mkdirSync(join(repo, '.pi'), { recursive: true })

    const result = await derive()
    expect(result.status).toBe('na')
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
    expect(result.summary.trim()).not.toBe('')
  })

  it('reports an error-bearing fail when no host can be identified', async () => {
    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('reports an error-bearing fail for a malformed version stamp', async () => {
    put(join(repo, '.codex', 'workflow-version.txt'), 'not-a-version\n')
    put(
      join(machine, 'codex', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      skill('1.2.0', '1.0.0'),
    )

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('reports an error-bearing fail when the machine-global root is unavailable', async () => {
    put(join(repo, '.codex', 'workflow-version.txt'), '1.2.0\n')

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('reports an error-bearing fail when the host repo cannot be read', async () => {
    put(join(repo, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), skill('3.2.0', '1.0.0'))
    rmSync(join(family, 'claude-workflow'), { recursive: true, force: true })

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('reports an error-bearing fail for an artifact that is not the workflow skill', async () => {
    put(
      join(repo, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      skill('3.2.0', '1.0.0', 'some-other-skill'),
    )

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('refuses a machine-global skill larger than the read bound', async () => {
    put(join(repo, '.codex', 'workflow-version.txt'), '1.2.0\n')
    put(
      join(machine, 'codex', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      `${skill('1.2.0', '1.0.0')}${'padding\n'.repeat(200_000)}`,
    )

    const result = await derive()
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
  })

  it('never leaks a machine path into its summary or error text', async () => {
    put(join(repo, '.codex', 'workflow-version.txt'), '1.2.0\n')

    const result = await derive()
    expect(result.summary).not.toContain(machine)
    expect(result.summary).not.toContain(family)
    expect(result.error?.message ?? '').not.toContain(machine)
    expect(result.error?.message ?? '').not.toContain(family)
  })
})

describe('deriveWorkflow — what the number means', () => {
  it('states the frontmatter limitation and the absence of a migration ledger', async () => {
    put(join(repo, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), skill('3.2.0', '1.0.0'))

    const result = await derive()
    expect(result.summary.toLowerCase()).toContain('frontmatter')
    expect(result.summary.toLowerCase()).toContain('ledger')
  })
})
