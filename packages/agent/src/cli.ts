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
  .description('AgenticApps Dashboard local agent (alpha placeholder)')
  .version(AGENT_VERSION, '-v, --version', 'output the agent version')
  .option('--json', 'when paired with --version, emit full HealthResponse JSON')

program
  .command('start')
  .description('Start the dashboard agent daemon (Phase 1)')
  .action(() => {
    console.log('agentic-dashboard: alpha placeholder — daemon lands in Phase 1')
    console.log('Run `npx @agenticapps/dashboard-agent register <path>` once Phase 1 ships.')
    process.exit(0)
  })

program.parse()
