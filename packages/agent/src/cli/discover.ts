
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

import { hasOpenspec } from '../lib/projectCondition.js'
import { addProject } from '../lib/registry.js'

export interface DiscoveredMatch {
  root: string
  name: string
  markers: string[] // human-readable labels e.g. ['agentic-apps-workflow/SKILL.md']
}

/**
 * Check which markers are present in a candidate directory.
 *
 * Exactly two: an `openspec/` directory, or the workflow skill. Per
 * `project-registry` › Registry CRUD Surface, `.planning/config.json` is no
 * longer a marker — the GSD reader is retired, so matching on it would offer
 * projects whose planning state the dashboard cannot read, and whose card would
 * then tell the user to install a workflow they already have.
 *
 * This narrows discovery only. Projects already in the registry stay there
 * regardless of which marker originally matched.
 */
function checkMarkers(child: string): string[] {
  const markers: string[] = []
  if (hasOpenspec(child)) {
    markers.push('openspec/')
  }
  if (existsSync(join(child, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'))) {
    markers.push('agentic-apps-workflow/SKILL.md')
  }
  return markers
}

/**
 * Scan parentDir for direct children (depth=1) that contain D-08 markers.
 * Returns an array of DiscoveredMatch objects.
 * Never throws — returns [] if parentDir is not readable.
 */
export function discoverProjects(
  parentDir: string,
  opts: { depth?: number } = {},
): DiscoveredMatch[] {
  const depth = opts.depth ?? 1
  if (depth !== 1) throw new Error('only depth=1 supported in v1 (D-11)')
  const out: DiscoveredMatch[] = []
  let entries: string[]
  try {
    entries = readdirSync(parentDir)
  } catch {
    return []
  }
  for (const e of entries) {
    const child = join(parentDir, e)
    try {
      if (!statSync(child).isDirectory()) continue
    } catch {
      continue
    }
    const markers = checkMarkers(child)
    if (markers.length > 0) out.push({ root: child, name: basename(child), markers })
  }
  return out
}

export interface RegisterInteractiveOpts {
  yes?: boolean
  dryRun?: boolean
  /** Override registry file path (for isolated testing). */
  registryFile?: string
  /** Callback to prompt user (only called when !yes and !dryRun). Defaults to Y. */
  promptYesNo?: (question: string) => Promise<boolean>
}

export interface RegisterInteractiveResult {
  match: DiscoveredMatch
  registered: boolean
  reason: 'already' | 'declined' | 'dry-run' | 'new'
}

/**
 * Interactively register discovered projects.
 * - --yes: accept all silently
 * - --dry-run: return results without writing
 * - default: per-match Y/n prompt (D-09)
 */
export async function registerInteractive(
  matches: DiscoveredMatch[],
  opts: RegisterInteractiveOpts = {},
): Promise<RegisterInteractiveResult[]> {
  const results: RegisterInteractiveResult[] = []
  for (const m of matches) {
    if (opts.dryRun) {
      results.push({ match: m, registered: false, reason: 'dry-run' })
      continue
    }
    let accept = true
    if (!opts.yes) {
      const prompt = `[${m.name}] (matched: ${m.markers.join(', ')}) — register? [Y/n]`
      accept = opts.promptYesNo ? await opts.promptYesNo(prompt) : true
    }
    if (!accept) {
      results.push({ match: m, registered: false, reason: 'declined' })
      continue
    }
    const r = await addProject(m.root, {}, opts.registryFile)
    results.push({
      match: m,
      registered: !r.alreadyRegistered,
      reason: r.alreadyRegistered ? 'already' : 'new',
    })
  }
  return results
}
