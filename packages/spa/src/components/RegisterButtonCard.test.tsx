import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RegisterButtonCard } from './RegisterButtonCard.js'

describe('RegisterButtonCard', () => {
  it('renders with aria-label "Register a new project"', () => {
    render(<RegisterButtonCard onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Register a new project' })).toBeInTheDocument()
  })

  it('renders label text "Register project"', () => {
    render(<RegisterButtonCard onClick={() => {}} />)
    expect(screen.getByText('Register project')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RegisterButtonCard onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has dashed accent border class', () => {
    render(<RegisterButtonCard onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('border-dashed')
    expect(btn.className).toContain('border-[--accent]')
  })
})
