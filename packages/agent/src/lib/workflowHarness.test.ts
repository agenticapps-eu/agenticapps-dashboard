import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  readWorkflowHarnessResult,
  resetWorkflowHarnessStateForTests,
  runWorkflowHarness,
  WORKFLOW_HARNESS_LIMITS,
  type WorkflowHarnessHostId,
  type WorkflowHarnessId,
  type WorkflowHarnessRequest,
} from './workflowHarness.js'

const CORE = 'agenticapps-workflow-core'
const HOSTS: WorkflowHarnessHostId[] = [
  'claude-workflow',
  'codex-workflow',
  'opencode-workflow',
  'pi-agentic-apps-workflow',
]

const PATHS = {
  'change-gate': {
    harness: 'tools/change-gate-conformance.sh',
    artifact: 'bin/openspec-change-gate.sh',
    reference: 'reference-implementations/openspec-change-gate/openspec-change-gate.sh',
  },
  'reviewer-cli': {
    harness: 'tools/reviewer-cli-conformance.sh',
    artifact: 'bin/reviewer-cli.sh',
    reference: 'reference-implementations/reviewer-cli/reviewer-cli.sh',
  },
} as const

let root: string
let sourceFamilyRoot: string
let stateRoot: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'workflow-harness-'))
  sourceFamilyRoot = join(root, 'source-family')
  stateRoot = join(root, 'daemon')
  mkdirSync(sourceFamilyRoot, { recursive: true })
  resetWorkflowHarnessStateForTests()
})

afterEach(() => {
  resetWorkflowHarnessStateForTests()
  rmSync(root, { recursive: true, force: true })
})

function write(path: string, body: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body, { mode })
  chmodSync(path, mode)
}

function script(body: string): string {
  return `#!/bin/sh\nset -eu\n${body}\n`
}

function seed(
  hostId: WorkflowHarnessHostId = 'codex-workflow',
  harnessId: WorkflowHarnessId = 'change-gate',
  harnessBody = script('printf "ok\\n"'),
): void {
  const paths = PATHS[harnessId]
  const coreRoot = join(sourceFamilyRoot, CORE)
  const hostRoot = join(sourceFamilyRoot, hostId)
  write(join(coreRoot, paths.harness), harnessBody, 0o755)
  write(join(hostRoot, paths.harness), harnessBody, 0o755)
  write(join(coreRoot, paths.reference), script('exit 0'), 0o755)
  write(join(hostRoot, paths.artifact), script('exit 0'), 0o755)
}

function request(
  hostId: WorkflowHarnessHostId = 'codex-workflow',
  harnessId: WorkflowHarnessId = 'change-gate',
): WorkflowHarnessRequest {
  return { hostId, harnessId }
}

function options(extra: Record<string, unknown> = {}) {
  return {
    sourceFamilyRoot,
    stateRoot,
    limits: {
      timeoutMs: 2_000,
      sampleIntervalMs: 20,
    },
    ...extra,
  }
}

async function waitForGone(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return false
}

