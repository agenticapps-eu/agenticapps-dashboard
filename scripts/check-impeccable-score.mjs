/**
 * POLISH-04 D-6-09 D-6-11 — impeccable CI gate score parser.
 *
 * Defensive: never crashes on unexpected JSON; exits 2 on malformed input.
 *
 * Usage:
 *   node scripts/check-impeccable-score.mjs [--threshold N] [<path-to-json>]
 *   cat report.json | node scripts/check-impeccable-score.mjs
 *
 * Per D-6-21: only routes with breakpoint === '1440x900' are gate-relevant.
 * sm/md breakpoints still appear in the PR comment as informational signal.
 */
import { readFileSync } from 'node:fs'

const DEFAULT_THRESHOLD = 90
const GATE_BREAKPOINT = '1440x900'

/**
 * Check impeccable scores against a threshold.
 *
 * @param {object} report  Parsed JSON report object.
 * @param {number} threshold  Score threshold (default 90).
 * @returns {{ pass: boolean, exitCode: 0|1|2, summary: string, failingRoutes: object[] }}
 */
export function checkImpeccableScore(report, threshold = DEFAULT_THRESHOLD) {
  if (!report || !Array.isArray(report.routes)) {
    return {
      pass: false,
      exitCode: 2,
      summary: '## Impeccable Critique Gate\n\n**MALFORMED REPORT:** missing `routes` array.\n',
      failingRoutes: [],
    }
  }
  for (const r of report.routes) {
    if (typeof r.score !== 'number') {
      return {
        pass: false,
        exitCode: 2,
        summary: `## Impeccable Critique Gate\n\n**MALFORMED REPORT:** route \`${r.route ?? '<unknown>'}\` missing numeric \`score\`.\n`,
        failingRoutes: [],
      }
    }
  }

  // Gate: only desktop breakpoint per D-6-21
  const gateRoutes = report.routes.filter((r) => r.breakpoint === GATE_BREAKPOINT)
  // Informational: all routes for the PR comment table
  const allRoutes = report.routes

  const failing = gateRoutes.filter((r) => r.score < threshold)
  const pass = failing.length === 0

  const lines = [
    '## Impeccable Critique Gate',
    '',
    `**Threshold:** ${threshold}`,
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Gate breakpoint:** ${GATE_BREAKPOINT} (sm/md shown below as informational only — D-6-21)`,
    '',
    '| Route | Breakpoint | Composite | Gate? | Status |',
    '|-------|-----------|-----------|-------|--------|',
  ]
  for (const r of allRoutes) {
    const isGate = r.breakpoint === GATE_BREAKPOINT
    const status = !isGate ? 'INFO' : r.score >= threshold ? 'OK' : 'BELOW 90'
    const gateLabel = isGate ? 'gate' : 'info'
    lines.push(`| \`${r.route}\` | ${r.breakpoint} | ${r.score} | ${gateLabel} | ${status} |`)
  }

  if (failing.length > 0) {
    lines.push('', '### Failing routes', '')
    for (const r of failing) {
      lines.push(`- \`${r.route}\` ${r.breakpoint} — composite ${r.score}`)
      if (r.subScores && typeof r.subScores === 'object') {
        for (const [k, v] of Object.entries(r.subScores)) {
          if (typeof v === 'number' && v < threshold) {
            const label = k.charAt(0).toUpperCase() + k.slice(1)
            lines.push(`  - ${label}: ${v} (below ${threshold})`)
          }
        }
      }
    }
  }

  return {
    pass,
    exitCode: pass ? 0 : 1,
    summary: lines.join('\n') + '\n',
    failingRoutes: failing,
  }
}

// Standalone CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  let threshold = DEFAULT_THRESHOLD
  let inputPath = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--threshold') {
      threshold = Number(args[++i])
    } else {
      inputPath = args[i]
    }
  }

  let raw
  try {
    raw = inputPath ? readFileSync(inputPath, 'utf8') : readFileSync(0, 'utf8')
  } catch (err) {
    console.error('Failed to read input:', err.message)
    process.exit(2)
  }

  let report
  try {
    report = JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse JSON input:', err.message)
    process.exit(2)
  }

  const result = checkImpeccableScore(report, threshold)
  console.log(result.summary)
  process.exit(result.exitCode)
}
