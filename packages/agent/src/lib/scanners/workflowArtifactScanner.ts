import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { PathResolver } from '../coverageResolver.js'
import type { Containment } from '../containment.js'
import { DAEMON_NAMED_REASONS } from '../containment.js'
import { WORKFLOW_FLEET } from './workflowFleetScanner.js'
import type {
  WorkflowArtifactId,
  WorkflowHostId,
} from './workflowFleetScanner.declare.js'
import type {
  WorkflowArtifactResult,
  WorkflowHostArtifactSummary,
  WorkflowMachineEntry,
  WorkflowMachineRootDefinition,
  WorkflowMachineRootId,
  WorkflowMachineRootOptions,
  WorkflowMachineRootResult,
  WorkflowPin,
  WorkflowProvenance,
  WorkflowVersionMarker,
} from './workflowArtifactScanner.declare.js'

export const WORKFLOW_MACHINE_ROOTS: readonly WorkflowMachineRootDefinition[] = [
  { id: 'agenticapps-bin', kind: 'artifacts' },
  {
    id: 'claude-skills',
    kind: 'skills',
    hostId: 'claude-workflow',
    skillTargetNames: {
      'agentic-apps-workflow': ['skill'],
      'setup-agenticapps-workflow': ['setup'],
      'update-agenticapps-workflow': ['update'],
    },
  },
  { id: 'codex-skills', kind: 'skills', hostId: 'codex-workflow' },
  { id: 'opencode-skills', kind: 'skills', hostId: 'opencode-workflow' },
  {
    id: 'pi-skills',
    kind: 'skills',
    hostId: 'pi-agentic-apps-workflow',
  },
]

const ARTIFACT_IDS: readonly WorkflowArtifactId[] = [
  'change-gate',
  'reviewer-cli',
  'change-gate-harness',
  'reviewer-cli-harness',
]

const MACHINE_ARTIFACTS: readonly {
  artifactId: 'change-gate' | 'reviewer-cli'
  filename: string
}[] = [
  { artifactId: 'change-gate', filename: 'openspec-change-gate.sh' },
  { artifactId: 'reviewer-cli', filename: 'reviewer-cli.sh' },
]

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function isStrictSemver(value: string): boolean {
  const match = value.match(SEMVER_RE)
  if (!match) return false
  return !(match[4]?.split('.').some(
    (identifier) => /^\d+$/.test(identifier) && /^0\d/.test(identifier),
  ) ?? false)
}

/**
  * `containment` is a PARAMETER, not a choice made here. This helper is called
  * with a host repository root (via readBytes at the compareArtifact host call)
  * and with a machine root (via the machine-root scan), so a classification
  * synthesised here would label one of them wrongly — D8 of the change.
  */
function resolveFile(
  root: string,
  relativePath: string,
  resolve: PathResolver,
  containment: Containment,
): string | null {
  try {
    return resolve(join(root, relativePath), {
      allowedNames: [basename(relativePath)],
      roots: [root],
      containment,
    })
  } catch {
    return null
  }
}

function readBytes(
  root: string,
  relativePath: string,
  resolve: PathResolver,
  containment: Containment,
): { bytes: Buffer; sha256: string } | null {
  const filePath = resolveFile(root, relativePath, resolve, containment)
  if (!filePath) return null

  try {
    const bytes = readFileSync(filePath)
    return {
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  } catch {
    return null
  }
}

function markerFor(
  artifactId: WorkflowArtifactId,
  bytes: Buffer | null,
): WorkflowVersionMarker {
  const markerName =
    artifactId === 'change-gate'
      ? 'gate-version'
      : artifactId === 'reviewer-cli'
        ? 'reviewer-cli-version'
        : null
  if (!markerName) return { state: 'not-applicable', version: null }
  if (!bytes) return { state: 'absent', version: null }

  const markerPattern = new RegExp(
    `^#\\s*${markerName.replace('-', '\\-')}\\s*:\\s*(.*?)\\s*$`,
  )
  const declarations = bytes
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.match(markerPattern)?.[1])
    .filter((value): value is string => value !== undefined)

  if (declarations.length === 0) return { state: 'absent', version: null }
  if (declarations.length !== 1 || !isStrictSemver(declarations[0]!)) {
    return { state: 'invalid', version: null }
  }
  return { state: 'valid', version: declarations[0]! }
}

interface ProvenanceManifest {
  state: 'valid' | 'absent' | 'invalid'
  commit: string | null
  coveredPaths: Set<string>
  /**
   * Entry key -> recorded digest. The keys are the host's publish targets, NOT
   * paths in core: claude-workflow records `bin/openspec-change-gate.sh`, which
   * core does not have (its copy is under reference-implementations/). Only the
   * digest ties an entry to core, which is why pin verification keys on the
   * artefact mapping and never on resolving these paths against core's tree.
   */
  digests: Map<string, string>
}

