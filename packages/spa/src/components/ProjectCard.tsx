/**
 * ProjectCard stub — plan 03-08 wave 3.
 *
 * The canonical implementation lives in plan 03-07's worktree.
 * This stub satisfies the import so MultiProjectHome can compile.
 * The orchestrator will reconcile during post-wave merge.
 */
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

export type ContextMenuAnchor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'element'; el: HTMLElement }

export interface ProjectCardProps {
  item: RegistryListItem
  onContextMenu: (anchor: ContextMenuAnchor, item: RegistryListItem) => void
}

export function ProjectCard({ item, onContextMenu }: ProjectCardProps): React.JSX.Element {
  return (
    <div aria-label={`View ${item.name}`}>
      {item.name}
      {/* Stub kebab button — triggers onContextMenu so MultiProjectHome tests can open the menu */}
      <button
        type="button"
        aria-label={`Project options for ${item.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onContextMenu({ type: 'element', el: e.currentTarget }, item)
        }}
      >
        ⋮
      </button>
    </div>
  )
}
