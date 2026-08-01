/**
 * remedy.ts — what to do about a cell, in one sentence.
 *
 * The detail wire shape requires a non-empty remedy on every result, including
 * the ones that pass: a repo reading six greens still needs the page to say so
 * rather than render an empty line. Text is keyed by check and status, and by
 * the detected host wherever the action is a command the user types — a repo on
 * codex told to run claude's slash command has been given a wrong instruction,
 * not a generic one.
 *
 * Two sentences here discharge spec obligations rather than merely helping: the
 * pen-test slot names no tool in any state, and the unmigrated spec slot names
 * the host's own update command and migration 0032 instead of stopping at
 * "migrate".
 */
import type { CheckId, CheckStatus } from '@agenticapps/dashboard-shared'

import type { ReadinessHostId } from './workflowDeriver.js'

/** Each host's installed workflow-update command, spelled as that host spells it. */
export const HOST_UPDATE_COMMANDS: Record<ReadinessHostId, string> = {
  claude: '/update-agenticapps-workflow',
  codex: '$update-codex-agenticapps-workflow',
  opencode: '$update-opencode-agenticapps-workflow',
  pi: '/update-pi-agenticapps-workflow',
}

/**
 * How to refer to the update command when no host was detected. Naming one
 * host's command here would be worse than naming none.
 */
const UNKNOWN_HOST_COMMAND = 'your agent host’s workflow-update command'

function updateCommand(host: ReadinessHostId | null): string {
  return host ? HOST_UPDATE_COMMANDS[host] : UNKNOWN_HOST_COMMAND
}

const REVIEW_ARTIFACTS: Record<'code-review' | 'security-review', string> = {
  'code-review': 'REVIEW.md',
  'security-review': 'SECURITY.md',
}

function reviewRemedy(
  id: 'code-review' | 'security-review',
  status: CheckStatus,
): string {
  const artifact = REVIEW_ARTIFACTS[id]
  const kind = id === 'code-review' ? 'code review' : 'security review'
  switch (status) {
    case 'never':
      return `No ${artifact} was found. Run the ${kind} and commit its verdict as ${artifact} in the change directory under openspec/changes.`
    case 'stale':
      return `Production code has moved past the reviewed commit. Re-run the ${kind} against the current tree and commit an updated ${artifact}.`
    case 'fail':
      return `The latest ${artifact} records a failing verdict or an open blocker. Resolve it and commit the corrected ${kind}.`
    case 'warn':
      return `The latest ${artifact} passes with reservations. Read it and close the caveats it records.`
    case 'na':
      return `This repo reports no ${kind} obligation. Nothing to do unless that changes.`
    case 'ok':
      return `The ${kind} covers the current production code. Nothing to do.`
  }
}

function workflowRemedy(status: CheckStatus, host: ReadinessHostId | null): string {
  const command = updateCommand(host)
  switch (status) {
    case 'never':
      return `No workflow version artifact is present. Install the workflow in this repo, then run ${command} to keep it current.`
    case 'fail':
      return `This repo implements an older core spec than the host ships. Run ${command} to apply the pending migrations.`
    case 'warn':
      return `The installed skill version trails the host, though the spec contract still matches. Run ${command} when convenient.`
    case 'stale':
      return `The workflow artifact predates the current production code. Run ${command} and re-commit the version metadata.`
    case 'na':
      return 'This host pins no per-repo workflow version, so there is nothing to update here.'
    case 'ok':
      return 'The workflow matches the host on both version and spec contract. Nothing to do.'
  }
}

function specRemedy(status: CheckStatus, host: ReadinessHostId | null): string {
  switch (status) {
    case 'never':
      return `This repo has no openspec directory. Run ${updateCommand(host)}; migration 0032 performs the OpenSpec initialisation and installs the spec slot.`
    case 'warn':
      return 'Open changes are in flight. Finish their tasks and archive each one so the spec slot states current truth.'
    case 'fail':
      return 'The OpenSpec state could not be read. Check that openspec validate --all runs cleanly in this repo.'
    case 'stale':
      return 'The recorded OpenSpec state predates the current production code. Re-read it after committing.'
    case 'na':
      return 'OpenSpec does not apply to this repo. Nothing to do.'
    case 'ok':
      return 'No changes are open and the spec slot is current. Nothing to do.'
  }
}

function coverageRemedy(status: CheckStatus): string {
  switch (status) {
    case 'never':
      return 'No coverage artifact was found. Add the json-summary reporter to this repo’s test config so it writes coverage-summary.json under the coverage directory.'
    case 'fail':
      return 'Line coverage is below the threshold. Add tests for the uncovered production code, or set a threshold this repo means to hold in .agenticapps/readiness.json.'
    case 'warn':
      return 'Line coverage sits just under the threshold. A small number of tests would close the gap.'
    case 'stale':
      return 'The coverage artifact predates the current production code. Re-run the test suite and commit the refreshed summary.'
    case 'na':
      return 'This repo reports no coverage obligation. Nothing to do.'
    case 'ok':
      return 'Line coverage meets the threshold. Nothing to do.'
  }
}

/**
 * The pen-test slot has no derived signal, so every state routes to the same
 * place: the readiness file. No tool is named in any of them, per the spec's
 * tool-agnostic requirement.
 */
function penTestRemedy(status: CheckStatus): string {
  switch (status) {
    case 'stale':
      return 'The declared penetration test has expired. Commission a new one and record its result in .agenticapps/readiness.json with a fresh validUntil.'
    case 'fail':
      return 'The declared penetration test records a failing result. Resolve the findings and update .agenticapps/readiness.json.'
    case 'warn':
      return 'The declared penetration test passed with findings. Work through them and update .agenticapps/readiness.json.'
    case 'ok':
      return 'A current penetration test is declared in .agenticapps/readiness.json. Nothing to do until it expires.'
    case 'na':
    case 'never':
      return 'This check is never derived. Once a penetration test has been performed, declare its result in .agenticapps/readiness.json with evidence, the reviewed commit, and a validUntil date.'
  }
}

export function remedyFor(
  id: CheckId,
  status: CheckStatus,
  host: ReadinessHostId | null,
): string {
  switch (id) {
    case 'workflow':
      return workflowRemedy(status, host)
    case 'spec':
      return specRemedy(status, host)
    case 'code-review':
    case 'security-review':
      return reviewRemedy(id, status)
    case 'coverage':
      return coverageRemedy(status)
    case 'pen-test':
      return penTestRemedy(status)
  }
}
