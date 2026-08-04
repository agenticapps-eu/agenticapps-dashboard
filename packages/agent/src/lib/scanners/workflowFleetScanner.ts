import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { PathResolver } from '../coverageResolver.js'
import type {
  WorkflowArtifactId,
  WorkflowFleetEntry,
  WorkflowHostId,
  WorkflowHostSkillSummary,
  WorkflowRepoId,
  WorkflowSkillPath,
  WorkflowSkillReason,
  WorkflowSkillSource,
  WorkflowSkillVersion,
} from './workflowFleetScanner.declare.js'

const CORE_ARTIFACTS: Readonly<Record<WorkflowArtifactId, string>> = {
  'change-gate':
    'reference-implementations/openspec-change-gate/openspec-change-gate.sh',
  'reviewer-cli': 'reference-implementations/reviewer-cli/reviewer-cli.sh',
  'change-gate-harness': 'tools/change-gate-conformance.sh',
  'reviewer-cli-harness': 'tools/reviewer-cli-conformance.sh',
}

const HOST_ARTIFACTS: Readonly<Record<WorkflowArtifactId, string>> = {
  'change-gate': 'bin/openspec-change-gate.sh',
  'reviewer-cli': 'bin/reviewer-cli.sh',
  'change-gate-harness': 'tools/change-gate-conformance.sh',
  'reviewer-cli-harness': 'tools/reviewer-cli-conformance.sh',
}

const CLAUDE_SKILLS: readonly WorkflowSkillPath[] = [
  {
    id: 'agentic-apps-workflow',
    relativePath: 'skill/SKILL.md',
    primary: true,
  },
  {
    id: 'setup-agenticapps-workflow',
    relativePath: 'setup/SKILL.md',
  },
  {
    id: 'update-agenticapps-workflow',
    relativePath: 'update/SKILL.md',
  },
  {
    id: 'ts-declare-first',
    relativePath: 'ts-declare-first/SKILL.md',
  },
  {
    id: 'agentic-apps-workflow-snapshot',
    relativePath: 'setup/snapshot/agentic-apps-workflow-SKILL.md',
    machineInstalled: false,
  },
]

function directorySkills(primaryId: string): WorkflowSkillSource {
  return {
    kind: 'directory',
    relativeRoot: 'skills',
    primaryId,
  }
}

export const WORKFLOW_FLEET: readonly WorkflowFleetEntry[] = [
  {
    id: 'agenticapps-workflow-core',
    role: 'core',
    directoryName: 'agenticapps-workflow-core',
    artifacts: CORE_ARTIFACTS,
  },
  {
    id: 'claude-workflow',
    role: 'host',
    directoryName: 'claude-workflow',
    artifacts: HOST_ARTIFACTS,
    provenanceManifest: 'tools/core-vendor.manifest',
    skillSource: {
      kind: 'explicit',
      skills: CLAUDE_SKILLS,
    },
  },
  {
    id: 'codex-workflow',
    role: 'host',
    directoryName: 'codex-workflow',
    artifacts: HOST_ARTIFACTS,
    provenanceManifest: 'tools/core-vendor.manifest',
    skillSource: directorySkills('agentic-apps-workflow'),
  },
  {
    id: 'opencode-workflow',
    role: 'host',
    directoryName: 'opencode-workflow',
    artifacts: HOST_ARTIFACTS,
    provenanceManifest: 'tools/core-vendor.manifest',
    skillSource: directorySkills('agentic-apps-workflow'),
  },
  {
    id: 'pi-agentic-apps-workflow',
    role: 'host',
    directoryName: 'pi-agentic-apps-workflow',
    artifacts: HOST_ARTIFACTS,
    provenanceManifest: 'tools/core-vendor.manifest',
    skillSource: directorySkills('agentic-apps-workflow'),
  },
]

interface ParsedSemver {
  raw: string
  major: bigint
  minor: bigint
  patch: bigint
  prerelease: string[]
}

function parseSemver(value: string): ParsedSemver | null {
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
  if (!match) return null

  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && /^0\d/.test(identifier))) {
    return null
  }

  return {
    raw: value,
    major: BigInt(match[1]!),
    minor: BigInt(match[2]!),
    patch: BigInt(match[3]!),
    prerelease,
  }
}

