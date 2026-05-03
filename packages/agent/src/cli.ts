import { Command } from 'commander'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from './version.js'
import { ensureAuthFile, InsecurePermissionsError } from './lib/auth.js'

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
  .action(() => {
    try {
      ensureAuthFile()
    } catch (err) {
      if (err instanceof InsecurePermissionsError) {
        process.stderr.write(`[agent] Error: ${err.message}\n`)
        process.exit(1)
      }
      throw err
    }
    // Full daemon boot will be wired in Plan 01-04 (CLI commands)
    console.log('agentic-dashboard: daemon boot wiring lands in Plan 01-04')
    process.exit(0)
  })

program.parse()
