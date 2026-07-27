import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  WorkflowResponseSchema,
  type WorkflowResponse,
} from '@agenticapps/dashboard-shared'

import { makeCoverageResolver } from './coverageResolver.js'
import { readCoreSpecVersion } from './scanners/coreSpecVersionScanner.js'
import {
  scanWorkflowHostArtifacts,
  scanWorkflowMachineRoot,
} from './scanners/workflowArtifactScanner.js'
import type { WorkflowMachineRootId } from './scanners/workflowArtifactScanner.declare.js'
import {
  WORKFLOW_FLEET,
  scanWorkflowHostSkills,
} from './scanners/workflowFleetScanner.js'
import type {
  WorkflowFleetEntry,
  WorkflowHostId,
  WorkflowSkillSource,
} from './scanners/workflowFleetScanner.declare.js'
import type { WorkflowScanOptions } from './workflowScan.declare.js'

type MachineRootPaths = Record<WorkflowMachineRootId, string>

function defaultMachineRoots(): MachineRootPaths {
  const home = homedir()
  const codexHome = process.env.CODEX_HOME || join(home, '.codex')
  const opencodeConfig = process.env.OPENCODE_CONFIG_DIR || join(home, '.config', 'opencode')
  return {
    'agenticapps-bin': join(home, '.agenticapps', 'bin'),
    'claude-skills': join(home, '.claude', 'skills'),
    'codex-skills': join(codexHome, 'skills'),
    'opencode-skills': join(opencodeConfig, 'skills'),
    'pi-skills': join(
      home,
      '.pi',
      'agent',
      'git',
      'github.com',
      'agenticapps-eu',
      'pi-agentic-apps-workflow',
      'skills',
    ),
  }
}

function resolveRepo(
  sourceFamilyRoot: string,
  entry: WorkflowFleetEntry,
  resolve: ReturnType<typeof makeCoverageResolver>,
): string | null {
  try {
    return resolve(join(sourceFamilyRoot, entry.directoryName), {
      allowedNames: [entry.directoryName],
      roots: [sourceFamilyRoot],
    })
  } catch {
    return null
  }
}

function missingHost(hostId: WorkflowHostId) {
  return {
    hostId,
    state: 'missing' as const,
    primary: null,
    skills: [],
    minimum: null,
    maximum: null,
    laggards: [],
    unknowns: [],
    internallyConsistent: false,
    coreState: 'unavailable' as const,
    divergent: true,
    artifacts: [],
    migration: { kind: 'offered' as const, highest: null },
  }
}

function machineSkillIds(
  skillSource: WorkflowSkillSource,
  scannedIds: string[],
): string[] {
  if (skillSource.kind === 'directory') return scannedIds
  return skillSource.skills
    .filter(({ machineInstalled }) => machineInstalled !== false)
    .map(({ id }) => id)
}

export async function scanWorkflowFleet(
  options: WorkflowScanOptions = {},
): Promise<WorkflowResponse> {
  const sourceFamilyRoot =
    options.sourceFamilyRoot ?? join(homedir(), 'Sourcecode', 'agenticapps')
  const resolve = makeCoverageResolver({
    sourcecodeRoot: dirname(sourceFamilyRoot),
  })
  const coreEntry = WORKFLOW_FLEET[0]!
  const coreRoot = resolveRepo(sourceFamilyRoot, coreEntry, resolve)
  const coreVersion = coreRoot
    ? readCoreSpecVersion(coreRoot, resolve)
    : null

  const hostEntries = WORKFLOW_FLEET.slice(1).filter(
    (entry): entry is WorkflowFleetEntry & {
      id: WorkflowHostId
      role: 'host'
      skillSource: WorkflowSkillSource
    } => entry.role === 'host' && entry.skillSource !== undefined,
  )
  const settled = await Promise.allSettled(
    hostEntries.map(async (entry) => {
      const hostRoot = resolveRepo(sourceFamilyRoot, entry, resolve)
      if (!hostRoot || !coreRoot) return missingHost(entry.id)

      const skills = scanWorkflowHostSkills(
        entry.id,
        hostRoot,
        coreVersion,
        resolve,
      )
      const artifacts = scanWorkflowHostArtifacts(
        entry.id,
        hostRoot,
        coreRoot,
        resolve,
      )
      return {
        hostId: entry.id,
        state: 'available' as const,
        primary: skills.primary,
        skills: skills.skills,
        minimum: skills.minimum,
        maximum: skills.maximum,
        laggards: skills.laggards,
        unknowns: skills.unknowns,
        internallyConsistent: skills.internallyConsistent,
        coreState: skills.coreState,
        divergent: skills.divergent,
        artifacts: artifacts.artifacts,
        migration: artifacts.migration,
      }
    }),
  )
  const hosts = hostEntries.map((entry, index) => {
    const result = settled[index]
    return result?.status === 'fulfilled'
      ? result.value
      : missingHost(entry.id)
  })

  const configuredMachineRoots = {
    ...defaultMachineRoots(),
    ...options.machineRoots,
  }
  const expectedSkills = new Map(
    hostEntries.map((entry, index) => {
      const host = hosts[index]!
      return [
        entry.id,
        machineSkillIds(
          entry.skillSource,
          host.skills.map(({ id }) => id),
        ),
      ] as const
    }),
  )
  const rootToHost: Partial<Record<WorkflowMachineRootId, WorkflowHostId>> = {
    'claude-skills': 'claude-workflow',
    'codex-skills': 'codex-workflow',
    'opencode-skills': 'opencode-workflow',
    'pi-skills': 'pi-agentic-apps-workflow',
  }
  const machineRootIds: WorkflowMachineRootId[] = [
    'agenticapps-bin',
    'claude-skills',
    'codex-skills',
    'opencode-skills',
    'pi-skills',
  ]
  const machineRoots = machineRootIds.map((rootId) => {
    const hostId = rootToHost[rootId]
    return scanWorkflowMachineRoot(
      rootId,
      configuredMachineRoots[rootId],
      resolve,
      rootId === 'agenticapps-bin'
        ? coreRoot
          ? { coreRepoRoot: coreRoot }
          : {}
        : { expectedSkillIds: hostId ? expectedSkills.get(hostId) ?? [] : [] },
    )
  })

  return WorkflowResponseSchema.parse({
    schemaVersion: 1,
    generatedAtIso: (options.now ?? (() => new Date()))().toISOString(),
    core: {
      repoId: 'agenticapps-workflow-core',
      state: coreVersion ? 'available' : 'missing',
      specVersion: coreVersion,
    },
    hosts,
    machineRoots,
  })
}
