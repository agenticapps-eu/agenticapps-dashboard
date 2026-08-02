/**
 * productionScope.ts — which repo-relative paths count as production code.
 *
 * Review and coverage evidence ages against production code, not against the
 * repository head: a commit that only touched documentation or planning must
 * not turn a current security review stale. The boundary is part of the
 * requirement rather than an implementation detail, so it lives in one place
 * and both consumers of it — the working-tree classifier here and the git
 * pathspecs below — are held to the same patterns by a parity test.
 */

/**
 * `*.md` is root-level only: `*` never crosses a separator, so a nested
 * `packages/spa/README.md` still counts as production. `openspec/**` covers the
 * spec slot; `docs/**` and `.planning/**` cover prose and frozen GSD history.
 * `.agenticapps/**` holds the readiness declaration itself — without it, writing
 * that file would age the very reviews it declares, which is the same reason the
 * coverage artifact is excluded below.
 */
export const DEFAULT_PRODUCTION_IGNORE = [
  'docs/**',
  '.planning/**',
  'openspec/**',
  '.agenticapps/**',
  '*.md',
]

export interface ProductionScope {
  /** Glob patterns a path must match to be in scope at all. */
  include: string[]
  /** Glob patterns that remove a path from scope. */
  ignore: string[]
  /** True when the repo's readiness file supplied part of this scope. */
  declared: boolean
}

export interface ResolveProductionScopeOptions {
  /** Effective coverage artifact path; never ages evidence against itself. */
  coveragePath: string
  configured?: { include?: string[] | undefined; ignore?: string[] | undefined }
}

export function resolveProductionScope(
  opts: ResolveProductionScopeOptions,
): ProductionScope {
  const configured = opts.configured
  return {
    include: configured?.include ?? ['**'],
    ignore: [
      ...DEFAULT_PRODUCTION_IGNORE,
      ...(configured?.ignore ?? []),
      opts.coveragePath,
    ],
    declared: Boolean(configured?.include || configured?.ignore),
  }
}

const compiled = new Map<string, RegExp>()

function compile(pattern: string): RegExp {
  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          // `**/` spans zero or more leading segments.
          out += '(?:.*/)?'
          i += 2
        } else {
          out += '.*'
          i += 1
        }
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`${out}$`)
}

/** Git-pathspec `:(glob)` semantics: `*` and `?` never cross a separator. */
export function globMatch(pattern: string, path: string): boolean {
  let re = compiled.get(pattern)
  if (!re) {
    re = compile(pattern)
    compiled.set(pattern, re)
  }
  return re.test(path)
}

export function isProductionPath(path: string, scope: ProductionScope): boolean {
  if (!scope.include.some((pattern) => globMatch(pattern, path))) return false
  return !scope.ignore.some((pattern) => globMatch(pattern, path))
}

/**
 * A configured scope that leaves no production path while the default scope
 * finds one makes the readiness file unusable: otherwise a repo could silence
 * freshness for all of its evidence with one include pattern.
 */
export function scopeCollapses(
  files: readonly string[],
  configured: ProductionScope,
  fallback: ProductionScope,
): boolean {
  if (files.some((file) => isProductionPath(file, configured))) return false
  return files.some((file) => isProductionPath(file, fallback))
}

/** The same scope expressed for git, so history queries stay in the plumbing. */
export function toPathspecs(scope: ProductionScope): string[] {
  return [
    ...scope.include.map((pattern) => `:(glob)${pattern}`),
    ...scope.ignore.map((pattern) => `:(exclude,glob)${pattern}`),
  ]
}