function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] < b[key]) return -1
    if (a[key] > b[key]) return 1
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1

  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    const aIdentifier = a.prerelease[index]
    const bIdentifier = b.prerelease[index]
    if (aIdentifier === undefined) return -1
    if (bIdentifier === undefined) return 1
    if (aIdentifier === bIdentifier) continue

    const aNumeric = /^\d+$/.test(aIdentifier)
    const bNumeric = /^\d+$/.test(bIdentifier)
    if (aNumeric && bNumeric) {
      return BigInt(aIdentifier) < BigInt(bIdentifier) ? -1 : 1
    }
    if (aNumeric) return -1
    if (bNumeric) return 1
    return aIdentifier < bIdentifier ? -1 : 1
  }

  return 0
}

function missingSkill(id: string): WorkflowSkillVersion {
  return {
    id,
    name: id,
    state: 'missing',
    version: null,
    reason: 'expected-skill-missing',
  }
}

function unknownSkill(
  id: string,
  name: string,
  reason: WorkflowSkillReason,
): WorkflowSkillVersion {
  return {
    id,
    name,
    state: 'unknown',
    version: null,
    reason,
  }
}

function readSkill(
  id: string,
  skillPath: string,
): WorkflowSkillVersion {
  let raw: string
  try {
    raw = readFileSync(skillPath, 'utf8')
  } catch {
    return missingSkill(id)
  }

  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) return unknownSkill(id, id, 'frontmatter-missing')

  const lines = frontmatter[1]!.split(/\r?\n/)
  const name =
    lines
      .map((line) => line.match(/^\s*name\s*:\s*(\S.*?)\s*$/)?.[1])
      .find((value): value is string => value !== undefined) ?? id
  const declarations = lines
    .map((line) => line.match(/^\s*implements_spec\s*:\s*(.*?)\s*$/)?.[1])
    .filter((value): value is string => value !== undefined)

  if (declarations.length === 0 || declarations[0] === '') {
    return unknownSkill(id, name, 'implements-spec-missing')
  }
  if (declarations.length !== 1) {
    return unknownSkill(id, name, 'implements-spec-duplicate')
  }

  const parsed = parseSemver(declarations[0]!)
  if (!parsed) return unknownSkill(id, name, 'implements-spec-malformed')

  return {
    id,
    name,
    state: 'known',
    version: parsed.raw,
  }
}

function readExplicitSkills(
  hostRepoRoot: string,
  paths: readonly WorkflowSkillPath[],
  resolve: PathResolver,
): WorkflowSkillVersion[] {
  return paths.map(({ id, relativePath }) => {
    let skillPath: string
    try {
      skillPath = resolve(join(hostRepoRoot, relativePath), {
        allowedNames: [basename(relativePath)],
        roots: [hostRepoRoot],
        containment: { kind: 'repository-root' },
      })
    } catch {
      return missingSkill(id)
    }
    return readSkill(id, skillPath)
  })
}

function readDirectorySkills(
  hostRepoRoot: string,
  relativeRoot: string,
  primaryId: string,
  resolve: PathResolver,
): WorkflowSkillVersion[] {
  let skillRoot: string
  try {
    skillRoot = resolve(join(hostRepoRoot, relativeRoot), {
      allowedNames: [basename(relativeRoot)],
      roots: [hostRepoRoot],
      // Anchored BEFORE the readdir below. Without this the resolution is
      // unanchored, so the family roots admit a skills/ directory symlinked
      // into a sibling repo, and enumerating it leaks that repo's entry names
      // into this one's results. Anchoring only the child reads is too late.
      containment: { kind: 'anchored', root: hostRepoRoot },
    })
  } catch {
    return [missingSkill(primaryId)]
  }

  let entryNames: string[]
  try {
    entryNames = readdirSync(skillRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          (entry.isDirectory() || entry.isSymbolicLink()) &&
          /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.name),
      )
      .map(({ name }) => name)
      .sort()
  } catch {
    return [missingSkill(primaryId)]
  }

  const skills = entryNames.map((id) => {
    let skillDir: string
    try {
      skillDir = resolve(join(skillRoot, id), {
        allowedNames: [id],
        roots: [skillRoot],
        containment: { kind: 'anchored', root: hostRepoRoot },
      })
    } catch {
      return missingSkill(id)
    }

    let skillPath: string
    try {
      skillPath = resolve(join(skillDir, 'SKILL.md'), {
        allowedNames: ['SKILL.md'],
        roots: [skillDir],
        // Anchored to the repository, not merely to skillDir: a SKILL.md
        // symlinked into a sibling repo lies under skillDir's parent family
        // root, so anchoring one level up would still admit it.
        containment: { kind: 'anchored', root: hostRepoRoot },
      })
    } catch {
      return missingSkill(id)
    }
    return readSkill(id, skillPath)
  })

  if (!skills.some((skill) => skill.id === primaryId)) {
    skills.push(missingSkill(primaryId))
  }
  return skills
}