function readProvenanceManifest(
  hostRepoRoot: string,
  relativePath: string | undefined,
  resolve: PathResolver,
): ProvenanceManifest {
  const empty = (state: ProvenanceManifest['state']): ProvenanceManifest => ({
    state,
    commit: null,
    coveredPaths: new Set(),
    digests: new Map(),
  })

  if (!relativePath) return empty('absent')

  const manifestPath = resolveFile(hostRepoRoot, relativePath, resolve, {
    kind: 'repository-root',
  })
  if (!manifestPath) return empty('absent')

  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf8')
  } catch {
    return empty('absent')
  }

  const lines = raw.split(/\r?\n/)
  const commits = lines
    .map((line) => line.match(/^core_commit=(\S+)\s*$/)?.[1])
    .filter((value): value is string => value !== undefined)
  if (commits.length === 0) return empty('absent')
  if (commits.length !== 1 || !/^[0-9a-fA-F]{40}$/.test(commits[0]!)) {
    return empty('invalid')
  }

  const digests = new Map<string, string>(
    lines
      .map((line) => line.match(/^file=(\S+)\s+sha256=([0-9a-fA-F]{64})\s*$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1]!, match[2]!.toLowerCase()] as const),
  )
  return {
    state: 'valid',
    commit: commits[0]!,
    coveredPaths: new Set(digests.keys()),
    digests,
  }
}

/**
 * Pin integrity for one artefact.
 *
 * `referenceSha256` is core's CURRENT reference digest. A recorded digest that
 * differs means the host is pinned to something other than that — reported as
 * `behind`, never as a dishonest manifest, because distinguishing the two would
 * require reading core at the pinned commit.
 */
function pinFor(
  manifest: ProvenanceManifest,
  hostRelativePath: string,
  referenceSha256: string | null,
): WorkflowPin {
  if (manifest.state === 'absent') {
    return { state: 'not-declared', commit: null, recordedSha256: null }
  }
  if (manifest.state === 'invalid') {
    return { state: 'invalid', commit: null, recordedSha256: null }
  }

  const recordedSha256 = manifest.digests.get(hostRelativePath) ?? null
  if (!recordedSha256) {
    return { state: 'unlisted', commit: manifest.commit, recordedSha256: null }
  }
  return {
    state: recordedSha256 === referenceSha256 ? 'intact' : 'behind',
    commit: manifest.commit,
    recordedSha256,
  }
}

function provenanceFor(
  manifest: ProvenanceManifest,
  relativePath: string,
): WorkflowProvenance {
  if (manifest.state === 'invalid') return { state: 'invalid', commit: null }
  if (
    manifest.state === 'absent' ||
    !manifest.commit ||
    !manifest.coveredPaths.has(relativePath)
  ) {
    return { state: 'absent', commit: null }
  }
  return { state: 'valid', commit: manifest.commit }
}

function readOfferedMigration(
  hostRepoRoot: string,
  resolve: PathResolver,
): string | null {
  let migrationsDir: string
  try {
    migrationsDir = resolve(join(hostRepoRoot, 'migrations'), {
      allowedNames: ['migrations'],
      roots: [hostRepoRoot],
      containment: { kind: 'repository-root' },
    })
  } catch {
    return null
  }

  let names: string[]
  try {
    names = readdirSync(migrationsDir)
  } catch {
    return null
  }

  return (
    names
      .map((name) => name.match(/^(\d{4})-.+\.md$/)?.[1])
      .filter((value): value is string => value !== undefined)
      .sort()
      .at(-1) ?? null
  )
}

function compareArtifact(
  artifactId: WorkflowArtifactId,
  copyRoot: string,
  copyPath: string,
  /** What `copyRoot` IS — a host repository root at one call, a machine root at
   *  the other. Passed in rather than assumed here, per D8. */
  copyContainment: Containment,
  coreRepoRoot: string | undefined,
  referencePath: string,
  resolve: PathResolver,
  provenance: WorkflowProvenance,
  pin: WorkflowPin = { state: 'not-declared', commit: null, recordedSha256: null },
): WorkflowArtifactResult {
  const copy = readBytes(copyRoot, copyPath, resolve, copyContainment)
  // coreRepoRoot is always a repository root, at both call sites.
  const reference = coreRepoRoot
    ? readBytes(coreRepoRoot, referencePath, resolve, { kind: 'repository-root' })
    : null

  // A declared pin only speaks for an artefact the host does NOT carry. When a
  // copy is present the bytes are the observable fact and decide the state;
  // when it is absent, a pin that names this artefact means the file is
  // resolved at install time rather than missing.
  const pinnedInPlaceOfCopy =
    pin.state === 'intact' || pin.state === 'behind'

  const state: WorkflowArtifactResult['state'] = !coreRepoRoot || !reference
    ? 'unavailable'
    : copy
      ? copy.sha256 === reference.sha256
        ? 'identical'
        : 'divergent'
      : pinnedInPlaceOfCopy
        ? 'pinned'
        : 'missing'

  return {
    artifactId,
    state,
    sha256: copy?.sha256 ?? null,
    referenceSha256: reference?.sha256 ?? null,
    marker: markerFor(artifactId, copy?.bytes ?? null),
    provenance,
    pin,
  }
}

