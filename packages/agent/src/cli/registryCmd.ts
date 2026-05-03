import { RegistryListResponseSchema } from '@agenticapps/dashboard-shared'

import { agentError, agentLog } from '../lib/logging.js'
import { ensureAuthFile } from '../lib/auth.js'
import { listProjectsWithStatus, renameProject, setTags } from '../lib/registry.js'

export async function runList(opts: { json?: boolean }): Promise<void> {
  ensureAuthFile() // D-01 lazy init
  const items = await listProjectsWithStatus()
  const validated = RegistryListResponseSchema.parse(items)

  if (opts.json) {
    process.stdout.write(JSON.stringify(validated, null, 2) + '\n')
    process.exit(0)
  }

  // Pretty table (D-04)
  if (validated.length === 0) {
    agentLog('No projects registered. Run `agentic-dashboard register <path>`.')
    process.exit(0)
  }

  const widths = {
    id: Math.max(2, ...validated.map((p) => p.id.length)),
    name: Math.max(4, ...validated.map((p) => p.name.length)),
    phase: 12,
    status: 12,
    root: Math.max(4, ...validated.map((p) => p.root.length)),
  }
  const header =
    `${'ID'.padEnd(widths.id)}  ${'NAME'.padEnd(widths.name)}  ` +
    `${'PHASE'.padEnd(widths.phase)}  ${'STATUS'.padEnd(widths.status)}  ROOT`
  process.stdout.write(header + '\n')
  process.stdout.write('-'.repeat(header.length) + '\n')
  for (const p of validated) {
    const status = p.status.reachable ? 'reachable' : 'UNREACHABLE'
    const phase = p.status.currentPhase ?? '-'
    process.stdout.write(
      `${p.id.padEnd(widths.id)}  ${p.name.padEnd(widths.name)}  ` +
        `${phase.padEnd(widths.phase)}  ${status.padEnd(widths.status)}  ${p.root}\n`,
    )
  }
  process.exit(0)
}

export async function runRename(id: string, newName: string): Promise<void> {
  ensureAuthFile() // D-01 lazy init
  const ok = renameProject(id, newName)
  if (!ok) {
    agentError(`not found: ${id}`)
    process.exit(1)
  }
  agentLog(`renamed ${id} → ${newName}`)
  process.exit(0)
}

export async function runTag(id: string, tags: string[]): Promise<void> {
  ensureAuthFile() // D-01 lazy init
  const ok = setTags(id, tags)
  if (!ok) {
    agentError(`not found: ${id}`)
    process.exit(1)
  }
  agentLog(`tags set on ${id}: ${tags.join(', ')}`)
  process.exit(0)
}
