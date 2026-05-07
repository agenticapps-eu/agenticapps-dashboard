#!/usr/bin/env node
/**
 * meta-observer SessionEnd hook.
 * Reads stdin payload, extracts commitment + firings from transcript,
 * writes <projectRoot>/.planning/skill-observations/<stamp>--<sessionId>.{md,jsonl}.
 * MUST exit 0 on ALL code paths (T-05-01-Hook-Crash-Loop).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  // 1. Read + parse stdin payload
  let payload
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'))
  } catch (err) {
    process.stderr.write(`[meta-observer] stdin parse failed: ${err}\n`)
    process.exit(0)
  }

  // 2. Resolve project root via CLAUDE_PROJECT_DIR or CWD walk-up (D-5-07)
  const cwd = typeof payload?.cwd === 'string' ? payload.cwd : process.cwd()
  const { resolveProjectRoot } = await import('../lib/projectRoot.js')
  const root = resolveProjectRoot({ cwd })
  if (root === null) {
    process.stderr.write(`[meta-observer] no project root from "${cwd}" — skipping\n`)
    process.exit(0)
  }

  // 3. Require transcript_path from payload
  const transcriptPath = typeof payload?.transcript_path === 'string' ? payload.transcript_path : null
  if (transcriptPath === null) {
    process.stderr.write(`[meta-observer] no transcript_path in payload — skipping\n`)
    process.exit(0)
  }

  // 4. Build output filenames per D-5-06
  const sessionId = typeof payload?.session_id === 'string' ? payload.session_id : 'unknown'
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '')
  const baseName = `${stamp}--${sessionId}`
  const obsDir = join(root, '.planning', 'skill-observations')

  const { atomicWrite } = await import('../lib/atomicWrite.js')
  const { extractCommitment } = await import('../lib/extractCommitment.js')
  const { extractFirings } = await import('../lib/extractFirings.js')

  // 5a. Write commitment .md (D-5-05 first half — independent of 5b)
  try {
    const commitment = await extractCommitment(transcriptPath)
    if (commitment !== null) {
      await atomicWrite(join(obsDir, `${baseName}.md`), `## Workflow commitment\n\n${commitment}\n`, { sandboxRoot: obsDir })
    }
  } catch (err) {
    process.stderr.write(`[meta-observer] commitment write failed: ${err}\n`)
  }

  // 5b. Write firings .jsonl (D-5-05 second half — independent of 5a)
  try {
    const firings = await extractFirings(transcriptPath)
    if (firings.length > 0) {
      const jsonl = firings.map((f) => JSON.stringify(f)).join('\n') + '\n'
      await atomicWrite(join(obsDir, `${baseName}.jsonl`), jsonl, { sandboxRoot: obsDir })
    }
  } catch (err) {
    process.stderr.write(`[meta-observer] firings write failed: ${err}\n`)
  }

  process.exit(0)
}

main().catch((err) => {
  process.stderr.write(`[meta-observer] unhandled error: ${err}\n`)
  process.exit(0)
})
