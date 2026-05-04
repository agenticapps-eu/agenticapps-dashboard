import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock registry hooks ──────────────────────────────────────────────────────
const mockRenameMutateAsync = vi.fn()
const mockSetTagsMutateAsync = vi.fn()

vi.mock('../lib/registry.js', () => ({
  useRename: (_id: string) => ({
    mutate: vi.fn(),
    mutateAsync: mockRenameMutateAsync,
    isPending: false,
  }),
  useSetTags: (_id: string) => ({
    mutate: vi.fn(),
    mutateAsync: mockSetTagsMutateAsync,
    isPending: false,
  }),
}))

// ── HTMLDialogElement polyfill for jsdom ─────────────────────────────────────
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
  vi.clearAllMocks()
  mockRenameMutateAsync.mockResolvedValue({ id: 'proj-1', name: 'New Name', root: '/root', client: null, addedAt: new Date().toISOString(), tags: [] })
  mockSetTagsMutateAsync.mockResolvedValue({ id: 'proj-1', name: 'Proj', root: '/root', client: null, addedAt: new Date().toISOString(), tags: ['active'] })
})

import type { RegistryListItem } from '@agenticapps/dashboard-shared'
import { EditTagsDialog, RenameDialog } from './RenameTagsForms.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const sampleItem: RegistryListItem = {
  id: 'proj-1',
  name: 'My Project',
  root: '/Users/donald/Sourcecode/my-project',
  client: 'Acme',
  addedAt: '2026-05-01T10:00:00.000Z',
  tags: ['active', 'client'],
  status: { reachable: true, currentPhase: '03-home', lastCommitAt: '2026-05-04T10:00:00.000Z' },
}

function renderRenameDialog(props: Partial<Parameters<typeof RenameDialog>[0]> = {}) {
  const defaultProps = {
    isOpen: true,
    item: sampleItem,
    onClose: vi.fn(),
    ...props,
  }
  const qc = makeQueryClient()
  render(
    <QueryClientProvider client={qc}>
      <RenameDialog {...defaultProps} />
    </QueryClientProvider>,
  )
  return defaultProps
}

function renderEditTagsDialog(props: Partial<Parameters<typeof EditTagsDialog>[0]> = {}) {
  const defaultProps = {
    isOpen: true,
    item: sampleItem,
    existingTags: ['active', 'client', 'wip'],
    onClose: vi.fn(),
    ...props,
  }
  const qc = makeQueryClient()
  render(
    <QueryClientProvider client={qc}>
      <EditTagsDialog {...defaultProps} />
    </QueryClientProvider>,
  )
  return defaultProps
}

// ── RenameDialog tests ────────────────────────────────────────────────────────

describe('RenameDialog', () => {
  it('opens with prefilled name from item', () => {
    renderRenameDialog()
    expect(screen.getByDisplayValue('My Project')).toBeInTheDocument()
  })

  it('pressing Enter calls useRename.mutateAsync with trimmed name', async () => {
    const user = userEvent.setup()
    renderRenameDialog()
    const input = screen.getByDisplayValue('My Project')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(mockRenameMutateAsync).toHaveBeenCalledWith({ name: 'New Name' })
    })
  })

  it('clicking Save calls mutateAsync', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    const input = screen.getByDisplayValue('My Project')
    await user.clear(input)
    await user.type(input, 'Renamed Project')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(mockRenameMutateAsync).toHaveBeenCalledWith({ name: 'Renamed Project' })
    })
  })

  it('Cancel calls onClose without mutateAsync', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockRenameMutateAsync).not.toHaveBeenCalled()
  })

  it('Esc calls onClose (via onCancel handler)', async () => {
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    const dialog = document.querySelector('dialog')!
    // Use fireEvent approach — cancel fires on dialog element
    const cancelEvent = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancelEvent)
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockRenameMutateAsync).not.toHaveBeenCalled()
  })

  it('empty name submitted → onClose without mutateAsync', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    const input = screen.getByDisplayValue('My Project')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockRenameMutateAsync).not.toHaveBeenCalled()
  })

  it('same name submitted → onClose without mutateAsync', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    // Name is already 'My Project' — same as item.name
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockRenameMutateAsync).not.toHaveBeenCalled()
  })

  it('calls onClose after successful save', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderRenameDialog({ onClose })
    const input = screen.getByDisplayValue('My Project')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})

// ── EditTagsDialog tests ──────────────────────────────────────────────────────

describe('EditTagsDialog', () => {
  it('renders chips for both item.tags (selected) and existingTags (union)', () => {
    renderEditTagsDialog()
    // item.tags: ['active', 'client'] — selected
    // existingTags: ['active', 'client', 'wip'] — 'wip' shown but unselected
    const activeBtn = screen.getByRole('button', { name: 'active' })
    expect(activeBtn).toBeInTheDocument()
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')

    const wipBtn = screen.getByRole('button', { name: 'wip' })
    expect(wipBtn).toBeInTheDocument()
    expect(wipBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a chip toggles aria-pressed', async () => {
    const user = userEvent.setup()
    renderEditTagsDialog()
    const activeBtn = screen.getByRole('button', { name: 'active' })
    // Initially selected
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
    // Click to deselect
    await user.click(activeBtn)
    expect(activeBtn).toHaveAttribute('aria-pressed', 'false')
    // Click to re-select
    await user.click(activeBtn)
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('typing in input + Enter adds new chip', async () => {
    const user = userEvent.setup()
    renderEditTagsDialog()
    const tagInput = screen.getByRole('textbox', { name: 'Add tag' })
    await user.type(tagInput, 'frontend')
    await user.keyboard('{Enter}')
    // New chip should appear
    expect(screen.getByRole('button', { name: 'frontend' })).toBeInTheDocument()
    // Input should be cleared
    expect(tagInput).toHaveValue('')
  })

  it('Save calls useSetTags.mutateAsync with current tags array', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderEditTagsDialog({ onClose })
    // Deselect 'active', keep 'client'
    await user.click(screen.getByRole('button', { name: 'active' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(mockSetTagsMutateAsync).toHaveBeenCalledWith({ tags: ['client'] })
    })
  })

  it('Cancel calls onClose without mutateAsync', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderEditTagsDialog({ onClose })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockSetTagsMutateAsync).not.toHaveBeenCalled()
  })

  it('Esc calls onClose without mutateAsync', async () => {
    const onClose = vi.fn()
    renderEditTagsDialog({ onClose })
    const dialog = document.querySelector('dialog')!
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(mockSetTagsMutateAsync).not.toHaveBeenCalled()
  })

  it('calls onClose after successful save', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderEditTagsDialog({ onClose })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