export function requireWorkflowRepoId(identifier: string): WorkflowRepoId {
  const entry = WORKFLOW_FLEET.find(({ id }) => id === identifier)
  if (!entry) {
    throw new Error(`unknown workflow repository identifier: ${identifier}`)
  }
  return entry.id
}

export function scanWorkflowHostSkills(
  hostId: WorkflowHostId,
  hostRepoRoot: string,
  coreSpecVersion: string | null,
  resolve: PathResolver,
  options: { explanationId?: string } = {},
): WorkflowHostSkillSummary {
  const entry = WORKFLOW_FLEET.find(({ id }) => id === hostId)
  if (!entry || entry.role !== 'host' || !entry.skillSource) {
    throw new Error(`unknown workflow host identifier: ${hostId}`)
  }

  const primaryId =
    entry.skillSource.kind === 'directory'
      ? entry.skillSource.primaryId
      : entry.skillSource.skills.find(({ primary }) => primary)?.id
  if (!primaryId) throw new Error(`workflow host has no primary skill: ${hostId}`)

  const skills =
    entry.skillSource.kind === 'directory'
      ? readDirectorySkills(
          hostRepoRoot,
          entry.skillSource.relativeRoot,
          entry.skillSource.primaryId,
          resolve,
        )
      : readExplicitSkills(hostRepoRoot, entry.skillSource.skills, resolve)
  skills.sort((a, b) => a.id.localeCompare(b.id))

  const primary = skills.find(({ id }) => id === primaryId) ?? missingSkill(primaryId)
  const known = skills
    .filter(
      (skill): skill is WorkflowSkillVersion & { version: string } =>
        skill.state === 'known' && skill.version !== null,
    )
    .map((skill) => ({ skill, parsed: parseSemver(skill.version)! }))
    .sort((a, b) => compareSemver(a.parsed, b.parsed))
  const minimum = known[0]?.parsed.raw ?? null
  const maximum = known.at(-1)?.parsed.raw ?? null
  const maximumParsed = known.at(-1)?.parsed ?? null
  const laggards = maximumParsed
    ? known
        .filter(({ parsed }) => compareSemver(parsed, maximumParsed) < 0)
        .map(({ skill }) => ({
          id: skill.id,
          name: skill.name,
          version: skill.version,
        }))
    : []
  const unknowns = skills.filter(({ state }) => state !== 'known')
  const internallyConsistent =
    skills.length > 0 &&
    unknowns.length === 0 &&
    minimum !== null &&
    minimum === maximum

  let coreState: WorkflowHostSkillSummary['coreState'] = 'unavailable'
  if (coreSpecVersion && primary.state === 'known' && primary.version) {
    const parsedCore = parseSemver(coreSpecVersion)
    const parsedPrimary = parseSemver(primary.version)
    if (parsedCore && parsedPrimary) {
      const comparison = compareSemver(parsedPrimary, parsedCore)
      coreState = comparison === 0 ? 'current' : comparison < 0 ? 'behind' : 'ahead'
    }
  }

  return {
    hostId,
    primary,
    skills,
    minimum,
    maximum,
    laggards,
    unknowns,
    internallyConsistent,
    coreState,
    divergent: !internallyConsistent || coreState !== 'current',
    ...(options.explanationId ? { explanationId: options.explanationId } : {}),
  }
}