describe('workflow harness fixed command and path discipline', () => {
  it('executes one fixed harness with only its mapped artifact argument', async () => {
    seed(
      'codex-workflow',
      'change-gate',
      script(
        'test "$#" -eq 1\n' +
          'printf "argv=%s\\ncwd=%s\\n" "$1" "$PWD"\n' +
          'exit 0',
      ),
    )

    const result = await runWorkflowHarness(request(), options())

    expect(result).toMatchObject({
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
      state: 'completed',
      passed: true,
      cached: false,
    })
    expect(result.output).not.toContain(sourceFamilyRoot)
    expect(result.output).not.toContain(stateRoot)
    expect(result.output).toContain('[path]')
  })

  it('refuses unknown identifiers before reaching the spawn-time seam', async () => {
    let reachedSpawn = false
    const result = await runWorkflowHarness(
      {
        hostId: 'injected-host',
        harnessId: 'change-gate; touch /tmp/pwned',
      } as unknown as WorkflowHarnessRequest,
      options({
        beforeSpawn: () => {
          reachedSpawn = true
        },
      }),
    )

    expect(result).toMatchObject({
      state: 'refused',
      reason: 'unknown-selection',
    })
    expect(reachedSpawn).toBe(false)
  })

  it('refuses a fixed repository that resolves outside the source-family root', async () => {
    seed()
    rmSync(join(sourceFamilyRoot, 'codex-workflow'), {
      recursive: true,
      force: true,
    })
    const outside = join(root, 'outside-repo')
    mkdirSync(outside, { recursive: true })
    symlinkSync(outside, join(sourceFamilyRoot, 'codex-workflow'))

    const result = await runWorkflowHarness(request(), options())

    expect(result).toMatchObject({
      state: 'refused',
      reason: 'path-not-allowed',
    })
  })

  it('refuses a harness symlink whose canonical target escapes the known root', async () => {
    seed()
    const harnessPath = join(
      sourceFamilyRoot,
      'codex-workflow',
      PATHS['change-gate'].harness,
    )
    const outside = join(root, 'outside-harness.sh')
    write(outside, readFileSync(harnessPath, 'utf8'), 0o755)
    rmSync(harnessPath)
    symlinkSync(outside, harnessPath)

    const result = await runWorkflowHarness(request(), options())

    expect(result).toMatchObject({
      state: 'refused',
      reason: 'path-not-allowed',
    })
  })

  it('revalidates the canonical harness at spawn time after a path swap', async () => {
    seed()
    const harnessPath = join(
      sourceFamilyRoot,
      'codex-workflow',
      PATHS['change-gate'].harness,
    )
    const outside = join(root, 'replacement.sh')
    write(outside, readFileSync(harnessPath, 'utf8'), 0o755)

    const result = await runWorkflowHarness(
      request(),
      options({
        beforeSpawn: () => {
          rmSync(harnessPath)
          symlinkSync(outside, harnessPath)
        },
      }),
    )

    expect(result).toMatchObject({
      state: 'refused',
      reason: 'path-not-allowed',
    })
  })

  it('refuses a same-path content swap between preflight and spawn', async () => {
    seed()
    const harnessPath = join(
      sourceFamilyRoot,
      'codex-workflow',
      PATHS['change-gate'].harness,
    )
    const coreHarnessPath = join(
      sourceFamilyRoot,
      CORE,
      PATHS['change-gate'].harness,
    )

    const result = await runWorkflowHarness(
      request(),
      options({
        beforeSpawn: () => {
          const replacement = script('printf replaced')
          write(harnessPath, replacement, 0o755)
          write(coreHarnessPath, replacement, 0o755)
        },
      }),
    )

    expect(result).toMatchObject({
      state: 'refused',
      reason: 'path-not-allowed',
    })
  })

  it.each([
    ['missing', 'harness-missing'],
    ['not-executable', 'harness-not-executable'],
    ['divergent', 'harness-divergent'],
  ] as const)('refuses a %s harness before spawn', async (condition, reason) => {
    seed()
    const harnessPath = join(
      sourceFamilyRoot,
      'codex-workflow',
      PATHS['change-gate'].harness,
    )
    if (condition === 'missing') rmSync(harnessPath)
    if (condition === 'not-executable') chmodSync(harnessPath, 0o644)
    if (condition === 'divergent') write(harnessPath, script('exit 9'), 0o755)

    const result = await runWorkflowHarness(request(), options())

    expect(result).toMatchObject({ state: 'refused', reason })
  })
})

