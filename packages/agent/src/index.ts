export { AGENT_VERSION } from './version.js'
// Phase 5 Plan 06 Task 2: export parser functions so the meta-observer
// end-to-end script can round-trip producer → consumer without a tsup lib split.
export { parseCommitmentBlock, readSkillObservations } from './lib/phaseDetail.js'
