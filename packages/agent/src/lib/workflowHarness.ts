import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, join, sep } from 'node:path'

import { atomicWriteFile } from './atomicWrite.js'
import type {
  WorkflowHarnessHostId,
  WorkflowHarnessId,
  WorkflowHarnessLimits,
  WorkflowHarnessRequest,
  WorkflowHarnessResult,
  WorkflowHarnessResultReason,
  WorkflowHarnessRunOptions,
} from './workflowHarness.declare.js'

export type {
  WorkflowHarnessHostId,
  WorkflowHarnessId,
  WorkflowHarnessLimits,
  WorkflowHarnessRequest,
  WorkflowHarnessResult,
  WorkflowHarnessResultReason,
  WorkflowHarnessRunOptions,
} from './workflowHarness.declare.js'

interface HarnessCommand {
  harnessPath: string
  artifactPath: string
  referencePath: string
}

interface PreparedHarness {
  hostRoot: string
  coreRoot: string
  harnessPath: string
  coreHarnessPath: string
  artifactPath: string
  referencePath: string
  fingerprint: string
}

interface CacheEntry {
  fingerprint: string
  result: WorkflowHarnessResult
}

interface PreparationFailure {
  reason: WorkflowHarnessResultReason
}

const CORE_REPO = 'agenticapps-workflow-core'
const RUNNER_CONTRACT_VERSION = '1'
const MAX_CONCURRENT_RUNS = 2

const HOST_IDS: readonly WorkflowHarnessHostId[] = [
  'claude-workflow',
  'codex-workflow',
  'opencode-workflow',
  'pi-agentic-apps-workflow',
]

const COMMANDS: Readonly<Record<WorkflowHarnessId, HarnessCommand>> = {
  'change-gate': {
    harnessPath: 'tools/change-gate-conformance.sh',
    artifactPath: 'bin/openspec-change-gate.sh',
    referencePath:
      'reference-implementations/openspec-change-gate/openspec-change-gate.sh',
  },
  'reviewer-cli': {
    harnessPath: 'tools/reviewer-cli-conformance.sh',
    artifactPath: 'bin/reviewer-cli.sh',
    referencePath: 'reference-implementations/reviewer-cli/reviewer-cli.sh',
  },
}

export const WORKFLOW_HARNESS_LIMITS: Readonly<WorkflowHarnessLimits> =
  Object.freeze({
    timeoutMs: 30_000,
    memoryBytes: 256 * 1024 * 1024,
    outputBytes: 1024 * 1024,
    scratchBytes: 64 * 1024 * 1024,
    sampleIntervalMs: 100,
  })

const activeHosts = new Set<WorkflowHarnessHostId>()
let activeRuns = 0

export function resetWorkflowHarnessStateForTests(): void {
  activeHosts.clear()
  activeRuns = 0
}

function isHostId(value: unknown): value is WorkflowHarnessHostId {
  return (
    typeof value === 'string' &&
    HOST_IDS.includes(value as WorkflowHarnessHostId)
  )
}

function isHarnessId(value: unknown): value is WorkflowHarnessId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(COMMANDS, value)
  )
}

function safeRequest(request: WorkflowHarnessRequest): WorkflowHarnessRequest {
  return {
    hostId: isHostId(request.hostId) ? request.hostId : 'codex-workflow',
    harnessId: isHarnessId(request.harnessId)
      ? request.harnessId
      : 'change-gate',
  }
}

function result(
  request: WorkflowHarnessRequest,
  state: WorkflowHarnessResult['state'],
  reason?: WorkflowHarnessResultReason,
  output = '',
): WorkflowHarnessResult {
  return {
    schemaVersion: 1,
    ...safeRequest(request),
    state,
    passed: null,
    completedAtIso: null,
    ageMs: null,
    output,
    cached: false,
    ...(reason ? { reason } : {}),
  }
}

function sourceFamilyRoot(options: WorkflowHarnessRunOptions): string {
  return options.sourceFamilyRoot ?? join(homedir(), 'Sourcecode', 'agenticapps')
}

function daemonStateRoot(options: WorkflowHarnessRunOptions): string {
  return options.stateRoot ?? join(homedir(), '.agenticapps', 'dashboard')
}

function effectiveLimits(
  options: WorkflowHarnessRunOptions,
): WorkflowHarnessLimits {
  return { ...WORKFLOW_HARNESS_LIMITS, ...options.limits }
}

function isInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep)
}

