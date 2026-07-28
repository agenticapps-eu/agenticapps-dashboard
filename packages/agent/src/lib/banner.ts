import pc from 'picocolors'

import { PROD_ORIGIN } from '../constants.js'

export interface BannerInput {
  /** Full bind URL, e.g. 'http://127.0.0.1:5193' */
  bindUrl: string
  /** hostname:port for pair URL — may differ from bindUrl on tailscale */
  pairHostname: string
  token: string
  registryCount: number
  projectNames: string[]
}

/**
 * Render the startup banner per spec lines 207-219.
 * Pair URL encodes the agent base URL with encodeURIComponent (not the token).
 */
export function renderBanner(input: BannerInput): string {
  const projectsLabel =
    input.registryCount === 0
      ? `${input.registryCount} projects`
      : `${input.registryCount} projects (${input.projectNames.join(', ')})`
  const pairAgent = encodeURIComponent(`http://${input.pairHostname}`)
  const lines = [
    '',
    '[agent] Daemon starting…',
    `[agent] Registry: ${projectsLabel}`,
    `[agent] Listening on ${input.bindUrl}`,
    `[agent] Token: ${input.token}`,
    '[agent]',
    '[agent] Pair this device:',
    `[agent]   ${PROD_ORIGIN}/pair?agent=${pairAgent}&token=${input.token}`,
    '[agent]',
    `[agent] Or pair manually at ${PROD_ORIGIN}/settings:`,
    `[agent]   Agent URL: http://${input.pairHostname}`,
    `[agent]   Token:     ${input.token}`,
    '[agent]',
    '[agent] Press Ctrl-C to stop, or `agentic-dashboard install-launchd` to run as a service.',
    '',
  ]
  return lines.join('\n')
}

/**
 * Render the yellow warning printed when the daemon binds all interfaces.
 * See CONTEXT.md D-20 for exact wording.
 * When enforceCIDR is false (via --no-enforce-cidr), omit the "CIDR enforcement is ON" clause.
 *
 * `host` names the address actually bound so the dual-stack wildcard `::` does
 * not report itself as `0.0.0.0`. It defaults to `0.0.0.0`, which keeps the
 * long-standing banner byte-identical for the IPv4 case.
 */
export function renderZeroBindWarning(enforceCIDR = true, host = '0.0.0.0'): string {
  const cidrNote = enforceCIDR ? ' CIDR enforcement is ON.' : ''
  return (
    pc.yellow(
      `[agent] WARNING: bound to ${host} — only safe on Tailscale-isolated machines.${cidrNote}`,
    ) + '\n'
  )
}
