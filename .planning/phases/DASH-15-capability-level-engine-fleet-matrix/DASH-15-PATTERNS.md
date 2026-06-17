# Phase DASH-15: Capability-Level Engine + Fleet Matrix — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 15 new/modified files
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/agent/src/lib/scanners/claudeMdLevelScanner.ts` | scanner/service | CRUD (FS reads) | `packages/agent/src/lib/scanners/overrideSentinelScanner.ts` | exact (FS+git+resolver) |
| `packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts` | test | — | `packages/agent/src/lib/scanners/overrideSentinelScanner.test.ts` | exact |
| `packages/shared/src/schemas/claudeMdLevel.ts` | model/schema | transform | `packages/shared/src/schemas/agentlinter.ts` | exact (nested Zod objects) |
| `packages/shared/src/schemas/claudeMdLevel.test.ts` | test | — | `packages/shared/src/schemas/agentlinter.test.ts` | exact |
| `packages/shared/src/index.ts` | config/barrel | — | self (existing barrel pattern) | exact |
| `packages/shared/src/schemas/coverage.ts` | model/schema | — | self (existing `understand` optional field) | exact |
| `packages/agent/src/lib/coverageScan.ts` | service/orchestrator | fan-out | self (existing 6-scanner allSettled pattern) | exact |
| `packages/spa/src/components/panels/coverage/LevelBadgeCell.tsx` | component | request-response | `packages/spa/src/components/panels/coverage/UnderstandCopyPill.tsx` | role-match (cell component) |
| `packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx` | test | — | `packages/spa/src/components/panels/coverage/UnderstandCopyPill.test.tsx` | exact |
| `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.tsx` | component | request-response | `packages/spa/src/components/RegisterModal.tsx` | exact (native dialog pattern) |
| `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx` | test | — | `packages/spa/src/components/panels/coverage/UnderstandCopyPill.test.tsx` | role-match |
| `packages/spa/src/components/panels/coverage/coverageColumns.ts` | config | — | self (existing `COVERAGE_COL_WIDTHS` object) | exact |
| `packages/spa/src/components/panels/coverage/coverageColumnTooltips.ts` | config | — | self (existing `coverageColumnTooltips` object) | exact |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx` | component | request-response | self (existing `<td>` + `understand` fallback pattern) | exact |
| `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx` | component | request-response | self (existing `<col>` + `<th>` pattern) | exact |
| `packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.tsx` | component | request-response | self (existing `understand` column tile pattern) | role-match |

---

## Pattern Assignments

### `packages/agent/src/lib/scanners/claudeMdLevelScanner.ts` (scanner, FS reads)

**Primary analog:** `packages/agent/src/lib/scanners/overrideSentinelScanner.ts`
**Secondary analog:** `packages/agent/src/lib/scanners/workflowVersionScanner.ts`

**Imports pattern** (from `overrideSentinelScanner.ts:1-24`):
```typescript
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { PathResolver } from '../coverageResolver.js'
import { parseFrontmatter } from '../skillsScan.js'  // for L4 frontmatter check
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'
```

**Input interface pattern** (from `claudeMdScanner.ts:30-37`):
```typescript
export interface ScanClaudeMdLevelInput {
  repoAbsPath: string
  resolve: PathResolver
}
```

**Never-throws outer wrapper pattern** (from `overrideSentinelScanner.ts:52-62`):
```typescript
export function scanClaudeMdLevel(input: ScanClaudeMdLevelInput): ClaudeMdEval {
  try {
    return _scanLevel(input)
  } catch {
    // NEVER throws — return L0 degraded shape
    return ABSENT_EVAL
  }
}
```

**Resolver-then-read pattern** (from `workflowVersionScanner.ts:152-166` — copy this verbatim):
```typescript
let canonical: string
try {
  canonical = resolve(candidatePath, {
    allowedNames: ['CLAUDE.md', 'AGENTS.md', 'SKILL.md', 'mcp.json'],
    roots: [repoAbsPath],
  })
} catch {
  // PathViolation — file absent or outside allow-list
  return fallback
}
if (!existsSync(canonical)) return fallback
const content = readFileSync(canonical, 'utf-8')
```