describe('workflow harness private state and redaction', () => {
  it('uses a fresh mode-0700 scratch directory, cleans it, and stores mode-0600 output', async () => {
    seed(
      'codex-workflow',
      'change-gate',
      script(
        'mode=$(stat -f "%Lp" "$PWD" 2>/dev/null || stat -c "%a" "$PWD")\n' +
          'printf "scratch-mode=%s\\n" "$mode"\n' +
          'printf "home=%s\\nuser=%s\\nAuthorization: Bearer secret-value\\n" "$HOME" "$(id -un)"',
      ),
    )

    const result = await runWorkflowHarness(request(), options())
    const harnessRoot = join(stateRoot, 'workflow-harness')
    const resultPath = join(
      harnessRoot,
      'results',
      'codex-workflow--change-gate.json',
    )

    expect(result.output).toContain('scratch-mode=700')
    expect(result.output).not.toContain(stateRoot)
    expect(result.output).not.toContain(userInfo().username)
    expect(result.output).not.toContain('secret-value')
    expect(result.output).toContain('[redacted]')
    expect(lstatSync(harnessRoot).mode & 0o777).toBe(0o700)
    expect(lstatSync(dirname(resultPath)).mode & 0o777).toBe(0o700)
    expect(lstatSync(resultPath).mode & 0o777).toBe(0o600)
    expect(readdirSync(join(harnessRoot, 'tmp'))).toEqual([])

    const stored = readFileSync(resultPath, 'utf8')
    expect(stored).not.toContain(stateRoot)
    expect(stored).not.toContain(userInfo().username)
    expect(stored).not.toContain('secret-value')
  })

  it('truncates combined output and does not cache a bounded-out run', async () => {
    seed(
      'codex-workflow',
      'change-gate',
      script('yes "0123456789abcdef" | head -c 8192'),
    )

    const result = await runWorkflowHarness(
      request(),
      options({ limits: { outputBytes: 512, sampleIntervalMs: 10 } }),
    )

    expect(result).toMatchObject({
      state: 'bounded-out',
      reason: 'output-limit',
      passed: null,
    })
    expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(512)
    expect(await readWorkflowHarnessResult(request(), options())).toBeNull()
  })

  it('bounds scratch disk use and removes the scratch child', async () => {
    seed(
      'codex-workflow',
      'change-gate',
      script('dd if=/dev/zero of="$PWD/large" bs=1024 count=64 2>/dev/null\nsleep 30'),
    )

    const result = await runWorkflowHarness(
      request(),
      options({
        limits: {
          timeoutMs: 2_000,
          scratchBytes: 1_024,
          sampleIntervalMs: 10,
        },
      }),
    )

    expect(result).toMatchObject({
      state: 'bounded-out',
      reason: 'scratch-limit',
    })
    expect(readdirSync(join(stateRoot, 'workflow-harness', 'tmp'))).toEqual([])
  })

  it('samples process-group memory and terminates a run above the ceiling', async () => {
    seed('codex-workflow', 'change-gate', script('sleep 30'))

    const result = await runWorkflowHarness(
      request(),
      options({
        limits: {
          timeoutMs: 2_000,
          memoryBytes: 1,
          sampleIntervalMs: 10,
        },
      }),
    )

    expect(result).toMatchObject({
      state: 'bounded-out',
      reason: 'memory-limit',
    })
  })
})

describe('workflow harness timeout and concurrency', () => {
  it('kills the whole process group so a hanging descendant does not survive', async () => {
    seed(
      'codex-workflow',
      'change-gate',
      script(
        'sleep 30 &\n' +
          'child=$!\n' +
          'printf "%s" "$child" > "$(dirname "$1")/child.pid"\n' +
          'wait "$child"',
      ),
    )

    const result = await runWorkflowHarness(
      request(),
      options({ limits: { timeoutMs: 500, sampleIntervalMs: 10 } }),
    )
    const pidPath = join(
      sourceFamilyRoot,
      'codex-workflow',
      'bin',
      'child.pid',
    )
    expect(existsSync(pidPath), JSON.stringify(result)).toBe(true)
    const pid = Number(
      readFileSync(pidPath, 'utf8'),
    )

    expect(result).toMatchObject({
      state: 'timeout',
      reason: 'time-limit',
      passed: null,
    })
    expect(await waitForGone(pid)).toBe(true)
    expect(await readWorkflowHarnessResult(request(), options())).toBeNull()
  }, 5_000)

  it('permits at most one run per host and two runs overall', async () => {
    for (const host of HOSTS.slice(0, 3)) {
      seed(host, 'change-gate', script('sleep 30'))
    }
    const bounded = options({
      limits: { timeoutMs: 350, sampleIntervalMs: 10 },
    })

    const first = runWorkflowHarness(request(HOSTS[0]), bounded)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const sameHost = await runWorkflowHarness(request(HOSTS[0]), bounded)
    const second = runWorkflowHarness(request(HOSTS[1]), bounded)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const thirdHost = await runWorkflowHarness(request(HOSTS[2]), bounded)

    expect(sameHost).toMatchObject({
      state: 'busy',
      reason: 'host-busy',
    })
    expect(thirdHost).toMatchObject({
      state: 'busy',
      reason: 'capacity-busy',
    })
    await Promise.all([first, second])
  }, 5_000)
})