function canonicalExisting(path: string, root: string): string | null {
  try {
    const canonical = realpathSync(path)
    return isInside(canonical, root) ? canonical : null
  } catch {
    return null
  }
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function fingerprint(
  artifactPath: string,
  harnessPath: string,
  referencePath: string,
  limits: WorkflowHarnessLimits,
): string {
  return createHash('sha256')
    .update(hashFile(artifactPath))
    .update('\0')
    .update(hashFile(harnessPath))
    .update('\0')
    .update(hashFile(referencePath))
    .update('\0')
    .update(
      JSON.stringify({
        runnerContractVersion: RUNNER_CONTRACT_VERSION,
        limits,
        environment: 'fixed-v1',
      }),
    )
    .digest('hex')
}

function prepareHarness(
  request: WorkflowHarnessRequest,
  options: WorkflowHarnessRunOptions,
): PreparedHarness | PreparationFailure {
  if (!isHostId(request.hostId) || !isHarnessId(request.harnessId)) {
    return { reason: 'unknown-selection' }
  }

  const familyLexical = sourceFamilyRoot(options)
  let familyRoot: string
  try {
    familyRoot = realpathSync(familyLexical)
  } catch {
    return { reason: 'repo-unavailable' }
  }

  const hostLexical = join(familyLexical, request.hostId)
  const coreLexical = join(familyLexical, CORE_REPO)
  if (!existsSync(hostLexical) || !existsSync(coreLexical)) {
    return { reason: 'repo-unavailable' }
  }

  const hostRoot = canonicalExisting(hostLexical, familyRoot)
  const coreRoot = canonicalExisting(coreLexical, familyRoot)
  if (!hostRoot || !coreRoot) return { reason: 'path-not-allowed' }

  const command = COMMANDS[request.harnessId]
  const hostHarnessLexical = join(hostLexical, command.harnessPath)
  const coreHarnessLexical = join(coreLexical, command.harnessPath)
  if (!existsSync(hostHarnessLexical) || !existsSync(coreHarnessLexical)) {
    return { reason: 'harness-missing' }
  }

  const harnessPath = canonicalExisting(hostHarnessLexical, hostRoot)
  const coreHarnessPath = canonicalExisting(coreHarnessLexical, coreRoot)
  if (!harnessPath || !coreHarnessPath) return { reason: 'path-not-allowed' }

  try {
    const harnessStat = statSync(harnessPath)
    if (
      !harnessStat.isFile() ||
      (harnessStat.mode &
        (fsConstants.S_IXUSR | fsConstants.S_IXGRP | fsConstants.S_IXOTH)) ===
        0
    ) {
      return { reason: 'harness-not-executable' }
    }
  } catch {
    return { reason: 'harness-missing' }
  }

  let artifactPath: string | null
  let referencePath: string | null
  try {
    artifactPath = canonicalExisting(
      join(hostLexical, command.artifactPath),
      hostRoot,
    )
    referencePath = canonicalExisting(
      join(coreLexical, command.referencePath),
      coreRoot,
    )
  } catch {
    return { reason: 'repo-unavailable' }
  }
  if (!artifactPath || !referencePath) return { reason: 'repo-unavailable' }

  try {
    if (hashFile(harnessPath) !== hashFile(coreHarnessPath)) {
      return { reason: 'harness-divergent' }
    }
    return {
      hostRoot,
      coreRoot,
      harnessPath,
      coreHarnessPath,
      artifactPath,
      referencePath,
      fingerprint: fingerprint(
        artifactPath,
        harnessPath,
        referencePath,
        effectiveLimits(options),
      ),
    }
  } catch {
    return { reason: 'repo-unavailable' }
  }
}

function isPreparationFailure(
  prepared: PreparedHarness | PreparationFailure,
): prepared is PreparationFailure {
  return 'reason' in prepared
}

function assertPlainDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode: 0o700 })
  } else {
    const stat = lstatSync(path)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error('daemon state path is not a plain directory')
    }
  }
  chmodSync(path, 0o700)
}

