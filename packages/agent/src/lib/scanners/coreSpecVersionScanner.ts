import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PathResolver } from '../coverageResolver.js'

interface ParsedSemver {
  raw: string
  major: bigint
  minor: bigint
  patch: bigint
  prerelease: string[]
}

function parseSemver(value: string): ParsedSemver | null {
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
  if (!match) return null

  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && /^0\d/.test(identifier))) {
    return null
  }

  return {
    raw: value,
    major: BigInt(match[1]!),
    minor: BigInt(match[2]!),
    patch: BigInt(match[3]!),
    prerelease,
  }
}

function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] < b[key]) return -1
    if (a[key] > b[key]) return 1
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1

  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    const aIdentifier = a.prerelease[index]
    const bIdentifier = b.prerelease[index]
    if (aIdentifier === undefined) return -1
    if (bIdentifier === undefined) return 1
    if (aIdentifier === bIdentifier) continue

    const aNumeric = /^\d+$/.test(aIdentifier)
    const bNumeric = /^\d+$/.test(bIdentifier)
    if (aNumeric && bNumeric) {
      return BigInt(aIdentifier) < BigInt(bIdentifier) ? -1 : 1
    }
    if (aNumeric) return -1
    if (bNumeric) return 1
    return aIdentifier < bIdentifier ? -1 : 1
  }

  return 0
}

function readSectionVersion(sectionPath: string): ParsedSemver | null {
  let raw: string
  try {
    raw = readFileSync(sectionPath, 'utf8')
  } catch {
    return null
  }

  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) return null

  const declarations = frontmatter[1]!
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*spec_version\s*:\s*(\S+)\s*$/)?.[1])
    .filter((value): value is string => value !== undefined)

  if (declarations.length !== 1) return null
  return parseSemver(declarations[0]!)
}

export function readCoreSpecVersion(
  coreRepoRoot: string,
  resolve: PathResolver,
): string | null {
  let specDir: string
  try {
    specDir = resolve(join(coreRepoRoot, 'spec'), {
      allowedNames: ['spec'],
      roots: [coreRepoRoot],
    })
  } catch {
    return null
  }

  let sectionNames: string[]
  try {
    sectionNames = readdirSync(specDir)
      .filter((name) => name.endsWith('.md'))
      .sort()
  } catch {
    return null
  }
  if (sectionNames.length === 0) return null

  let maximum: ParsedSemver | null = null
  for (const sectionName of sectionNames) {
    let sectionPath: string
    try {
      sectionPath = resolve(join(specDir, sectionName), {
        extension: '.md',
        roots: [specDir],
      })
    } catch {
      return null
    }

    const version = readSectionVersion(sectionPath)
    if (!version) return null
    if (!maximum || compareSemver(version, maximum) > 0) maximum = version
  }

  return maximum?.raw ?? null
}
