import pc from 'picocolors'

import { agentError, agentLog } from '../lib/logging.js'
import { addProject, removeProject } from '../lib/registry.js'
import { ensureAuthFile } from '../lib/auth.js'

import { discoverProjects, registerInteractive, type RegisterInteractiveOpts } from './discover.js'

export interface RegisterOpts {
  auto?: string
  yes?: boolean
  dryRun?: boolean
  name?: string
  client?: string | null
  tag?: string[]
}

export async function runRegister(pathArg: string | undefined, opts: RegisterOpts): Promise<void> {
  ensureAuthFile() // D-01 lazy init

  if (opts.auto) {
    const matches = discoverProjects(opts.auto, { depth: 1 })
    if (matches.length === 0) {
      agentLog(`No AgenticApps projects found under ${opts.auto}`)
      process.exit(0)
    }
    // exactOptionalPropertyTypes: build opts with conditional property assignment
    const interactiveOpts: RegisterInteractiveOpts = {
      promptYesNo: async (q) => {
        process.stdout.write(`${q} `)
        const buf: Buffer[] = []
        for await (const chunk of process.stdin) {
          buf.push(chunk as Buffer)
          break
        }
        const ans = Buffer.concat(buf).toString('utf8').trim().toLowerCase()
        return ans === '' || ans === 'y' || ans === 'yes'
      },
    }
    if (opts.yes !== undefined) interactiveOpts.yes = opts.yes
    if (opts.dryRun !== undefined) interactiveOpts.dryRun = opts.dryRun
    const results = await registerInteractive(matches, interactiveOpts)
    for (const r of results) {
      if (r.reason === 'new') agentLog(pc.green(`registered ${r.match.name} (${r.match.root})`))
      else if (r.reason === 'already')
        agentLog(pc.gray(`${r.match.name} already registered, skipping`))
      else if (r.reason === 'declined') agentLog(pc.gray(`${r.match.name} skipped`))
      else if (r.reason === 'dry-run') agentLog(pc.cyan(`[dry-run] would register ${r.match.name}`))
    }
    process.exit(0)
  }

  // Direct register
  if (!pathArg) {
    agentError('register: path argument required (or use --auto <parent-dir>)')
    process.exit(1)
  }
  // exactOptionalPropertyTypes: conditionally assign optional name
  const addOpts: { name?: string; client?: string | null; tags?: string[] } = {
    client: opts.client ?? null,
    tags: opts.tag ?? [],
  }
  if (opts.name !== undefined) addOpts.name = opts.name
  const result = addProject(pathArg, addOpts)
  if (result.alreadyRegistered) {
    agentLog(
      pc.gray(
        `${result.entry.root} already registered as id \`${result.entry.id}\`, skipping`,
      ),
    )
  } else {
    agentLog(pc.green(`registered ${result.entry.name} (id: ${result.entry.id})`))
  }
  process.exit(0)
}

export async function runUnregister(idOrPath: string): Promise<void> {
  ensureAuthFile() // D-01 lazy init
  const removed = removeProject(idOrPath)
  if (removed) {
    agentLog(pc.green(`unregistered ${idOrPath}`))
    process.exit(0)
  }
  agentError(`not found: ${idOrPath}`)
  process.exit(1)
}
