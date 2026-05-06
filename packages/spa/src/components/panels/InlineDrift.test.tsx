/**
 * InlineDrift.test.tsx — TDD tests for shared InlineDrift component.
 *
 * Tests ID1–ID4:
 * ID1: renders a section with aria-labelledby="{panelId}-title" containing title "Schema drift — Foo"
 * ID2: field path "bar" is visible in <p>field: bar</p> styled mono
 * ID3: clicking the Retry button invokes onRetry
 * ID4: AlertTriangle icon is aria-hidden="true" and styled text-[--danger]
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { InlineDrift } from './InlineDrift.js'

describe('InlineDrift', () => {
  it('ID1: renders a section with aria-labelledby pointing to title "Schema drift — Foo"', () => {
    render(<InlineDrift panelId="x" title="Foo" path="bar" onRetry={vi.fn()} />)

    // PanelContainer renders a <section aria-labelledby="x-title">
    const section = document.querySelector('section[aria-labelledby="x-title"]')
    expect(section).not.toBeNull()

    // The heading contains "Schema drift — Foo"
    const heading = screen.getByRole('heading', { level: 2, name: 'Schema drift — Foo' })
    expect(heading).toBeDefined()
  })

  it('ID2: field path "bar" is visible in styled mono paragraph', () => {
    render(<InlineDrift panelId="x" title="Foo" path="bar" onRetry={vi.fn()} />)

    const fieldPara = screen.getByText(/field: bar/)
    expect(fieldPara).toBeDefined()
    expect(fieldPara.tagName).toBe('P')
    expect(fieldPara.className).toContain('font-mono')
  })

  it('ID3: clicking the Retry button invokes onRetry', () => {
    const onRetry = vi.fn()
    render(<InlineDrift panelId="x" title="Foo" path="bar" onRetry={onRetry} />)

    const retryBtn = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('ID4: AlertTriangle icon is aria-hidden and styled with text-[--danger]', () => {
    render(<InlineDrift panelId="x" title="Foo" path="bar" onRetry={vi.fn()} />)

    // The svg from lucide-react gets aria-hidden="true"
    const svgs = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgs.length).toBeGreaterThan(0)

    // The AlertTriangle wrapper span/container gets text-[--danger]
    const dangerEl = document.querySelector('.text-\\[--danger\\]')
    expect(dangerEl).not.toBeNull()
  })
})
