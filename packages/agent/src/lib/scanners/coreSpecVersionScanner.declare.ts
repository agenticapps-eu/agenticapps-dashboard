import type { PathResolver } from '../coverageResolver.js'

/**
 * Read the highest `spec_version` declared by the workflow-core spec sections.
 *
 * Returns `null` when the core spec directory is unavailable or contains no
 * valid section version.
 */
export declare function readCoreSpecVersion(
  coreRepoRoot: string,
  resolve: PathResolver,
): string | null