**Directory listing + per-file resolver pattern** (from `overrideSentinelScanner.ts:64-96`):
```typescript
// readdirSync on raw dir path; resolver validates each file individually
const rulesDir = join(repoAbsPath, '.claude', 'rules')
if (!existsSync(rulesDir)) return { passed: false, evidence: ['No .claude/rules/ directory'] }
let entries: string[]
try {
  entries = readdirSync(rulesDir).filter(f => f.endsWith('.md'))
} catch {
  return { passed: false, evidence: ['Could not read .claude/rules/'] }
}
for (const name of entries) {
  let canonical: string
  try {
    canonical = resolve(join(rulesDir, name), { extension: '.md', roots: [repoAbsPath] })
  } catch { continue }
  if (!existsSync(canonical)) continue
  // ... process file
}
```

**git execFileSync pattern** (from `overrideSentinelScanner.ts:103-113`):
```typescript
import { execFileSync } from 'node:child_process'
// T-10-02-01: argv-array form ONLY — never shell string
try {
  execFileSync(
    'git',
    ['ls-files', '--error-unmatch', 'CLAUDE.md'],
    { cwd: repoAbsPath, encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  isGitTracked = true
} catch {
  // exit 1 = untracked, git unavailable, or not a git repo
  isGitTracked = false
}
```

**parseFrontmatter reuse pattern** (from `workflowVersionScanner.ts:29,167-176`):
```typescript
import { parseFrontmatter } from '../skillsScan.js'
// After resolving + existsSync:
const fm = parseFrontmatter(canonical) as Record<string, unknown> | null
if (fm && 'paths' in fm) {
  return { passed: true, evidence: [`${name} has paths: frontmatter`] }
}
```

**statSync mtime pattern** (from `overrideSentinelScanner.ts:119-122`):
```typescript
try {
  const mtime = statSync(resolvedClaudeMd).mtimeMs
  const ageDays = (Date.now() - mtime) / 86_400_000
} catch {
  evidence.push('Could not read CLAUDE.md mtime')
}
```

---

### `packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts` (test)

**Analog:** `packages/agent/src/lib/scanners/overrideSentinelScanner.test.ts`

