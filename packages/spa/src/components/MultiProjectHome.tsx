import { useEffect, useRef, useState } from 'react'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

import { filterAndSort, useRegistryList, type SortKey } from '../lib/registry.js'
import { useLastRefresh } from '../lib/lastRefresh.js'

import { CardContextMenu, type ContextMenuAnchor } from './CardContextMenu.js'
import { DaemonUnreachableState } from './DaemonUnreachableState.js'
import { EditTagsDialog, RenameDialog } from './RenameTagsForms.js'
import { HomeToolbar } from './HomeToolbar.js'
import { ProjectCard } from './ProjectCard.js'
import { RegisterButtonCard } from './RegisterButtonCard.js'
import { RegisterModal } from './RegisterModal.js'
import { SchemaDriftState } from './SchemaDriftState.js'
import { PageHeader } from './ui/PageHeader.js'

export function MultiProjectHome(): React.JSX.Element {
  const list = useRegistryList()

  const lastRefresh = useLastRefresh()
  const headerHelper =
    lastRefresh.count !== null
      ? `${lastRefresh.count} ${lastRefresh.count === 1 ? 'project' : 'projects'} · ${lastRefresh.refreshLabel ?? ''}`
      : ''

  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set(['all']))
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recommended')

  // Context menu state
  const [menu, setMenu] = useState<{
    anchor: ContextMenuAnchor
    item: RegistryListItem
    initialMode?: 'menu' | 'unregister-confirm'
  } | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  function openMenu(anchor: ContextMenuAnchor, item: RegistryListItem) {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setMenu({ anchor, item })
  }

  function closeMenu() {
    setMenu(null)
    setTimeout(() => previouslyFocused.current?.focus(), 0)
  }

  // Modal/dialog states
  const [registerOpen, setRegisterOpen] = useState(false)
  const [renameItem, setRenameItem] = useState<RegistryListItem | null>(null)
  const [tagsItem, setTagsItem] = useState<RegistryListItem | null>(null)
  const [newCardId, setNewCardId] = useState<string | null>(null)

  // Focus on newly-added card after register-confirm (D-29)
  useEffect(() => {
    if (!newCardId) return
    const t = setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`[data-card-id="${newCardId}"]`)
      card?.scrollIntoView({ block: 'nearest' })
      card?.focus()
      setNewCardId(null)
    }, 0)
    return () => clearTimeout(t)
  }, [newCardId])

  // Command palette "Register project" action dispatches palette:open-register
  // (commandPaletteActions.ts). Listen for it and open the modal (D-32).
  useEffect(() => {
    const onOpenRegister = () => setRegisterOpen(true)
    window.addEventListener('palette:open-register', onOpenRegister)
    return () => window.removeEventListener('palette:open-register', onOpenRegister)
  }, [])

  // Error states for the registry list
  if (list.isError) {
    if (list.error?.message?.startsWith('schema_drift:')) {
      return (
        <div>
          <SchemaDriftState
            firstIssue={{ path: '(root)', expected: 'RegistryListResponse', got: 'unknown' }}
            fullIssues={[]}
            onRetry={() => void list.refetch()}
          />
        </div>
      )
    }
    return (
      <div>
        <DaemonUnreachableState
          agentUrl="http://127.0.0.1:5193"
          onRetry={() => void list.refetch()}
        />
      </div>
    )
  }

  const items = list.data ?? []
  const filtered = filterAndSort(items, { selectedChips, searchText, sortKey })
  const existingTags = Array.from(new Set(items.flatMap((i) => i.tags))).sort()

  return (
    <div>
      <PageHeader title="Projects" helper={headerHelper} />
      <div>
        <HomeToolbar
          items={items}
          selectedChips={selectedChips}
          onChipsChange={setSelectedChips}
          searchText={searchText}
          onSearchChange={setSearchText}
          sortKey={sortKey}
          onSortChange={setSortKey}
        />

        {/* Empty state */}
        {items.length === 0 && !list.isLoading ? (
          <div className="mt-6 rounded-card border border-border-subtle bg-card-bg p-6 text-center shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">No projects registered yet.</h2>
            <p className="mt-2 max-w-[60ch] text-base text-text-secondary">
              Run{' '}
              <code className="font-mono text-sm">agentic-dashboard register &lt;path&gt;</code>{' '}
              to add one, or use the button above.
            </p>
          </div>
        ) : null}

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              data-card-id={item.id}
              data-testid={`project-card-${item.id}`}
              tabIndex={-1}
            >
              <ProjectCard item={item} onContextMenu={openMenu} />
            </div>
          ))}
          <RegisterButtonCard onClick={() => setRegisterOpen(true)} />
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <CardContextMenu
          anchor={menu.anchor}
          item={menu.item}
          {...(menu.initialMode !== undefined ? { initialMode: menu.initialMode } : {})}
          onAction={(action) => {
            if (action === 'rename') setRenameItem(menu.item)
            else if (action === 'tags') setTagsItem(menu.item)
          }}
          onClose={closeMenu}
        />
      )}

      {/* Register modal */}
      <RegisterModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onConfirmed={(id) => setNewCardId(id)}
      />

      {/* Rename / Edit tags dialogs */}
      <RenameDialog
        isOpen={!!renameItem}
        item={renameItem}
        onClose={() => setRenameItem(null)}
      />
      <EditTagsDialog
        isOpen={!!tagsItem}
        item={tagsItem}
        existingTags={existingTags}
        onClose={() => setTagsItem(null)}
      />
    </div>
  )
}