function ensureStateTree(options: WorkflowHarnessRunOptions): {
  harnessRoot: string
  resultsRoot: string
  tmpRoot: string
} {
  const stateRoot = daemonStateRoot(options)
  assertPlainDirectory(stateRoot)
  const canonicalStateRoot = realpathSync(stateRoot)

  const harnessRoot = join(stateRoot, 'workflow-harness')
  const resultsRoot = join(harnessRoot, 'results')
  const tmpRoot = join(harnessRoot, 'tmp')
  for (const path of [harnessRoot, resultsRoot, tmpRoot]) {
    assertPlainDirectory(path)
    const canonical = realpathSync(path)
    if (!isInside(canonical, canonicalStateRoot)) {
      throw new Error('daemon state path escapes its root')
    }
  }
  return {
    harnessRoot: realpathSync(harnessRoot),
    resultsRoot: realpathSync(resultsRoot),
    tmpRoot: realpathSync(tmpRoot),
  }
}

function existingResultsRoot(
  options: WorkflowHarnessRunOptions,
): string | null {
  const stateRoot = daemonStateRoot(options)
  if (!existsSync(stateRoot)) return null
  try {
    const stateStat = lstatSync(stateRoot)
    if (!stateStat.isDirectory() || stateStat.isSymbolicLink()) return null
    const canonicalStateRoot = realpathSync(stateRoot)
    const resultsRoot = join(stateRoot, 'workflow-harness', 'results')
    const resultsStat = lstatSync(resultsRoot)
    if (!resultsStat.isDirectory() || resultsStat.isSymbolicLink()) return null
    const canonical = realpathSync(resultsRoot)
    return isInside(canonical, canonicalStateRoot) ? canonical : null
  } catch {
    return null
  }
}

function cachePath(
  resultsRoot: string,
  request: WorkflowHarnessRequest,
): string {
  const selected = safeRequest(request)
  return join(
    resultsRoot,
    `${selected.hostId}--${selected.harnessId}.json`,
  )
}