**Test infrastructure pattern** (from `overrideSentinelScanner.test.ts:1-57`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { scanClaudeMdLevel } from './claudeMdLevelScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpRepo: string

beforeEach(() => {
  tmpRepo = mkdtempSync(join(tmpdir(), 'claude-md-level-'))
})

afterEach(() => {
  rmSync(tmpRepo, { recursive: true, force: true })
})

/** A permissive resolver that allows everything under repoRoot. */
function makePermissiveResolver(repoRoot: string): PathResolver {
  return (candidatePath, _opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    let realRoot: string
    try {
      realRoot = realpathSync(repoRoot)
    } catch {
      realRoot = repoRoot
    }
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed roots: ${real}`)
    }
    return real
  }
}

/** Initialize a bare git repo and commit a CLAUDE.md. */
function initGitRepoWithClaudeMd(dir: string): void {
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, encoding: 'utf8' })
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  writeFileSync(join(dir, 'CLAUDE.md'), '# Instructions\n\nMUST follow rules.\n')
  execFileSync('git', ['add', 'CLAUDE.md'], { cwd: dir })
  execFileSync('git', ['commit', '-m', 'add CLAUDE.md'], { cwd: dir })
}
```

**Per-rung test pattern** (each rung gets its own describe block with setup):
```typescript
describe('L0: absent', () => {
  it('returns level 0 when no CLAUDE.md or AGENTS.md exists', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(0)
    expect(result.rungs.every(r => !r.passed)).toBe(true)
  })
})

describe('L1: basic — git-tracked check', () => {
  it('returns level 1 when CLAUDE.md exists and is git-tracked', () => {
    initGitRepoWithClaudeMd(tmpRepo)
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(1)
    expect(result.rungs[0]!.passed).toBe(true)
  })

  it('returns level 0 when CLAUDE.md exists but is NOT git-tracked', () => {
    writeFileSync(join(tmpRepo, 'CLAUDE.md'), 'content')
    // no git init → ls-files fails
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(0)
  })
})

describe('strict-cumulative: L6 signals present but L5 not met → caps at L4', () => {
  it('headline level stops at L4 even if L6 conditions are met when L5 fails', () => {
    // ...setup: L1-L4 met, L5 NOT met (old CLAUDE.md, no backbone doc), L6 structure present
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(4)
    expect(result.rungs[4]!.passed).toBe(false) // L5
    expect(result.rungs[5]!.passed).toBe(false) // L6 also false (strict cumulative stops)
  })
})
```

---

### `packages/shared/src/schemas/claudeMdLevel.ts` (model/schema)

**Analog:** `packages/shared/src/schemas/agentlinter.ts`

**File header + nested Zod schema pattern** (from `agentlinter.ts:1-78`):
```typescript
import { z } from 'zod'

// Simple scalar schema with documented constraints
export const ClaudeMdLevelSchema = z.number().int().min(0).max(6)
export type ClaudeMdLevel = z.infer<typeof ClaudeMdLevelSchema>

// Nested object schema — same pattern as AgentLinterDiagnosticSchema
export const RungCheckSchema = z.object({
  rung: ClaudeMdLevelSchema,          // 1..6
  label: z.string(),                  // "Basic" | "Scoped" | ...
  passed: z.boolean(),
  inferred: z.boolean().optional(),   // true only for L5 when inferred via proxy
  evidence: z.array(z.string()),      // human-readable reasons
})
export type RungCheck = z.infer<typeof RungCheckSchema>

// Top-level aggregate schema — same pattern as AgentLinterReportSchema
export const ClaudeMdEvalSchema = z.object({
  level: ClaudeMdLevelSchema,
  levelLabel: z.string(),
  rungs: z.array(RungCheckSchema),
  nextSteps: z.array(z.string()),
  inferred: z.boolean(),
})
export type ClaudeMdEval = z.infer<typeof ClaudeMdEvalSchema>
```

---

### `packages/shared/src/schemas/claudeMdLevel.test.ts` (test)

**Analog:** `packages/shared/src/schemas/agentlinter.test.ts`

**Schema round-trip test pattern** (from `agentlinter.test.ts:1-138`):
```typescript
import { describe, it, expect } from 'vitest'
import { ClaudeMdEvalSchema, RungCheckSchema, ClaudeMdLevelSchema } from './claudeMdLevel.js'

const validRung = {
  rung: 1,
  label: 'Basic',
  passed: true,
  evidence: ['CLAUDE.md found and git-tracked'],
}

const validL4Eval = {
  level: 4,
  levelLabel: 'Abstracted',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['CLAUDE.md git-tracked'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import ref found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['rules/path.md has paths:'] },
    { rung: 5, label: 'Maintained', passed: false, evidence: ['mtime 180d ago'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['No .claude/skills/'] },
  ],
  nextSteps: ['Keep CLAUDE.md updated (edit within 90 days) or add a backbone doc → L5.'],
  inferred: false,
}

describe('ClaudeMdLevelSchema', () => {
  it('accepts 0..6', () => {
    for (let i = 0; i <= 6; i++) expect(ClaudeMdLevelSchema.parse(i)).toBe(i)
  })
  it('rejects 7 and -1', () => {
    expect(() => ClaudeMdLevelSchema.parse(7)).toThrow()
    expect(() => ClaudeMdLevelSchema.parse(-1)).toThrow()
  })
})

describe('ClaudeMdEvalSchema', () => {
  it('round-trips a valid L4 eval', () => {
    expect(() => ClaudeMdEvalSchema.parse(validL4Eval)).not.toThrow()
  })
  it('rejects eval without required rungs field', () => {
    const { rungs: _omit, ...withoutRungs } = validL4Eval
    void _omit
    expect(() => ClaudeMdEvalSchema.parse(withoutRungs)).toThrow()
  })
  it('accepts L5 rung with inferred:true', () => {
    const l5rung = { ...validRung, rung: 5, passed: true, inferred: true }
    expect(() => RungCheckSchema.parse(l5rung)).not.toThrow()
  })
  it('round-trip stability', () => {
    const parsed = ClaudeMdEvalSchema.parse(validL4Eval)
    const reparsed = ClaudeMdEvalSchema.parse(JSON.parse(JSON.stringify(parsed)))
    expect(reparsed).toEqual(parsed)
  })
})
```

---

### `packages/shared/src/index.ts` (modified — add exports)

**Analog:** self — existing export block pattern (lines 170-195 show coverage exports)

**Export block pattern to copy** (from `index.ts:170-195`):
```typescript
// Phase 15 — CLAUDE.md capability-level schemas (CML-07)
export {
  ClaudeMdLevelSchema,
  RungCheckSchema,
  ClaudeMdEvalSchema,
} from './schemas/claudeMdLevel.js'
export type { ClaudeMdLevel, RungCheck, ClaudeMdEval } from './schemas/claudeMdLevel.js'
```

Insert after the Phase 13 gitnexusScan block (after line 250 in the current file).

---

### `packages/shared/src/schemas/coverage.ts` (modified — add `eval` optional field)

**Analog:** self — existing `understand` optional field (lines 76-90 of `coverage.ts`)

**Optional field addition pattern** (from `coverage.ts:80-90`):
```typescript
// Phase 14 D-14-08 pattern: optional for back-compat with pre-DASH-15 daemons
// Add AFTER the `understand` field, BEFORE the `degraded` field
eval: ClaudeMdEvalSchema.optional(),
```

Import to add at top of file:
```typescript
import { ClaudeMdEvalSchema } from './claudeMdLevel.js'
```

Note: the `CoverageRowSchema` is not `.strict()` — adding an optional field does not break existing tests.

---

### `packages/agent/src/lib/coverageScan.ts` (modified — 7th scanner slot)

**Analog:** self — existing 6-scanner `Promise.allSettled` fan-out (lines 191-198)

**Import addition** (after line 35 — after understandScanner import):
```typescript
import { scanClaudeMdLevel } from './scanners/claudeMdLevelScanner.js'
```

**allSettled 7th slot pattern** (extend lines 191-199 exactly):
```typescript
// BEFORE (current):
const [cmS, gnS, wkS, wfS, ovS, unS] = await Promise.allSettled([
  (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
  (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
  (async () => scanWikiForFamily(familyRoot, repoName, resolve))(),
  (async () => scanWorkflowVersionForRepo(repoAbsPath, workflowHead, resolve))(),
  (async () => scanOverrideSentinelsForRepo(repoAbsPath, resolve))(),
  (async () => scanUnderstandForRepo(repoAbsPath, readRepoHeadSha(repoAbsPath)))(),
])

// AFTER (add 7th slot):
const [cmS, gnS, wkS, wfS, ovS, unS, lvS] = await Promise.allSettled([
  (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
  (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
  (async () => scanWikiForFamily(familyRoot, repoName, resolve))(),
  (async () => scanWorkflowVersionForRepo(repoAbsPath, workflowHead, resolve))(),
  (async () => scanOverrideSentinelsForRepo(repoAbsPath, resolve))(),
  (async () => scanUnderstandForRepo(repoAbsPath, readRepoHeadSha(repoAbsPath)))(),
  // DASH-15 CML-06: claudeMdLevel scanner — 7th slot (AGREED-2: async IIFE required)
  (async () => scanClaudeMdLevel({ repoAbsPath, resolve }))(),
])
```

**eval field assembly pattern** (copy `understand` pattern from lines 280-320, adapted):
```typescript
// ── eval column (Phase 15 CML-06) ─────────────────────────────────────────
// eval is an opaque ClaudeMdEval object — on failure we omit the field entirely
// (optional in schema). Same back-compat approach as `understand`.
const evalResult =
  lvS.status === 'fulfilled'
    ? lvS.value
    : (() => {
        rowDegraded.push(`claudeMdLevel: ${String(lvS.reason)}`)
        return undefined
      })()

// In publicRow assembly (after `understand`, before `degraded`):
const publicRow: CoverageRow = {
  ...existingFields,
  understand,
  ...(evalResult !== undefined ? { eval: evalResult } : {}),
  ...(rowDegraded.length > 0 ? { degraded: { reason: rowDegraded.join('; ') } } : {}),
}
```

---

### `packages/spa/src/components/panels/coverage/LevelBadgeCell.tsx` (new component)

**Primary analog:** `packages/spa/src/components/panels/coverage/UnderstandCopyPill.tsx`
**Secondary analog:** `packages/spa/src/components/panels/coverage/CoverageCell.tsx` (STATE_TOKEN_MAP pattern)

**Imports pattern** (from `UnderstandCopyPill.tsx:1-22` + `CoverageCell.tsx:1-27`):
```typescript
import React from 'react'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'
```

**VARIANT_CLASSES lookup table pattern** (from `CoverageCell.tsx:49-72`):
```typescript
// No cn()/clsx — inline className lookup table (D-5.1-10)
const LEVEL_TOKEN_MAP: Record<number, { bg: string; text: string }> = {
  0: { bg: 'bg-text-tertiary/10',   text: 'text-text-tertiary' },   // Absent — muted
  1: { bg: 'bg-status-warning/10',  text: 'text-status-warning' },  // Basic — amber
  2: { bg: 'bg-status-warning/10',  text: 'text-status-warning' },  // Scoped — amber
  3: { bg: 'bg-status-info/10',     text: 'text-status-info' },     // Structured — blue
  4: { bg: 'bg-status-info/10',     text: 'text-status-info' },     // Abstracted — blue
  5: { bg: 'bg-status-success/10',  text: 'text-status-success' },  // Maintained — green
  6: { bg: 'bg-status-success/10',  text: 'text-status-success' },  // Adaptive — green
}
```

**Props interface** (from UI-SPEC §Component Specifications):
```typescript
interface LevelBadgeCellProps {
  evalData: ClaudeMdEval | undefined
  repoName: string
  onClick: () => void
}
```

**Degraded state fallback pattern** (from `CoverageRow.tsx:208-217` — understand undefined branch):
```typescript
// Degraded / undefined: render em-dash, no button (mirrors understand column)
if (!evalData) {
  return (
    <span
      className="text-text-tertiary text-xs"
      aria-label={`CLAUDE.md level for ${repoName}: not available`}
    >—</span>
  )
}
```

**Button-as-trigger pattern** (from `CoverageFamilySection.tsx:199-212` — button inside td):
```typescript
// Badge cell: <button> is the interactive element, not the <td> itself
<button
  type="button"
  aria-label={`CLAUDE.md level for ${repoName}: ${evalData.levelLabel}${evalData.inferred ? ', inferred' : ''}. Click for details.`}
  onClick={onClick}
  className="w-full h-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
>
  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${tokens.bg} ${tokens.text}`}>
    L{evalData.level}
    {evalData.inferred && (
      <span className="ml-1 text-[10px] font-semibold bg-accent-bg text-accent rounded px-1">~</span>
    )}
  </span>
</button>
```

---

### `packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx` (new test)

**Analog:** `packages/spa/src/components/panels/coverage/UnderstandCopyPill.test.tsx`

**Test infrastructure pattern** (from `UnderstandCopyPill.test.tsx:11-52`):
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { LevelBadgeCell } from './LevelBadgeCell.js'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'

afterEach(() => { cleanup() })

const L4_EVAL: ClaudeMdEval = {
  level: 4,
  levelLabel: 'Abstracted',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter'] },
    { rung: 5, label: 'Maintained', passed: false, evidence: ['mtime 180d ago'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['no mcp.json'] },
  ],
  nextSteps: ['Keep CLAUDE.md updated (edit within 90 days) → L5.'],
  inferred: false,
}

describe('LevelBadgeCell', () => {
  it('renders L4 badge label', () => {
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toContain('L4')
  })

  it('renders — when evalData is undefined (degraded)', () => {
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows inferred ~ sigil when eval.inferred is true', () => {
    const inferred = { ...L4_EVAL, inferred: true }
    render(<LevelBadgeCell evalData={inferred} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.getByRole('button').textContent).toContain('~')
  })

  it('calls onClick when badge button is clicked', () => {
    const onClick = vi.fn()
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

---

### `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.tsx` (new component)

**Analog:** `packages/spa/src/components/RegisterModal.tsx` (lines 52-561)

**Imports pattern** (from `RegisterModal.tsx:1-13`):
```typescript
import React, { useEffect, useRef, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'
```

**Props interface** (from UI-SPEC §ClaudeMdLevelDrawer):
```typescript
interface ClaudeMdLevelDrawerProps {
  isOpen: boolean
  onClose: () => void
  repoName: string
  evalData: ClaudeMdEval  // always defined when drawer is open
}
```

**Focus management pattern** (from `RegisterModal.tsx:57-105` — copy verbatim):
```typescript
const dialogRef = useRef<HTMLDialogElement>(null)
const previouslyFocused = useRef<HTMLElement | null>(null)

useEffect(() => {
  const dialog = dialogRef.current
  if (!dialog) return
  if (isOpen) {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
  } else {
    if (dialog.open) dialog.close()
    previouslyFocused.current?.focus()
  }
}, [isOpen])
```

**Backdrop click + Esc pattern** (from `RegisterModal.tsx:129-139`):
```typescript
function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
  if (e.target === dialogRef.current) onClose()
}

// In JSX:
<dialog
  ref={dialogRef}
  className="bg-card-bg border border-border-subtle rounded-lg p-0 max-w-lg w-full mx-4 dark:shadow-none shadow-card backdrop:bg-text-primary/50"
  onCancel={(e) => { e.preventDefault(); onClose() }}
  onClick={handleBackdropClick}
>
```

**Dialog header pattern** (from `RegisterModal.tsx:249-261`):
```typescript
<div className="p-6">
  <div className="flex items-start justify-between mb-4">
    <div>
      <h2 className="text-xl font-semibold leading-snug text-text-primary">{repoName}</h2>
      <p className="text-sm text-text-secondary mt-1">CLAUDE.md capability level</p>
    </div>
    {/* ... headline badge ... */}
    <button
      type="button"
      aria-label="Close capability level drawer"
      onClick={onClose}
      className="ml-2 h-8 w-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >×</button>
  </div>
  {/* ... rung list + next steps ... */}
</div>
```

**State machine — `CoverageRow.tsx` local state pattern** (from `CoverageRow.tsx:90-94`):
```typescript
// In CoverageRow.tsx — local drawer state (recommended approach from RESEARCH §SPA Drawer)
const [drawerOpen, setDrawerOpen] = useState(false)

// In JSX — render drawer inline (one instance per row, lightweight)
<ClaudeMdLevelDrawer
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  repoName={row.repo}
  evalData={row.eval}  // only rendered when evalData defined
/>
```

---

### `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx` (new test)

**Analog:** `packages/spa/src/components/panels/coverage/UnderstandCopyPill.test.tsx`

**Test pattern** (from `UnderstandCopyPill.test.tsx:11-60`):
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { ClaudeMdLevelDrawer } from './ClaudeMdLevelDrawer.js'

afterEach(() => { cleanup() })

// Key behaviors to test (CML-09):
// 1. Drawer renders per-rung list (6 rungs, ✓/○)
// 2. Drawer renders nextSteps when present
// 3. Drawer renders "Fully adaptive" when nextSteps empty
// 4. Drawer calls onClose when backdrop clicked
// 5. Drawer renders inferred ~ sigil + callout for L5 rung.inferred:true
```

---

### `packages/spa/src/components/panels/coverage/coverageColumns.ts` (modified)

**Analog:** self — existing `COVERAGE_COL_WIDTHS` object (lines 1-24)

**Insertion point and pattern** (from `coverageColumns.ts:3-22`):
```typescript
// INSERT after claudeMd, before gitNexus — matches column position in CoverageFamilySection
export const COVERAGE_COL_WIDTHS = Object.freeze({
  repo:       'w-72',   // 288px
  claudeMd:   'w-32',   // 128px
  level:      'w-20',   // 80px — L-level badge (DASH-15 CML-08)
  gitNexus:   'w-36',   // 144px
  wiki:       'w-60',   // 240px
  workflow:   'w-32',   // 128px
  understand: 'w-36',   // 144px
  actions:    'w-12',   //  48px
} as const)
```

---

### `packages/spa/src/components/panels/coverage/coverageColumnTooltips.ts` (modified)

**Analog:** self — existing `coverageColumnTooltips` object (lines 7-13)

**Insertion point** (after `claudeMd`, before `gitNexus`):
```typescript
export const coverageColumnTooltips = {
  claudeMd:        'Project AI instructions file...',
  level:           'CLAUDE.md capability level (L0–L6). Click for rung details.',  // DASH-15
  gitNexus:        '...',
  // ... existing entries
} as const
```

---

### `packages/spa/src/components/panels/coverage/CoverageRow.tsx` (modified)

**Analog:** self — existing `understand` column cell (lines 200-218) and local state pattern (lines 90-94)

**New import to add** (after existing imports):
```typescript
import { LevelBadgeCell } from './LevelBadgeCell.js'
import { ClaudeMdLevelDrawer } from './ClaudeMdLevelDrawer.js'
```

**Local state addition** (after `const [popoverOpen, setPopoverOpen] = useState(false)`):
```typescript
const [drawerOpen, setDrawerOpen] = useState(false)
```

**New `<td>` pattern** (insert after claudeMd `<td>`, before gitNexus `<td>` — lines 149-156):
```typescript
{/* DASH-15 CML-08: L-level badge column — after claudeMd, before gitNexus */}
<td className={`${COVERAGE_COL_WIDTHS.level} px-2 py-2`}>
  <LevelBadgeCell
    evalData={row.eval}
    repoName={row.repo}
    onClick={() => setDrawerOpen(true)}
  />
</td>
```

**Drawer rendering pattern** (add before closing `</tr>` or as sibling after `</tr>`):
```typescript
{/* Drawer rendered inline — local state approach (RESEARCH §SPA Drawer) */}
{row.eval !== undefined && (
  <ClaudeMdLevelDrawer
    isOpen={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    repoName={row.repo}
    evalData={row.eval}
  />
)}
```

---

### `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx` (modified)

**Analog:** self — existing `<col>` + `<th>` pattern (lines 262-280)

**colgroup `<col>` insertion** (after `claudeMd` col, before `gitNexus` col):
```typescript
<colgroup>
  <col className={COVERAGE_COL_WIDTHS.repo} />
  <col className={COVERAGE_COL_WIDTHS.claudeMd} />
  <col className={COVERAGE_COL_WIDTHS.level} />   {/* DASH-15 */}
  <col className={COVERAGE_COL_WIDTHS.gitNexus} />
  <col className={COVERAGE_COL_WIDTHS.wiki} />
  <col className={COVERAGE_COL_WIDTHS.workflow} />
  <col className={COVERAGE_COL_WIDTHS.understand} />
  <col className={COVERAGE_COL_WIDTHS.actions} />
</colgroup>
```

**`<th>` header insertion** (from `CoverageFamilySection.tsx:274-278` pattern — after CLAUDE.md th):
```typescript
<th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium">
  <Tooltip content={coverageColumnTooltips.level}>Level</Tooltip>
</th>
```

---

### `packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.tsx` (modified)

**Analog:** self — existing `understand` column tile pattern (examine lines 68-80 in the file)

**COLUMN_LABELS + COLUMN_KEYS update pattern** (from `CoverageFamilySectionMobile.tsx:67-74`):
```typescript
// Add 'level' to the mobile column labels if the mobile layout includes it
// (planner decision: include it or drop it per RESEARCH §responsive behavior)
const COLUMN_LABELS = {
  claudeMd: 'CLAUDE.md',
  level: 'Level',          // DASH-15 — optional in mobile layout
  gitNexus: 'GitNexus',
  wiki: 'Wiki',
  workflowVersion: 'Workflow',
} as const
```

Note: The `LevelBadgeCell` renders a `<button>` rather than a simple `CoverageCell` figure. In the mobile card layout, it will be rendered as a standalone tile with its own row click handling, following the same pattern as the `understand` column tile.

---

## Shared Patterns

### Constraint: CODEX HIGH-3 — Resolver-Mediated Reads
**Source:** `packages/agent/src/lib/coverageResolver.ts`
**Apply to:** All read operations in `claudeMdLevelScanner.ts`

Every filesystem read (existence check, content read, directory listing) follows this three-step pattern:
1. Call `resolve(candidatePath, { allowedNames: [...], roots: [repoAbsPath] })` — throws `PathViolation` if unsafe
2. Call `existsSync(canonical)` on the returned path
3. Only then call `readFileSync` / `statSync` / `readdirSync`

Directories use a relaxed form: `existsSync(rawDirPath)` then `readdirSync(rawDirPath)`, then per-file resolver calls on each entry.

### Constraint: D-5.1-10 — Styling
**Source:** `packages/spa/src/components/panels/coverage/CoverageCell.tsx` (lines 49-72)
**Apply to:** All new SPA components (`LevelBadgeCell.tsx`, `ClaudeMdLevelDrawer.tsx`)

- NO `cn()`/`clsx`/CVA
- NO hex literals
- NO shadcn aliases (`bg-background`, `text-foreground`, etc.)
- Use `VARIANT_CLASSES` record lookup tables for state-to-token mapping
- Token names only: `bg-status-success/10`, `text-status-success`, `bg-accent-bg`, etc.

### Constraint: async IIFE Wrapping in allSettled
**Source:** `packages/agent/src/lib/coverageScan.ts` (lines 191-198)
**Apply to:** The 7th scanner slot in `coverageScan.ts`

```typescript
// REQUIRED: wrap sync scanner in async IIFE to convert sync throws to rejected promises
(async () => scanClaudeMdLevel({ repoAbsPath, resolve }))()
```

Without the async IIFE, a synchronous throw from the scanner escapes the array literal before `allSettled` handles it.

### Pattern: Optional Field for Back-Compat
**Source:** `packages/shared/src/schemas/coverage.ts` (lines 80-90, `understand` field)
**Apply to:** `eval` field in `CoverageRowSchema`, `LevelBadgeCell` undefined handling

```typescript
// Schema: optional field — pre-DASH-15 daemons omit it, SPA renders gracefully
eval: ClaudeMdEvalSchema.optional()

// SPA: check for undefined before rendering interactive element
row.eval !== undefined && <ClaudeMdLevelDrawer ... />
// Cell: render — when undefined (same as understand column fallback)
evalData === undefined && <span className="text-text-tertiary text-xs">—</span>
```

### Pattern: Native `<dialog>` Focus Management
**Source:** `packages/spa/src/components/RegisterModal.tsx` (lines 57-105)
**Apply to:** `ClaudeMdLevelDrawer.tsx` (copy verbatim)

```typescript
const dialogRef = useRef<HTMLDialogElement>(null)
const previouslyFocused = useRef<HTMLElement | null>(null)

useEffect(() => {
  const dialog = dialogRef.current
  if (!dialog) return
  if (isOpen) {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
  } else {
    if (dialog.open) dialog.close()
    previouslyFocused.current?.focus()
  }
}, [isOpen])
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

| File | Notes |
|------|-------|
| — | The inferred-marker `~` sigil is new visual vocabulary (no analog pill exists), but it follows the same inline `<span>` pattern as existing pills in `CoverageCell.tsx`. UI-SPEC §2 defines the exact token pair (`bg-accent-bg text-accent`). |

---

## Metadata

**Analog search scope:** `packages/agent/src/lib/scanners/`, `packages/shared/src/schemas/`, `packages/spa/src/components/panels/coverage/`, `packages/spa/src/components/RegisterModal.tsx`
**Files scanned:** 14 source files read in full
**Pattern extraction date:** 2026-06-17

**Key wiring notes for planner:**
- The scanner is the **7th** slot (index 6) in the `Promise.allSettled` array — the spec says "6th scanner" but Phase 14 added `understandScanner` as #6 first.
- `parseFrontmatter` is already exported from `packages/agent/src/lib/skillsScan.ts` and imported by `workflowVersionScanner.ts:29` — no new import path needed.
- The `eval` field name on `CoverageRowSchema` shadows the JS built-in `eval` keyword — use `row.eval` (as a property access) consistently, never as a standalone identifier in scope.
