/**
 * One definition of "in flight", shared by the home card and the Change Progress
 * panel.
 *
 * A change is in flight once any task is done. Everything else — untouched task
 * lists, and changes with no task artifact at all — is proposed work. Splitting
 * on real progress rather than on artifact presence is what lets both surfaces
 * answer "what needs me" instead of listing slugs alphabetically.
 *
 * This lives outside both components because the two surfaces must agree: the
 * card previews three changes and the panel ranks all of them, and a reader who
 * clicks through from one to the other would otherwise see two different answers
 * to the same question.
 */
export interface OpenChangeProgress {
  completedTasks: number
  hasTaskArtifact: boolean
}

export function isMoving(c: OpenChangeProgress): boolean {
  return c.hasTaskArtifact && c.completedTasks > 0
}

/** Work in flight first, then proposals, each group keeping its input order. */
export function triageOrder<T extends OpenChangeProgress>(changes: T[]): T[] {
  return [...changes.filter(isMoving), ...changes.filter((c) => !isMoving(c))]
}
