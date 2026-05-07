#!/usr/bin/env node
// Phase 5 D-5-10 closure-gate scripted half.
// Round-trips meta-observer producer (session-end.mjs) → consumer (Phase 4 parseCommitmentBlock + readSkillObservations).
// Run: node packages/meta-observer/test/end-to-end.mjs
// Exits 0 on success, non-zero on failure.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const hookScript = join(repoRoot, 'packages', 'meta-observer', 'hooks', 'session-end.mjs')
const fixtureTranscript = join(here, '__fixtures__', 'sample-transcript.jsonl')

async function main() {
  // 1. Create temp project root with required directory layout
  const tmpRoot = mkdtempSync(join(tmpdir(), 'meta-observer-e2e-'))
  console.log(`[e2e] tmp root: ${tmpRoot}`)
  try {
    mkdirSync(join(tmpRoot, '.planning', 'skill-observations'), { recursive: true })
    mkdirSync(join(tmpRoot, '.claude', 'skills', 'meta-observer'), { recursive: true })
    // Copy SKILL.md so readSkillObservations skillInstalled check passes (findSkillPath probes this)
    const skillMd = readFileSync(join(repoRoot, 'packages', 'meta-observer', 'SKILL.md'), 'utf8')
    writeFileSync(join(tmpRoot, '.claude', 'skills', 'meta-observer', 'SKILL.md'), skillMd)

    // 2. Build SessionEnd payload — uses the fixture transcript as transcript_path
    const payload = {
      session_id: 'e2e-test-001',
      transcript_path: fixtureTranscript,
      cwd: tmpRoot,
      hook_event_name: 'SessionEnd',
    }

    // 3. Spawn hook script with payload on stdin
    const proc = spawn('node', [hookScript], { stdio: ['pipe', 'pipe', 'pipe'] })
    proc.stdin.write(JSON.stringify(payload))
    proc.stdin.end()

    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    const exitCode = await new Promise((res) => proc.on('close', res))
    if (stderr.trim()) console.log(`[e2e] hook stderr: ${stderr.trim()}`)
    assert.equal(exitCode, 0, `hook exited non-zero (${exitCode}). stderr: ${stderr}`)

    // 4. Assert at least one output file written for our session
    const obsDir = join(tmpRoot, '.planning', 'skill-observations')
    const allEntries = readdirSync(obsDir)
    const entries = allEntries.filter((f) => f.includes('e2e-test-001'))
    console.log(`[e2e] observations dir: ${allEntries.join(', ') || '(empty)'}`)
    console.log(`[e2e] session entries: ${entries.join(', ') || '(none)'}`)

    const mdFiles = entries.filter((f) => f.endsWith('.md'))
    const jsonlFiles = entries.filter((f) => f.endsWith('.jsonl'))
    assert.ok(
      mdFiles.length >= 1 || jsonlFiles.length >= 1,
      `expected at least one .md or .jsonl output — fixture may have no commitment block AND no tool-use firings. entries found: ${entries.join(', ')}`,
    )

    // 5. Validate .jsonl lines against HookFiringSchema (workspace shared package)
    if (jsonlFiles.length > 0) {
      const { HookFiringSchema } = await import('@agenticapps/dashboard-shared')
      for (const jl of jsonlFiles) {
        const content = readFileSync(join(obsDir, jl), 'utf8')
        const lines = content.split('\n').filter((l) => l.trim().length > 0)
        for (const line of lines) {
          const parsed = JSON.parse(line)
          const valid = HookFiringSchema.safeParse(parsed)
          assert.ok(valid.success, `JSONL line failed HookFiringSchema validation: ${line.slice(0, 120)}`)
        }
        console.log(`[e2e] ${jl} → ${lines.length} valid HookFiring line(s)`)
      }
    } else {
      console.log(`[e2e] no .jsonl files — fixture had no tool-use firings (acceptable)`)
    }

    if (mdFiles.length > 0) {
      const mdContent = readFileSync(join(obsDir, mdFiles[0]), 'utf8')
      assert.ok(mdContent.includes('## Workflow commitment'), `expected .md to contain "## Workflow commitment" heading`)
      console.log(`[e2e] ${mdFiles[0]} → ${mdContent.length} bytes, commitment block present`)
    } else {
      console.log(`[e2e] no .md files — fixture had no commitment block (acceptable)`)
    }

    // 6. Round-trip via Phase 4 consumer (parseCommitmentBlock + readSkillObservations)
    const { parseCommitmentBlock, readSkillObservations } = await import('@agenticapps/dashboard-agent')
    const commitment = await parseCommitmentBlock(obsDir)
    const observations = await readSkillObservations(tmpRoot, 20)
    console.log(`[e2e] parseCommitmentBlock: markdown=${commitment.markdown ? `'${commitment.markdown.slice(0, 60)}...'` : 'null'}, sourceFile=${commitment.sourceFile ?? 'null'}`)
    console.log(`[e2e] readSkillObservations: skillInstalled=${observations.skillInstalled}, entries=${observations.entries.length}`)

    // At least commitment OR observations must be non-empty (fixture drives which)
    assert.ok(
      commitment.markdown !== null || observations.entries.length > 0,
      `neither parseCommitmentBlock nor readSkillObservations returned data — fixture transcript may be insufficient`,
    )

    console.log('[e2e] PASS')
  } finally {
    // 9. Cleanup tmp dir unconditionally
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error('[e2e] FAIL:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
