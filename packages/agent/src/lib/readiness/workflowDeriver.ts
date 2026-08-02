/**
 * workflowDeriver.ts — the `workflow` check.
 *
 * The four hosts do not install skills the same way, so one resolution strategy
 * would produce a correct answer for one of them and nonsense for the rest:
 *
 *   claude    repo-scoped     .claude/skills/agentic-apps-workflow/SKILL.md
 *                             carries both `version` and `implements_spec`
 *   codex     machine-global  .codex/workflow-version.txt holds the scaffolder
 *                             version; the real implements_spec lives in the
 *                             host's machine-wide skills directory
 *   opencode  machine-global  as codex, under its own marker and root
 *   pi        unpinnable      no per-repo version artifact exists at all
 *
 * Pi therefore reports `na` with a reason rather than a synthesised number: an
 * honest gap beats an invented value. For the machine-global hosts the check
 * reports *both* values and says plainly that the global one is not
 * repo-specific — reporting a single number there would fake a granularity that
 * does not exist.
 *
 * Known limitation, stated in every derived summary: there is no migration
 * ledger anywhere in a scaffolded project, so this is a frontmatter comparison,
 * the most accurate available signal rather than the most accurate conceivable
 * one.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { PathResolver } from '../coverageResolver.js'
import { compareSemver } from '../scanners/workflowVersionScanner.js'
import { parseFrontmatter } from '../skillsScan.js'

import { clampSummary, type DerivedCheck } from './derivedCheck.js'
import { lastCommitTouching } from './gitFacts.js'

export type ReadinessHostId = 'claude' | 'codex' | 'opencode' | 'pi'

export interface WorkflowSources {
  /** Absolute path of each host's own workflow repo, where reachable. */
  hostRepos: Partial<Record<ReadinessHostId, string>>
  /**
   * Absolute path of each host's machine-global skills root. Named roots only:
   * no request and no readiness file supplies these paths.
   */
  machineSkillRoots: Partial<Record<ReadinessHostId, string>>
}

export interface DeriveWorkflowOptions {
  root: string
  now: number
  sources: WorkflowSources
  resolve: PathResolver
}

const SKILL_ID = 'agentic-apps-workflow'
const SKILL_FILE = 'SKILL.md'
/** Read bound for any skill or stamp this check opens, repo or machine-wide. */
const MAX_ARTIFACT_BYTES = 512 * 1024
const LEDGER_NOTE =
  'This compares SKILL.md frontmatter; no migration ledger exists, so it is not a record of which migrations ran.'

interface HostDefinition {
  id: ReadinessHostId
  /** Repo-relative directory whose presence identifies the host. */
  marker: string
  strategy: 'repo-scoped' | 'machine-global' | 'unpinnable'
  /** repo-scoped: candidate repo-relative SKILL.md paths, in probe order. */
  repoSkills?: string[]
  /** machine-global: repo-relative scaffolder version stamp. */
  stamp?: string
  /** The primary skill's path inside that host's own repo. */
  hostSkill: string
  /** Symbolic name for the machine-global root; never an absolute path. */
  machineRootLabel?: string
}

/**
 * Detection order is fixed so a repo carrying more than one host directory
 * always resolves the same way. Only these four layouts are supported.
 */
const HOSTS: readonly HostDefinition[] = [
  {
    id: 'claude',
    marker: '.claude',
    strategy: 'repo-scoped',
    repoSkills: [
      `.claude/skills/${SKILL_ID}/${SKILL_FILE}`,
      `.claude/skills/${SKILL_ID}/skill/${SKILL_FILE}`,
    ],
    hostSkill: `skill/${SKILL_FILE}`,
  },
  {
    id: 'codex',
    marker: '.codex',
    strategy: 'machine-global',
    stamp: '.codex/workflow-version.txt',
    hostSkill: `skills/${SKILL_ID}/${SKILL_FILE}`,
    machineRootLabel: 'the codex machine-wide skills directory',
  },
  {
    id: 'opencode',
    marker: '.opencode',
    strategy: 'machine-global',
    stamp: '.opencode/workflow-version.txt',
    hostSkill: `skills/${SKILL_ID}/${SKILL_FILE}`,
    machineRootLabel: 'the opencode machine-wide skills directory',
  },
  {
    id: 'pi',
    marker: '.pi',
    strategy: 'unpinnable',
    hostSkill: `skills/${SKILL_ID}/${SKILL_FILE}`,
  },
]