function readCache(
  path: string,
  resultsRoot: string,
  request: WorkflowHarnessRequest,
  maximumOutputBytes: number,
): CacheEntry | null {
  try {
    const fileStat = lstatSync(path)
    if (
      !fileStat.isFile() ||
      fileStat.isSymbolicLink() ||
      (fileStat.mode & 0o777) !== 0o600 ||
      fileStat.size > maximumOutputBytes + 64 * 1024
    ) {
      return null
    }
    const canonical = realpathSync(path)
    if (!isInside(canonical, resultsRoot)) return null

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CacheEntry
    const selected = safeRequest(request)
    if (
      typeof parsed?.fingerprint !== 'string' ||
      parsed?.result?.state !== 'completed' ||
      parsed.result.schemaVersion !== 1 ||
      parsed.result.hostId !== selected.hostId ||
      parsed.result.harnessId !== selected.harnessId ||
      typeof parsed.result.completedAtIso !== 'string' ||
      typeof parsed.result.passed !== 'boolean' ||
      typeof parsed.result.output !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCache(
  path: string,
  entry: CacheEntry,
): void {
  atomicWriteFile(path, `${JSON.stringify(entry)}\n`, 0o600)
  chmodSync(path, 0o600)
}

function directoryBytes(path: string): number {
  let stat
  try {
    stat = lstatSync(path)
  } catch {
    return 0
  }
  if (stat.isSymbolicLink()) return 0
  if (!stat.isDirectory()) return stat.size
  let total = 0
  for (const name of readdirSync(path)) {
    total += directoryBytes(join(path, name))
  }
  return total
}

function linuxProcessGroupRssBytes(processGroupId: number): number {
  let totalPages = 0
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    try {
      const raw = readFileSync(join('/proc', name, 'stat'), 'utf8')
      const afterName = raw.slice(raw.lastIndexOf(')') + 2).split(/\s+/)
      if (Number(afterName[2]) === processGroupId) {
        totalPages += Number(afterName[21]) || 0
      }
    } catch {
      // Process exited between readdir and read.
    }
  }
  return totalPages * 4096
}

function darwinProcessGroupRssBytes(processGroupId: number): number {
  const output = execFileSync('/bin/ps', ['-axo', 'pgid=,rss='], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  let totalKiB = 0
  for (const line of output.split('\n')) {
    const [pgid, rss] = line.trim().split(/\s+/)
    if (Number(pgid) === processGroupId) totalKiB += Number(rss) || 0
  }
  return totalKiB * 1024
}

function processGroupRssBytes(processGroupId: number): number {
  try {
    if (process.platform === 'linux') {
      return linuxProcessGroupRssBytes(processGroupId)
    }
    if (process.platform === 'darwin') {
      return darwinProcessGroupRssBytes(processGroupId)
    }
  } catch {
    return Number.POSITIVE_INFINITY
  }
  return Number.POSITIVE_INFINITY
}

function killProcessGroup(pid: number | undefined): void {
  if (!pid) return
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    // The process group may already be gone.
  }
}

function appendBounded(
  chunks: Buffer[],
  chunk: Buffer,
  currentBytes: number,
  maximumBytes: number,
): number {
  const remaining = Math.max(0, maximumBytes - currentBytes)
  if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
  return currentBytes + chunk.length
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const bytes = Buffer.from(value)
  if (bytes.length <= maximumBytes) return value
  return bytes.subarray(0, maximumBytes).toString('utf8')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function redactOutput(
  value: string,
  paths: readonly string[],
  outputBytes: number,
): string {
  let redacted = value
  for (const path of [...paths].sort((a, b) => b.length - a.length)) {
    if (!path) continue
    redacted = redacted.replace(new RegExp(escapeRegExp(path), 'g'), '[path]')
  }
  const username = userInfo().username
  if (username) {
    redacted = redacted.replace(
      new RegExp(`\\b${escapeRegExp(username)}\\b`, 'g'),
      '[redacted]',
    )
  }
  redacted = redacted
    .replace(
      /\b(?:Bearer\s+|token[=:]\s*|secret[=:]\s*)[A-Za-z0-9._~+/=-]{4,}/gi,
      '[redacted]',
    )
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16})\b/g,
      '[redacted]',
    )
    .replace(
      /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
      '[redacted]',
    )
    .replace(
      /(^|[\s="'(])\/(?:[^\s"'()<>{}\[\]]+)/gm,
      '$1[path]',
    )
  return truncateUtf8(redacted, outputBytes)
}

function fixedEnvironment(scratchRoot: string): NodeJS.ProcessEnv {
  const executableDir = dirname(process.execPath)
  return {
    PATH: [
      executableDir,
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ].join(':'),
    HOME: scratchRoot,
    TMPDIR: scratchRoot,
    LANG: 'C',
    LC_ALL: 'C',
  }
}

async function executePrepared(
  request: WorkflowHarnessRequest,
  prepared: PreparedHarness,
  scratchRoot: string,
  limits: WorkflowHarnessLimits,
  options: WorkflowHarnessRunOptions,
): Promise<WorkflowHarnessResult> {
  await options.beforeSpawn?.()

  const spawnPrepared = prepareHarness(request, options)
  if (isPreparationFailure(spawnPrepared)) {
    return result(request, 'refused', spawnPrepared.reason)
  }
  if (
    spawnPrepared.harnessPath !== prepared.harnessPath ||
    spawnPrepared.coreHarnessPath !== prepared.coreHarnessPath ||
    spawnPrepared.fingerprint !== prepared.fingerprint
  ) {
    return result(request, 'refused', 'path-not-allowed')
  }

  const chunks: Buffer[] = []
  let capturedBytes = 0
  let boundReason: WorkflowHarnessResultReason | null = null
  let spawnFailed = false
  let settled = false
  const startedAt = Date.now()

  const child = spawn(
    spawnPrepared.harnessPath,
    [spawnPrepared.artifactPath],
    {
      cwd: scratchRoot,
      detached: true,
      shell: false,
      env: fixedEnvironment(scratchRoot),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  const setBound = (reason: WorkflowHarnessResultReason): void => {
    if (settled || boundReason) return
    boundReason = reason
    killProcessGroup(child.pid)
  }
  const capture = (chunk: Buffer | string): void => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    const previous = capturedBytes
    capturedBytes = appendBounded(
      chunks,
      buffer,
      capturedBytes,
      limits.outputBytes,
    )
    if (
      previous + buffer.length > limits.outputBytes ||
      capturedBytes > limits.outputBytes
    ) {
      setBound('output-limit')
    }
  }

  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  child.once('error', () => {
    spawnFailed = true
  })

  const sample = (): void => {
    if (settled || boundReason || !child.pid) return
    if (processGroupRssBytes(child.pid) > limits.memoryBytes) {
      setBound('memory-limit')
      return
    }
    if (directoryBytes(scratchRoot) > limits.scratchBytes) {
      setBound('scratch-limit')
    }
  }
  sample()
  const sampleTimer = setInterval(sample, limits.sampleIntervalMs)
  const timeout = setTimeout(() => setBound('time-limit'), limits.timeoutMs)

  const exitCode = await new Promise<number | null>((resolveExit) => {
    child.once('close', (code) => {
      settled = true
      resolveExit(code)
    })
  })
  clearInterval(sampleTimer)
  clearTimeout(timeout)
  if (!boundReason && Date.now() - startedAt > limits.timeoutMs) {
    boundReason = 'time-limit'
  }
  if (!boundReason && directoryBytes(scratchRoot) > limits.scratchBytes) {
    boundReason = 'scratch-limit'
  }
  if (boundReason) killProcessGroup(child.pid)

  const rawOutput = Buffer.concat(chunks).toString('utf8')
  const output = redactOutput(
    rawOutput,
    [
      sourceFamilyRoot(options),
      daemonStateRoot(options),
      prepared.hostRoot,
      prepared.coreRoot,
      prepared.harnessPath,
      prepared.artifactPath,
      prepared.referencePath,
      scratchRoot,
      homedir(),
    ],
    limits.outputBytes,
  )

  if (boundReason === 'time-limit') {
    return result(request, 'timeout', 'time-limit', output)
  }
  if (boundReason) {
    return result(request, 'bounded-out', boundReason, output)
  }
  if (spawnFailed || exitCode === null) {
    return result(request, 'refused', 'spawn-failed', output)
  }

  const completedAtIso = (options.now ?? (() => new Date()))().toISOString()
  return {
    schemaVersion: 1,
    ...safeRequest(request),
    state: 'completed',
    passed: exitCode === 0,
    completedAtIso,
    ageMs: 0,
    output,
    cached: false,
  }
}

export async function runWorkflowHarness(
  request: WorkflowHarnessRequest,
  options: WorkflowHarnessRunOptions = {},
): Promise<WorkflowHarnessResult> {
  if (!isHostId(request.hostId) || !isHarnessId(request.harnessId)) {
    return result(request, 'refused', 'unknown-selection')
  }
  if (activeHosts.has(request.hostId)) {
    return result(request, 'busy', 'host-busy')
  }
  if (activeRuns >= MAX_CONCURRENT_RUNS) {
    return result(request, 'busy', 'capacity-busy')
  }

  activeHosts.add(request.hostId)
  activeRuns += 1
  let scratchRoot: string | null = null
  try {
    const prepared = prepareHarness(request, options)
    if (isPreparationFailure(prepared)) {
      return result(request, 'refused', prepared.reason)
    }

    let state
    try {
      state = ensureStateTree(options)
      scratchRoot = mkdtempSync(join(state.tmpRoot, 'run-'))
      chmodSync(scratchRoot, 0o700)
      const canonicalScratch = realpathSync(scratchRoot)
      if (!isInside(canonicalScratch, state.tmpRoot)) {
        return result(request, 'refused', 'path-not-allowed')
      }
      scratchRoot = canonicalScratch
    } catch {
      return result(request, 'refused', 'path-not-allowed')
    }

    const runResult = await executePrepared(
      request,
      prepared,
      scratchRoot,
      effectiveLimits(options),
      options,
    )
    if (runResult.state === 'completed') {
      writeCache(cachePath(state.resultsRoot, request), {
        fingerprint: prepared.fingerprint,
        result: runResult,
      })
    }
    return runResult
  } finally {
    if (scratchRoot) {
      rmSync(scratchRoot, { recursive: true, force: true })
    }
    activeHosts.delete(request.hostId)
    activeRuns -= 1
  }
}

export async function readWorkflowHarnessResult(
  request: WorkflowHarnessRequest,
  options: WorkflowHarnessRunOptions = {},
): Promise<WorkflowHarnessResult | null> {
  const prepared = prepareHarness(request, options)
  if (isPreparationFailure(prepared)) return null
  const resultsRoot = existingResultsRoot(options)
  if (!resultsRoot) return null
  const limits = effectiveLimits(options)
  const cached = readCache(
    cachePath(resultsRoot, request),
    resultsRoot,
    request,
    limits.outputBytes,
  )
  if (!cached || cached.fingerprint !== prepared.fingerprint) return null

  const completedAt = Date.parse(cached.result.completedAtIso!)
  if (!Number.isFinite(completedAt)) return null
  const now = (options.now ?? (() => new Date()))().getTime()
  return {
    ...cached.result,
    output: redactOutput(
      cached.result.output,
      [
        sourceFamilyRoot(options),
        daemonStateRoot(options),
        prepared.hostRoot,
        prepared.coreRoot,
        prepared.harnessPath,
        prepared.artifactPath,
        prepared.referencePath,
        homedir(),
      ],
      limits.outputBytes,
    ),
    ageMs: Math.max(0, now - completedAt),
    cached: true,
  }
}
