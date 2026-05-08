import type { IntegrationState } from '@agenticapps/dashboard-shared'

/**
 * Compute the three-state integration configuration status from:
 *   - envVarPresent: whether the relevant env var is set on the daemon process
 *   - signalDetected: whether project-side signals indicate the tool is in use
 *
 * Truth table (D-5-19 / RESEARCH §Pattern 5):
 *   envVarPresent=true  → 'configured'                  (regardless of signal)
 *   envVarPresent=false, signalDetected=true  → 'present-but-not-configured'
 *   envVarPresent=false, signalDetected=false → 'not-detected'
 */
export function computeIntegrationState(opts: {
  envVarPresent: boolean
  signalDetected: boolean
}): IntegrationState {
  if (opts.envVarPresent) return 'configured'
  if (opts.signalDetected) return 'present-but-not-configured'
  return 'not-detected'
}