interface SkillVersions {
  version: string
  implementsSpec: string
}

export async function deriveWorkflow(opts: DeriveWorkflowOptions): Promise<DerivedCheck> {
  const host = detectHost(opts.root)
  if (!host) {
    return failure(
      'workflow-host-unknown',
      'no supported workflow host directory is present in this repo',
    )
  }

  if (host.strategy === 'unpinnable') {
    return {
      status: 'na',
      at: null,
      value: null,
      threshold: null,
      summary: `The ${host.id} host exposes no per-repo version artifact, so no workflow version can be pinned for this repo. No version is inferred.`,
      evidence: null,
      error: null,
    }
  }

  const shipped = readShippedVersions(host, opts)
  if (!shipped) {
    return failure(
      'workflow-reference-unavailable',
      `the ${host.id} workflow repo could not be read, so there is nothing to compare against`,
    )
  }

  return host.strategy === 'repo-scoped'
    ? repoScoped(host, shipped, opts)
    : machineGlobal(host, shipped, opts)
}

/**
 * Which host this repo is on, for callers that need the identity rather than
 * the check — the remedy text names that host's own update command.
 */
export function detectHostId(root: string): ReadinessHostId | null {
  return detectHost(root)?.id ?? null
}

function detectHost(root: string): HostDefinition | null {
  const present = HOSTS.filter((host) => existsSync(join(root, host.marker)))
  if (present.length === 0) return null
  // A repo may carry several host directories; the one that actually holds a
  // workflow artifact wins, and the fixed order breaks any remaining tie.
  return present.find((host) => artifactPath(root, host) !== null) ?? present[0]!
}

function artifactPath(root: string, host: HostDefinition): string | null {
  // An unpinnable host declares neither, and has no artifact by definition.
  const candidates =
    host.strategy === 'repo-scoped' ? host.repoSkills ?? [] : host.stamp ? [host.stamp] : []
  return candidates.find((candidate) => existsSync(join(root, candidate))) ?? null
}

function readShippedVersions(
  host: HostDefinition,
  opts: DeriveWorkflowOptions,
): SkillVersions | null {
  const hostRepo = opts.sources.hostRepos[host.id]
  if (!hostRepo) return null
  return readSkillVersions(join(hostRepo, host.hostSkill), [hostRepo], opts.resolve)
}

/**
 * Reads a SKILL.md through the resolver, so every path — repo-scoped or
 * machine-global — is canonicalised and checked against a named root before it
 * is opened. Identity is checked too: a directory of the right name holding
 * some other skill is not this skill.
 */
function readSkillVersions(
  candidate: string,
  roots: string[],
  resolve: PathResolver,
): SkillVersions | null {
  let canonical: string
  try {
    canonical = resolve(candidate, { allowedNames: [SKILL_FILE], roots })
  } catch {
    return null
  }

  if (!withinBound(canonical)) return null

  const frontmatter = parseFrontmatter(canonical)
  if (!frontmatter) return null
  if (frontmatter.name !== SKILL_ID) return null

  const version = asSemver(frontmatter.version)
  const implementsSpec = asSemver(frontmatter.implements_spec)
  if (!version || !implementsSpec) return null
  return { version, implementsSpec }
}

function withinBound(absolute: string): boolean {
  try {
    return statSync(absolute).size <= MAX_ARTIFACT_BYTES
  } catch {
    return false
  }
}

/**
 * Anchored at both ends. Unanchored, `3.2.0garbage` parsed as a version and the
 * trailing text rode along into the comparison, where the patch component became
 * `NaN` — so a malformed artifact compared equal to nothing, fell through every
 * branch, and reported `ok` with no error at all.
 */
const asSemver = (value: unknown): string | null =>
  typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value.trim()) ? value.trim() : null

