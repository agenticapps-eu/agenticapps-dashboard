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

/**
 * `/projects/:id` and nothing beneath it. Case-insensitive on the literal
 * segment only — the capture keeps the identifier exactly as it was written.
 */
const PROJECT_DETAIL = /^\/projects\/([^/]+)\/?$/i

/**
 * The router accepts spellings this manifest is keyed on exactly: TanStack
 * matches paths case-insensitively and tolerates trailing slashes, and hands
 * `beforeLoad` the pathname the visitor typed rather than the one it matched.
 * So the lookup is normalised, not the answer.
 *
 * Only the *location* is folded. An identifier is not a spelling — see
 * `resolveRetiredLocation`.
 */
function normalizeLocation(pathname: string): string {
  const withoutTrailingSlashes = pathname.replace(/\/+$/, '')
  return withoutTrailingSlashes === '' ? '/' : withoutTrailingSlashes.toLowerCase()
}

/**
 * Resolve a retired location to its post-cutover destination.
 *
 * The repo identifier a per-project location carries is passed through
 * verbatim. Folding its case would send a bookmark for `MyRepo` to a repo that
 * may not exist, turning a working deep link into the detail surface's
 * not-found state — the identifier is data, not a spelling of an address.
 *
 * @returns the destination path, or `null` when the location is not retired —
 *   which covers both surviving surfaces and locations the product never served.
 */
export function resolveRetiredLocation(pathname: string): string | null {
  if (TO_FLEET.has(normalizeLocation(pathname))) return '/fleet'

  const projectDetail = PROJECT_DETAIL.exec(pathname)
  if (projectDetail) return `/repos/${projectDetail[1]}`

  return null
}