export function scanWorkflowHostArtifacts(
  hostId: WorkflowHostId,
  hostRepoRoot: string,
  coreRepoRoot: string | undefined,
  resolve: PathResolver,
): WorkflowHostArtifactSummary {
  const hostEntry = WORKFLOW_FLEET.find(({ id }) => id === hostId)
  const coreEntry = WORKFLOW_FLEET.find(
    ({ id }) => id === 'agenticapps-workflow-core',
  )
  if (!hostEntry || hostEntry.role !== 'host') {
    throw new Error(`unknown workflow host identifier: ${hostId}`)
  }
  if (!coreEntry) throw new Error('workflow core mapping is unavailable')

  const manifest = readProvenanceManifest(
    hostRepoRoot,
    hostEntry.provenanceManifest,
    resolve,
  )
  const artifacts: WorkflowArtifactResult[] = ARTIFACT_IDS.map((artifactId) => {
    const hostPath = hostEntry.artifacts[artifactId]
    const reference = coreRepoRoot
      ? readBytes(coreRepoRoot, coreEntry.artifacts[artifactId], resolve, {
          kind: 'repository-root',
        })
      : null
    return compareArtifact(
      artifactId,
      hostRepoRoot,
      hostPath,
      { kind: 'repository-root' },
      coreRepoRoot,
      coreEntry.artifacts[artifactId],
      resolve,
      provenanceFor(manifest, hostPath),
      pinFor(manifest, hostPath, reference?.sha256 ?? null),
    )
  })

  return {
    hostId,
    artifacts,
    migration: {
      kind: 'offered',
      highest: readOfferedMigration(hostRepoRoot, resolve),
    },
  }
}

export function scanWorkflowMachineRoot(
  rootId: WorkflowMachineRootId,
  rootPath: string,
  resolve: PathResolver,
  options: WorkflowMachineRootOptions = {},
): WorkflowMachineRootResult {
  const definition = WORKFLOW_MACHINE_ROOTS.find(({ id }) => id === rootId)
  if (!definition) throw new Error(`unknown workflow machine root: ${rootId}`)

  let canonicalRoot: string
  try {
    canonicalRoot = resolve(rootPath, {
      allowedNames: [basename(rootPath)],
      roots: [rootPath],
      containment: {
        kind: 'daemon-named',
        rootId,
        reason: DAEMON_NAMED_REASONS[rootId],
      },
    })
  } catch {
    return { rootId, state: 'absent', entries: [] }
  }

  if (definition.kind === 'artifacts') {
    const coreEntry = WORKFLOW_FLEET.find(
      ({ id }) => id === 'agenticapps-workflow-core',
    )
    if (!coreEntry) throw new Error('workflow core mapping is unavailable')

    const entries: WorkflowMachineEntry[] = MACHINE_ARTIFACTS.map(
      ({ artifactId, filename }) => {
        const artifact = compareArtifact(
          artifactId,
          canonicalRoot,
          filename,
          // canonicalRoot is the MACHINE root this scan is walking — the case
          // that makes resolveFile's classification a parameter (D8).
          { kind: 'daemon-named', rootId, reason: DAEMON_NAMED_REASONS[rootId] },
          options.coreRepoRoot,
          coreEntry.artifacts[artifactId],
          resolve,
          { state: 'absent', commit: null },
        )
        return {
          id: artifactId,
          state: artifact.sha256 ? 'present' : 'missing',
          artifact,
        }
      },
    )
    return { rootId, state: 'present', entries }
  }

  const entryIds = [...(options.expectedSkillIds ?? [])].sort()
  const entries: WorkflowMachineEntry[] = entryIds.map((id) => {
    try {
      resolve(join(canonicalRoot, id), {
        allowedNames: [
          id,
          ...(definition.skillTargetNames?.[id] ?? []),
        ],
        roots: [canonicalRoot],
        containment: {
          kind: 'daemon-named',
          rootId,
          reason: DAEMON_NAMED_REASONS[rootId],
        },
      })
      return { id, state: 'present' }
    } catch {
      return { id, state: 'missing' }
    }
  })
  return { rootId, state: 'present', entries }
}
