/**
 * understandViewerUrl.ts — single source for understand viewer URL construction.
 *
 * D-14-07 contract:
 *   {agentUrl}/understand/{family}/{repo}/?token={encodeURIComponent(viewerToken)}
 *
 * Used by CoveragePage and CodeIntelligencePage (Phase 14 review fix — Bundle D
 * dedup of two private copies). Uses ONLY the per-row scoped viewerToken — the
 * main bearer token is NEVER part of viewer URLs (T-14-03-01).
 *
 * Family/repo path segments are URI-encoded defensively; the daemon's segment
 * regexes (D-13-EXT-11) only admit [a-z0-9-_.] anyway, so encoding is a no-op
 * for valid ids but prevents URL-structure injection from unexpected values.
 */
export function buildViewerUrl(
  agentUrl: string,
  family: string,
  repo: string,
  viewerToken: string,
): string {
  return `${agentUrl}/understand/${encodeURIComponent(family)}/${encodeURIComponent(repo)}/?token=${encodeURIComponent(viewerToken)}`
}
