/**
 * retiredLocations.ts — the one explicit migration manifest.
 *
 * `Retired Locations Have An Explicit Transition` (project-dashboard):
 * known v1 locations resolve here, and nothing else does. The per-project rule
 * is enumerated rather than a wildcard on purpose — `/projects/:id/anything`
 * was never served, so it is unknown and must reach the not-found state rather
 * than be redirected somewhere plausible.
 */

/** Retired locations carrying no repo identifier. All resolve to the fleet. */
const TO_FLEET = new Set([
  '/',
  '/coverage',
  '/observability/skill-drift',
  '/observability/conformance',
  '/code-intelligence',
])

/** `/projects/:id` and nothing beneath it. */
const PROJECT_DETAIL = /^\/projects\/([^/]+)$/

/**
 * Resolve a retired location to its post-cutover destination.
 *
 * @returns the destination path, or `null` when the location is not retired —
 *   which covers both surviving surfaces and locations the product never served.
 */
export function resolveRetiredLocation(pathname: string): string | null {
  if (TO_FLEET.has(pathname)) return '/fleet'

  const projectDetail = PROJECT_DETAIL.exec(pathname)
  if (projectDetail) return `/repos/${projectDetail[1]}`

  return null
}
