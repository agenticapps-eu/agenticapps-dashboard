/**
 * containment.ts — how a caller declares what a supplied path boundary IS.
 *
 * Owned here rather than in `paths.ts` because both resolvers need it and
 * neither should own it: `paths.ts` is a generic path utility and has no
 * business knowing the names of workflow hosts, while `coverageResolver.ts`
 * sits above it. This module is below both.
 *
 * See `openspec/specs/filesystem-access-policy/spec.md`, requirement
 * "Containment Intent Is Declared At Every Resolution Site". The short version:
 * an omitted anchor cannot be told apart from a considered decision not to
 * anchor, so the declaration is required and silence is not one of the options.
 */

/**
 * The machine roots — installed to, never checked out.
 *
 * `workflowArtifactScanner.declare.ts` aliases this as `WorkflowMachineRootId`,
 * the name scanner code already uses.
 */
export type MachineRootId =
  | 'agenticapps-bin'
  | 'claude-skills'
  | 'codex-skills'
  | 'opencode-skills'
  | 'pi-skills'

/**
 * The family roots, and the workflow-core migrations directory beneath one.
 *
 * These are *containers of* repositories rather than repositories, so a caller
 * that supplies one is not supplying a repository root and cannot honestly
 * declare `repository-root`. Found during the migration at `workflowScan.ts:64`,
 * which passes `sourceFamilyRoot` as a caller root — see tasks.md §5.
 */
export type FamilyRootId =
  | 'family-agenticapps'
  | 'family-factiv'
  | 'family-neuroflash'
  | 'workflow-migrations'

/**
 * Every named root that deliberately lies outside every repository.
 *
 * Enumerated rather than free-form so `daemon-named` cannot become an
 * open-ended exemption from anchoring. The two halves are kept separate because
 * `WorkflowMachineRootId` is iterated as an exhaustive set by `workflowScan.ts`
 * and must not silently acquire the family roots.
 */
export type DaemonNamedRootId = MachineRootId | FamilyRootId

/**
 * What a caller claims about the roots it is supplying.
 *
 * Exactly one of these is true of any supplied boundary, and which one it is
 * cannot be left unsaid.
 */
export type Containment =
  /**
   * The roots are DERIVED from a path inside a repository — `<repo>/.claude/skills`,
   * `<repo>/.github/workflows` — and must still lie under `root`. This is the
   * only variant that narrows: roots that have left `root` are dropped, and a
   * resolver's standing roots do not rescue them.
   */
  | { kind: 'anchored'; root: string }
  /**
   * The roots ARE repository roots, so anchoring them to themselves would be an
   * identity. Behaviour is deliberately unchanged from an undeclared call.
   *
   * This is NOT a claim that the resolution is confined to the roots supplied:
   * on a resolver constructed with standing roots of its own, those still apply.
   * Only `anchored` confines.
   */
  | { kind: 'repository-root' }
  /**
   * A machine root that deliberately lies outside every repository.
   *
   * `reason` states the condition that makes anchoring this root wrong, and
   * lives here so that whoever next reads the call site can find it — the
   * alternative is an archived design document they have no cause to open.
   */
  | { kind: 'daemon-named'; rootId: DaemonNamedRootId; reason: string }

/**
 * Why each machine root is not anchored to a repository.
 *
 * Constants rather than strings typed at the call site: a `reason` free-text
 * field decays into "because" one hurried edit at a time, and these particular
 * reasons are load-bearing enough to have been refuted once already (D8 of
 * `anchor-allowed-subdirs-to-root`, which established that anchoring these
 * roots would report their symlinked entries missing).
 *
 * Convention, not a constraint: `Containment['reason']` is `string`, so a call
 * site can pass anything non-blank. `rootId` is what bounds the exemption.
 * These reasons state a *condition* rather than a census — an earlier version
 * quoted "33 of 98" and "13 of 14" entries, numbers true of one machine on one
 * day, which is the reason-rot this record exists to prevent.
 */
export const DAEMON_NAMED_REASONS: Record<DaemonNamedRootId, string> = {
  'agenticapps-bin':
    'the shared producer/gate binaries live outside every repository by design; ' +
    'they are installed to a machine-wide path and read from there, not from a checkout',
  'claude-skills':
    'symlinking skills into ~/.claude/skills IS the install mechanism; ' +
    'anchoring would report every symlinked entry missing',
  'codex-skills':
    'symlinking skills into ~/.codex/skills IS the install mechanism; ' +
    'anchoring would report every symlinked entry missing',
  'opencode-skills':
    'the opencode machine-wide skills directory is installed to, not checked out; ' +
    'its entries are symlinks into repositories by design',
  'pi-skills':
    'the pi machine-wide skills directory is installed to, not checked out; ' +
    'its entries are symlinks into repositories by design',
  'family-agenticapps':
    'a family root CONTAINS repositories rather than being one; anchoring it to ' +
    'a repository root would refuse every sibling it exists to enumerate',
  'family-factiv':
    'a family root CONTAINS repositories rather than being one; anchoring it to ' +
    'a repository root would refuse every sibling it exists to enumerate',
  'family-neuroflash':
    'a family root CONTAINS repositories rather than being one; anchoring it to ' +
    'a repository root would refuse every sibling it exists to enumerate',
  'workflow-migrations':
    'the workflow-core migrations directory is read to determine the fleet head ' +
    'version, from outside whichever repository is being scanned',
}

/**
 * The anchor a declaration implies, or `undefined` for the unanchored branch.
 *
 * Both resolvers already have an anchored and an unanchored path. This maps a
 * declaration onto them and deliberately adds no third behaviour: `anchored`
 * anchors, and the other two do exactly what an undeclared call does today.
 * That is what makes this change declarative rather than behavioural.
 */
export function anchorOf(containment: Containment): string | undefined {
  return containment.kind === 'anchored' ? containment.root : undefined
}

/** Thrown reason text for a declaration that is malformed rather than merely wrong. */
export const CONTAINMENT_CONFLICT = 'anchorTo and containment are mutually exclusive'
export const CONTAINMENT_EMPTY_REASON = 'daemon-named containment requires a non-empty reason'

/**
 * Validate a declaration's internal consistency.
 *
 * Returns an error message, or null when the declaration is well-formed. What
 * this CANNOT check is whether the declaration is true — a derived boundary
 * declared `repository-root` is well-formed and wrong, and no resolver can tell.
 * That limit is stated in the spec rather than papered over; regression coverage
 * on the anchored sites is the compensating control.
 */
export function malformedContainment(containment: Containment): string | null {
  if (containment.kind === 'daemon-named' && containment.reason.trim() === '') {
    return CONTAINMENT_EMPTY_REASON
  }
  return null
}
