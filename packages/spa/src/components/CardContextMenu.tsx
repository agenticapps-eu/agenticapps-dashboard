/**
 * CardContextMenu stub — plan 03-08 wave 3.
 *
 * The canonical implementation lives in plan 03-07's worktree.
 * This stub satisfies the import so MultiProjectHome can compile.
 * The orchestrator will reconcile during post-wave merge.
 */
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

export type ContextMenuAnchor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'element'; el: HTMLElement }

export interface CardContextMenuProps {
  anchor: ContextMenuAnchor
  item: RegistryListItem
  initialMode?: 'menu' | 'unregister-confirm'
  onAction: (action: 'rename' | 'tags') => void
  onClose: () => void
}

export function CardContextMenu({ item, onAction, onClose }: CardContextMenuProps): React.JSX.Element {
  return (
    <div data-testid="card-context-menu" role="menu">
      <button
        role="menuitem"
        onClick={() => { onAction('rename'); onClose() }}
      >
        Rename {item.name}
      </button>
      <button
        role="menuitem"
        onClick={() => { onAction('tags'); onClose() }}
      >
        Edit tags {item.name}
      </button>
    </div>
  )
}
