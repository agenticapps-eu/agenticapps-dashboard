import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
/**
 * Resolve the project root by:
 * 1. Checking process.env.CLAUDE_PROJECT_DIR first (preferred per D-5-07 + RESEARCH fact 2).
 *    Returns the env value only if the directory contains a `.planning` or `.claude` marker.
 *    Returns null if the env is set but the marker is absent (refuses silently).
 * 2. Walking up from `opts.cwd` (or process.cwd()) looking for `.planning` or `.claude`.
 *    Returns the first ancestor directory that contains either marker.
 *    Returns null if the filesystem root is reached without finding a marker.
 */
export function resolveProjectRoot(opts = {}) {
    const envRoot = process.env['CLAUDE_PROJECT_DIR'];
    if (typeof envRoot === 'string' && envRoot.length > 0) {
        if (hasProjectMarker(envRoot)) {
            return envRoot;
        }
        // Env var set but no marker found — refuse silently (D-5-07)
        return null;
    }
    const startDir = opts.cwd ?? process.cwd();
    return walkUp(startDir);
}
function hasProjectMarker(dir) {
    return existsSync(join(dir, '.planning')) || existsSync(join(dir, '.claude'));
}
function walkUp(dir) {
    if (hasProjectMarker(dir)) {
        return dir;
    }
    const parent = dirname(dir);
    // Reached filesystem root — dirname of root equals root
    if (parent === dir) {
        return null;
    }
    return walkUp(parent);
}