describe('workflow harness content-keyed cache', () => {
  it('keeps completed pass/fail results, derives outcome only from exit status, and reports age', async () => {
    let now = new Date('2026-07-27T20:00:00.000Z')
    seed(
      'codex-workflow',
      'change-gate',
      script('printf "PASS-looking diagnostic only\\n"\nexit 7'),
    )
    const runOptions = options({ now: () => now })

    const completed = await runWorkflowHarness(request(), runOptions)
    now = new Date('2026-07-27T20:02:00.000Z')
    const cached = await readWorkflowHarnessResult(request(), runOptions)

    expect(completed).toMatchObject({
      state: 'completed',
      passed: false,
      cached: false,
      ageMs: 0,
    })
    expect(cached).toMatchObject({
      state: 'completed',
      passed: false,
      cached: true,
      ageMs: 120_000,
    })
  })

  it.each([
    'tested-artifact',
    'harness-and-reference',
    'core-reference',
    'runner-contract',
  ] as const)('invalidates when the %s input changes', async (changedInput) => {
    seed()
    const baselineOptions = options()
    await runWorkflowHarness(request(), baselineOptions)

    const paths = PATHS['change-gate']
    if (changedInput === 'tested-artifact') {
      write(
        join(sourceFamilyRoot, 'codex-workflow', paths.artifact),
        script('printf changed'),
        0o755,
      )
    }
    if (changedInput === 'harness-and-reference') {
      const changed = script('printf changed-harness')
      write(join(sourceFamilyRoot, 'codex-workflow', paths.harness), changed, 0o755)
      write(join(sourceFamilyRoot, CORE, paths.harness), changed, 0o755)
    }
    if (changedInput === 'core-reference') {
      write(
        join(sourceFamilyRoot, CORE, paths.reference),
        script('printf changed-reference'),
        0o755,
      )
    }
    const readOptions =
      changedInput === 'runner-contract'
        ? options({
            limits: {
              ...WORKFLOW_HARNESS_LIMITS,
              timeoutMs: WORKFLOW_HARNESS_LIMITS.timeoutMs - 1,
            },
          })
        : baselineOptions

    expect(
      await readWorkflowHarnessResult(request(), readOptions),
    ).toBeNull()
  })

  it('does not cache timed-out or bounded-out runs as completed results', async () => {
    seed('codex-workflow', 'change-gate', script('sleep 30'))

    await runWorkflowHarness(
      request(),
      options({ limits: { timeoutMs: 100, sampleIntervalMs: 10 } }),
    )

    const resultPath = join(
      stateRoot,
      'workflow-harness',
      'results',
      'codex-workflow--change-gate.json',
    )
    expect(existsSync(resultPath)).toBe(false)
    expect(await readWorkflowHarnessResult(request(), options())).toBeNull()
  })

  it('refuses a cache result file replaced by a symlink', async () => {
    seed()
    await runWorkflowHarness(request(), options())
    const resultPath = join(
      stateRoot,
      'workflow-harness',
      'results',
      'codex-workflow--change-gate.json',
    )
    const outside = join(root, 'outside-cache.json')
    write(outside, readFileSync(resultPath, 'utf8'), 0o600)
    rmSync(resultPath)
    symlinkSync(outside, resultPath)

    expect(await readWorkflowHarnessResult(request(), options())).toBeNull()
  })

  it('refuses a cached result whose symbolic identity does not match its fixed key', async () => {
    seed()
    await runWorkflowHarness(request(), options())
    const resultPath = join(
      stateRoot,
      'workflow-harness',
      'results',
      'codex-workflow--change-gate.json',
    )
    const cached = JSON.parse(readFileSync(resultPath, 'utf8')) as {
      fingerprint: string
      result: Record<string, unknown>
    }
    cached.result.hostId = 'claude-workflow'
    cached.result.output = homedir()
    write(resultPath, `${JSON.stringify(cached)}\n`, 0o600)

    expect(await readWorkflowHarnessResult(request(), options())).toBeNull()
  })
})

describe('workflow harness architectural constraint', () => {
  it('names both user-driven process exceptions in OpenSpec config', () => {
    const config = readFileSync(
      new URL('../../../../openspec/config.yaml', import.meta.url),
      'utf8',
    )

    expect(config).not.toContain('Sole exception')
    expect(config).toContain('POST /api/projects/{id}/open')
    expect(config).toContain('POST /api/v2/workflow/harness')
  })
})
