/**
 * GET /api/projects/:id/phase-progress — PHASE-01 + PHASE-02 + PHASE-03 + PHASE-05.
 * Bulk endpoint composing four parsers (phase checklist, execution timeline,
 * review findings4, verification detail) + reusing the existing parseTddPairs
 * for the `tdd.greenPairs / totalTasks` summary.
 *
 * Single cache key `${id}:phase-progress` because the four panels share a
 * common dependency (the latest phase dir) — coalescing them avoids redundant
 * filesystem walks.
 *
 * 5s daemon memo via phaseCache key `${id}:phase-progress`.
 * Bearer-token gated via app.ts middleware.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { Hono } from 'hono'
import {
  PhaseProgressResponseSchema,
  type PhaseProgressResponse,
  type ReviewStatusPayload,
} from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { findLatestPhaseDir, parseTddPairs } from '../lib/projectOverview.js'
import {
  parseExecutionTimeline,
  parsePhaseChecklist,
  parseReviewFindings4,
  parseVerificationDetail,
} from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const phaseProgressRoute = new Hono<Env>()

phaseProgressRoute.get('/:id/phase-progress', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  const cacheKey = `${id}:phase-progress`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) {
    return outbound(c, PhaseProgressResponseSchema.parse.bind(PhaseProgressResponseSchema), cached)
  }

  const phaseDir = findLatestPhaseDir(entry.root)
  const phase = phaseDir ? phaseDir.split('/').pop() ?? null : null
  const paddedPhase = phase && /^\d{2}/.test(phase) ? phase.slice(0, 2) : null

  const files = phaseDir ? parsePhaseChecklist(phaseDir) : []

  const [tddSummary, timeline] = await Promise.all([
    parseTddPairs(entry.root),
    paddedPhase
      ? parseExecutionTimeline(entry.root, paddedPhase)
      : Promise.resolve([]),
  ])

  // Locate review + verification files inside phase dir (D-4-16)
  let review: ReviewStatusPayload = { stage1: null, stage2: null }
  let verification: PhaseProgressResponse['verification'] = {
    mustHavesTotal: 0,
    mustHavesEvidenced: 0,
    items: [],
  }
  if (phaseDir && existsSync(phaseDir)) {
    let dirFiles: string[]
    try {
      dirFiles = readdirSync(phaseDir)
    } catch {
      dirFiles = []
    }
    const reviewFile = dirFiles.find(
      (f) => f.endsWith('-REVIEW.md') && !f.endsWith('-REVIEW-FIX.md'),
    )
    const reviewFixFile = dirFiles.find((f) => f.endsWith('-REVIEW-FIX.md'))
    const stage1 = reviewFile
      ? parseReviewFindings4(join(phaseDir, reviewFile))
      : null
    const stage2 = reviewFixFile
      ? parseReviewFindings4(join(phaseDir, reviewFixFile))
      : null
    review = {
      stage1: stage1 ? { present: true, findings: stage1 } : null,
      stage2: stage2 ? { present: true, findings: stage2 } : null,
    }
    const verificationFile = dirFiles.find((f) => f.endsWith('-VERIFICATION.md'))
    if (verificationFile) {
      const detail = parseVerificationDetail(join(phaseDir, verificationFile))
      if (detail) verification = detail
    }
  }

  const value: PhaseProgressResponse = {
    phase,
    paddedPhase,
    files,
    tdd: {
      greenPairs: tddSummary.greenPairs,
      totalTasks: tddSummary.totalTasks,
      timeline,
    },
    review,
    verification,
  }
  setPhaseCache(cacheKey, value)
  return outbound(c, PhaseProgressResponseSchema.parse.bind(PhaseProgressResponseSchema), value)
})
