import { Command } from 'commander'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from './version.js'

const argv = process.argv.slice(2)

if (argv.includes('--version') && argv.includes('--json')) {
  const payload: HealthResponse = {
    ok: true,
    version: AGENT_VERSION,
    message: 'alpha placeholder — daemon lands in Phase 1',
  }
  console.log(JSON.stringify(HealthResponseSchema.parse(payload)))
  process.exit(0)
}

const program = new Command()

program
  .name('agentic-dashboard')
  .description('AgenticApps Dashboard local agent')
  .version(AGENT_VERSION, '-v, --version', 'output the agent version')
  .option('--json', 'when paired with --version, emit full HealthResponse JSON')

program
  .command('start')
  .description('Start the dashboard agent daemon')
  .option('--bind <mode>', 'bind mode: 127.0.0.1 | tailscale | 0.0.0.0', '127.0.0.1')
  .option('--port <port>', 'port', String(5193))
  .option('--no-enforce-cidr', 'disable CIDR enforcement on tailscale/0.0.0.0 binds')
  .action(async (opts) => {
    await (await import('./cli/start.js')).runStart(opts)
  })

program
  .command('stop')
  .description('Gracefully stop the running daemon')
  .option('--force', 'send SIGKILL if SIGTERM fails (deferred to Phase 6 — currently no-op)')
  .action(async (opts) => {
    await (await import('./cli/stop.js')).runStop(opts)
  })

program
  .command('status')
  .description('Show daemon health and registered project count')
  .option('--json', 'emit JSON')
  .action(async (opts) => {
    await (await import('./cli/status.js')).runStatus(opts)
  })

program
  .command('register')
  .description('Add a project root, or scan a parent dir with --auto')
  .argument('[path]', 'project root directory')
  .option('--auto <parentDir>', 'scan parent directory for AgenticApps projects')
  .option('--yes', 'accept all matches without confirmation')
  .option('--dry-run', 'print matches without registering')
  .option('--name <name>', 'display name')
  .option('--client <client>', 'client name')
  .option('--tag <tag>', 'tag (repeatable)', (v: string, prev: string[]) => [...prev, v], [])
  .action(async (path: string | undefined, opts) => {
    await (await import('./cli/register.js')).runRegister(path, opts)
  })

program
  .command('unregister')
  .description('Remove a project by id or path')
  .argument('<idOrPath>')
  .action(async (arg: string) => {
    await (await import('./cli/register.js')).runUnregister(arg)
  })

program
  .command('list')
  .description('List registered projects + status')
  .option('--json', 'emit JSON')
  .action(async (opts) => {
    await (await import('./cli/registryCmd.js')).runList(opts)
  })

program
  .command('rename')
  .description('Set display name on a registered project')
  .argument('<id>')
  .argument('<newName>')
  .action(async (id: string, newName: string) => {
    await (await import('./cli/registryCmd.js')).runRename(id, newName)
  })

program
  .command('tag')
  .description('Set tags on a registered project (replaces existing tags)')
  .argument('<id>')
  .argument('[tags...]')
  .action(async (id: string, tags: string[]) => {
    await (await import('./cli/registryCmd.js')).runTag(id, tags)
  })

program
  .command('rotate-token')
  .description('Invalidate the current token and issue a new one')
  .action(async () => {
    await (await import('./cli/token.js')).runRotateToken()
  })

program
  .command('pair')
  .description('Print a fresh pair URL for this device')
  .action(async () => {
    await (await import('./cli/token.js')).runPair()
  })

program.parse()
