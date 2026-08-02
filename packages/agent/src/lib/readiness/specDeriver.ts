/**
 * specDeriver.ts — the `spec` check.
 *
 * This check maps what the project's existing reader already reports onto the
 * readiness vocabulary. It traverses nothing itself and consults no phase tree:
 * two readers over the same directory is exactly the drift this fleet's
 * discipline exists to prevent, and a phase-tree fallback would hide the
 * migration backlog this column exists to show. The reader arrives as a
 * parameter so that staying honest about this is structural rather than a
 * promise — its own test greps this file for a path literal.
 */
import type { OpenspecProjectState } from '../openspecReader.js'

import { clampSummary, type DerivedCheck } from './derivedCheck.js'

export interface DeriveSpecOptions {
  root: string
  /** Scan time: this check reads live state, so its observation is now. */
  now: number
  readProject: (root: string) => Promise<OpenspecProjectState>
}

export async function deriveSpec(opts: DeriveSpecOptions): Promise<DerivedCheck> {
  const { root, now, readProject } = opts

  let state: OpenspecProjectState
  try {
    state = await readProject(root)
  } catch {
    // The reader's own message may name an absolute path, so it is not
    // forwarded; the code is what makes this machine-distinguishable.
    return {
      status: 'fail',
      at: null,
      value: null,
      threshold: null,
      summary: 'This check could not be evaluated: the spec slot could not be read.',
      evidence: null,
      error: {
        code: 'spec-reader-failed',
        message: 'the spec slot could not be read',
      },
    }
  }

  if (!state.present) {
    return {
      status: 'never',
      at: null,
      value: null,
      threshold: null,
      summary:
        'This repo has no OpenSpec slot. Its spec state cannot be reported until the workflow update installs one.',
      evidence: null,
      error: null,
    }
  }

  const open = state.openChanges
  if (open.length === 0) {
    return {
      status: 'ok',
      at: now,
      value: 0,
      threshold: null,
      summary: `The spec slot is current: ${state.capabilities.length} capabilities and no open changes.`,
      evidence: null,
      error: null,
    }
  }

  const ratios = open
    .map(({ name, completedTasks, totalTasks }) => `${name} ${completedTasks}/${totalTasks}`)
    .join(', ')
  return {
    status: 'warn',
    at: now,
    value: open.length,
    threshold: null,
    summary: clampSummary(
      `${open.length} open change${open.length === 1 ? '' : 's'}: ${ratios}.`,
    ),
    evidence: null,
    error: null,
  }
}
