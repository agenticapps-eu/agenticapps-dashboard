/**
 * Hybrid OpenSpec reader — project-dashboard › Hybrid OpenSpec Read Strategy.
 *
 * The CLI is preferred where it answers; the tree is the floor that always
 * answers. One value never comes from the CLI and is read from the tree on both
 * paths: task-artifact presence, because the CLI emits 0/0 for an absent
 * artifact and an empty one alike, so presence cannot be recovered from its
 * output.
 *
 * The change *set* is likewise always enumerated from the tree. The CLI supplies
 * counts for changes the tree already found; it does not decide which changes
 * exist. Were its set authoritative, a half-written change it declines to list
 * would vanish from the surface exactly when the binary is present.
 *
 * Two values this reader used to return are withdrawn by the v2 cutover, and
 * this module reads neither: the archived-change list, and each open change's
 * affected capabilities. Both had exactly one consumer apiece — the
 * change-progress column and the capability panel — and both surfaces are gone.
 * The archive is still rendered, by the lifecycle change board, which reads
 * `openspec/changes/archive/` itself so that this reader stays off that cost:
 * it sits on the `spec` readiness check's hot path, which the board does not.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { runOpenspecList } from './openspecCli.js'

export interface OpenspecChangeSummary {
  name: string
  completedTasks: number
  totalTasks: number
  /** False when the change has no task artifact at all — distinct from 0 of 0. */
  hasTaskArtifact: boolean
}

export interface OpenspecCapabilitySummary {
  id: string
  requirementCount: number
}

export interface OpenspecProjectState {
  present: boolean
  openChanges: OpenspecChangeSummary[]
  capabilities: OpenspecCapabilitySummary[]
}

const REQUIREMENT_HEADING = /^###\s+Requirement:/gm
const TASK_LINE = /^\s*[-*]\s+\[( |x|X)\]/gm

function emptyState(present: boolean): OpenspecProjectState {
  return { present, openChanges: [], capabilities: [] }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Read everything from the project's `openspec/` tree. This is the floor: it
 * never spawns anything and never throws for a malformed or partial project.
 */
export async function readOpenspecTree(projectRoot: string): Promise<OpenspecProjectState> {
  const osDir = join(projectRoot, 'openspec')
  if (!(await exists(osDir))) return emptyState(false)

  const changesDir = join(osDir, 'changes')
  const specsDir = join(osDir, 'specs')

  // An open change is any non-dot directory under changes/ other than archive/.
  // Deliberately permissive: a change is incomplete for most of its life, and a
  // reader that hides half-written changes hides the work in flight.
  const changeNames = (await listDirs(changesDir))
    .filter((n) => n !== 'archive' && !n.startsWith('.'))
    .sort()

  const openChanges = await Promise.all(
    changeNames.map(async (name) => {
      const dir = join(changesDir, name)
      const { completedTasks, totalTasks, hasTaskArtifact } = await readTaskCounts(dir)
      return { name, completedTasks, totalTasks, hasTaskArtifact }
    }),
  )

  const capabilityIds = (await listDirs(specsDir)).sort()
  const capabilities = await Promise.all(
    capabilityIds.map(async (id) => ({
      id,
      requirementCount: await countRequirements(join(specsDir, id, 'spec.md')),
    })),
  )

  return { present: true, openChanges, capabilities }
}

async function readTaskCounts(
  changeDir: string,
): Promise<{ completedTasks: number; totalTasks: number; hasTaskArtifact: boolean }> {
  let text: string
  try {
    text = await readFile(join(changeDir, 'tasks.md'), 'utf8')
  } catch {
    return { completedTasks: 0, totalTasks: 0, hasTaskArtifact: false }
  }
  let total = 0
  let done = 0
  for (const m of text.matchAll(TASK_LINE)) {
    total += 1
    if (m[1] !== ' ') done += 1
  }
  return { completedTasks: done, totalTasks: total, hasTaskArtifact: true }
}

async function countRequirements(specPath: string): Promise<number> {
  try {
    const text = await readFile(specPath, 'utf8')
    return (text.match(REQUIREMENT_HEADING) ?? []).length
  } catch {
    return 0
  }
}

/**
 * Read a project, preferring the CLI for task counts and requirement counts and
 * falling back to the tree for everything it cannot or does not report.
 *
 * `binary` is the once-resolved absolute path, or null when resolution failed.
 * Every CLI failure mode is already translated to a fallback by runOpenspecList,
 * so there is nothing to catch here: a non-ok result simply leaves the
 * tree-derived value in place.
 */
export async function readOpenspecProject(
  projectRoot: string,
  binary: string | null,
): Promise<OpenspecProjectState> {
  const tree = await readOpenspecTree(projectRoot)
  if (!tree.present || !binary) return tree

  const [changesRes, specsRes] = await Promise.all([
    runOpenspecList('changes', projectRoot, binary),
    runOpenspecList('specs', projectRoot, binary),
  ])

  let openChanges = tree.openChanges
  if (changesRes.ok) {
    const byName = new Map(changesRes.data.map((c) => [c.name, c]))
    openChanges = tree.openChanges.map((c) => {
      const fromCli = byName.get(c.name)
      if (!fromCli) return c
      // Counts come from the CLI; task-artifact presence does not.
      return {
        ...c,
        completedTasks: fromCli.completedTasks,
        totalTasks: fromCli.totalTasks,
      }
    })
  }

  /*
   * Capabilities merge the same way changes do: the tree decides which exist,
   * the CLI supplies the count for the ones it recognises. Replacing the set
   * wholesale contradicted the rule stated at the top of this file — a
   * capability directory the CLI declines to report would vanish from the panel
   * exactly when the binary is present, which is the majority case and the
   * failure the tree-enumerates rule exists to prevent.
   *
   * Merging by id also fixes an ordering divergence: the tree sorts ids, the
   * CLI returns its own order, so the Capability panel could list the same
   * project differently depending on whether the binary was installed.
   */
  let capabilities = tree.capabilities
  if (specsRes.ok) {
    const countById = new Map(specsRes.data.map((s) => [s.id, s.requirementCount]))
    capabilities = tree.capabilities.map((c) => {
      const fromCli = countById.get(c.id)
      return fromCli === undefined ? c : { ...c, requirementCount: fromCli }
    })
  }

  return { ...tree, openChanges, capabilities }
}