async function repoScoped(
  host: HostDefinition,
  shipped: SkillVersions,
  opts: DeriveWorkflowOptions,
): Promise<DerivedCheck> {
  const relative = artifactPath(opts.root, host)
  if (!relative) return neverInstalled(host)

  const installed = readSkillVersions(
    join(opts.root, relative),
    [join(opts.root, host.marker), opts.root],
    opts.resolve,
  )
  if (!installed) {
    return failure(
      'workflow-artifact-malformed',
      `${relative} is not a readable ${SKILL_ID} skill with both a version and an implements_spec`,
    )
  }

  const { status, verdict } = compare(installed.implementsSpec, shipped.implementsSpec, installed.version, shipped.version)
  const stamp = await evidenceFor(opts, relative)
  return {
    status,
    at: stamp.at,
    value: `${installed.version} · spec ${installed.implementsSpec}`,
    threshold: null,
    summary: clampSummary(
      `The ${host.id} workflow skill in this repo is ${installed.version} (spec ${installed.implementsSpec}) against ${shipped.version} (spec ${shipped.implementsSpec}) shipped by its host repo — ${verdict}. ${LEDGER_NOTE}`,
    ),
    evidence: stamp.evidence,
    error: null,
  }
}

async function machineGlobal(
  host: HostDefinition,
  shipped: SkillVersions,
  opts: DeriveWorkflowOptions,
): Promise<DerivedCheck> {
  const relative = artifactPath(opts.root, host)
  if (!relative) return neverInstalled(host)

  const scaffolder = readStamp(join(opts.root, relative), [opts.root], opts.resolve)
  if (!scaffolder) {
    return failure(
      'workflow-artifact-malformed',
      `${relative} does not carry a readable version`,
    )
  }

  const machineRoot = opts.sources.machineSkillRoots[host.id]
  const global = machineRoot
    ? readSkillVersions(join(machineRoot, SKILL_ID, SKILL_FILE), [machineRoot], opts.resolve)
    : null
  if (!global) {
    return failure(
      'workflow-global-unavailable',
      `${host.machineRootLabel ?? 'the machine-wide skills directory'} could not be read`,
    )
  }

  const { status, verdict } = compare(global.implementsSpec, shipped.implementsSpec, scaffolder, shipped.version)
  const stamp = await evidenceFor(opts, relative)
  return {
    status,
    at: stamp.at,
    value: `${scaffolder} · spec ${global.implementsSpec} (machine-wide)`,
    threshold: null,
    summary: clampSummary(
      `This repo pins the ${host.id} scaffolder at ${scaffolder} against ${shipped.version} shipped. Its implements_spec, ${global.implementsSpec} against ${shipped.implementsSpec}, comes from ${host.machineRootLabel ?? 'the machine-wide skills directory'} and applies to every project on this machine for that host, not to this repo alone — ${verdict}. ${LEDGER_NOTE}`,
    ),
    evidence: stamp.evidence,
    error: null,
  }
}

/**
 * `implements_spec` decides first: a repo running an older contract is failing
 * whatever its scaffolder or skill version says. A trailing version alone is a
 * warning, and anything level or ahead is ok.
 */
function compare(
  installedSpec: string,
  shippedSpec: string,
  installedVersion: string,
  shippedVersion: string,
): { status: 'ok' | 'warn' | 'fail'; verdict: string } {
  if (compareSemver(installedSpec, shippedSpec) < 0) {
    return { status: 'fail', verdict: 'the workflow spec it implements is behind' }
  }
  if (compareSemver(installedVersion, shippedVersion) < 0) {
    return { status: 'warn', verdict: 'the installed version trails' }
  }
  return { status: 'ok', verdict: 'both are level with the host repo' }
}

function readStamp(candidate: string, roots: string[], resolve: PathResolver): string | null {
  let canonical: string
  try {
    canonical = resolve(candidate, { extension: '.txt', roots })
  } catch {
    return null
  }
  if (!withinBound(canonical)) return null
  try {
    return asSemver(readFileSync(canonical, 'utf8'))
  } catch {
    return null
  }
}

async function evidenceFor(
  opts: DeriveWorkflowOptions,
  relative: string,
): Promise<{ at: number; evidence: { path: string; commit: string | null } }> {
  const commit = await lastCommitTouching(opts.root, [relative])
  return {
    at: commit?.at ?? opts.now,
    evidence: { path: relative, commit: commit?.sha ?? null },
  }
}

function neverInstalled(host: HostDefinition): DerivedCheck {
  return {
    status: 'never',
    at: null,
    value: null,
    threshold: null,
    summary: `The ${host.id} host directory is present but carries no workflow version artifact, so no workflow has been installed here.`,
    evidence: null,
    error: null,
  }
}

function failure(code: string, message: string): DerivedCheck {
  return {
    status: 'fail',
    at: null,
    value: null,
    threshold: null,
    summary: clampSummary(`This check could not be evaluated: ${message}.`),
    evidence: null,
    error: { code, message },
  }
}
