import React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_IDS,
  CHECK_STATUSES,
  type CheckId,
  type CheckResult,
  type CheckStatus,
} from '@agenticapps/dashboard-shared'

/**
 * `Link` is rendered as an anchor whose href is composed from exactly the
 * props the component passes, so asserting the href asserts the destination
 * the component asked for rather than TanStack's own path building.
 */
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      to,
      params,
      hash,
      children,
      ...rest
    }: {
      to: string
      params?: { repoId?: string }
      hash?: string
      children: React.ReactNode
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={`${to.replace('$repoId', params?.repoId ?? '')}${hash === undefined ? '' : `#${hash}`}`}
        {...rest}
      >
        {children}
      </a>
    ),
  }
})

import {
  ReadinessIndicator,
  STATUS_PRESENTATION,
  CHECK_LABELS,
} from './ReadinessIndicator.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  // The appearance is global state on <html>. A test that sets it and then
  // fails mid-body would otherwise hand `.dark` to every test after it.
  document.documentElement.classList.remove('dark')
})

/**
 * A wire-shaped result. `never` and `na` carry no observed time and no evidence
 * — the schema refuses them — so the fixture honours that rather than producing
 * a shape the daemon can never send.
 */
function result(
  id: CheckId,
  status: CheckStatus,
  over: Partial<CheckResult> = {},
): CheckResult {
  const timeless = status === 'never' || status === 'na'
  return {
    id,
    status,
    source: 'derived',
    at: timeless ? null : Date.UTC(2026, 6, 30, 9, 15),
    value: null,
    threshold: null,
    summary: status === 'na' ? 'this host cannot pin a version' : '',
    evidence: null,
    error: null,
    ...over,
  }
}

/** Six results, one per check, all `ok` unless overridden by id. */
function sixChecks(over: Partial<Record<CheckId, CheckStatus>> = {}): CheckResult[] {
  return CHECK_IDS.map((id) => result(id, over[id] ?? 'ok'))
}

function labels(): string[] {
  return screen
    .getAllByRole('figure')
    .map((cell) => cell.getAttribute('aria-label') ?? '')
}

describe('ReadinessIndicator', () => {
  it.each(['compact', 'full'] as const)(
    'renders all six checks in the fixed order — %s',
    (variant) => {
      render(
        <ReadinessIndicator
          checks={sixChecks()}
          repoName="dashboard"
          variant={variant}
        />,
      )

      const rendered = labels()
      expect(rendered).toHaveLength(CHECK_IDS.length)
      CHECK_IDS.forEach((id, index) => {
        expect(rendered[index]).toContain(CHECK_LABELS[id])
      })
    },
  )

  it('shows an underlying value in the compact cell, not only in its accessible name', () => {
    // `design-system` → A Value Is Shown Where One Exists: "Colour and shape
    // summarise; they do not substitute for the number."
    //
    // The compact variant put the value in `disclose()` alone, so on the fleet
    // — the product's primary surface — a coverage cell said "amber" and never
    // said 66.42. A sighted reader had to open the repo to learn the number
    // that made the cell amber, and a fleet of thirty repos meant thirty
    // round trips to read a column of figures the daemon had already sent.
    //
    // The accessible name is not a substitute: it is reachable by pointer or
    // screen reader, and the requirement is about what the cell renders.
    const checks = sixChecks()
    const withValue = checks.map((check) =>
      check.id === 'coverage'
        ? result('coverage', 'warn', { value: 66.42, threshold: 80 })
        : check,
    ) as unknown as CheckResult[]

    render(
      <ReadinessIndicator checks={withValue} repoName="alpha" variant="compact" />,
    )

    expect(screen.getByText('66.42 of 80')).toBeInTheDocument()
  })

  it('adds nothing to a compact cell that has no underlying value', () => {
    // The paired case. A cell with no value must stay the bare glyph rather
    // than gaining an empty span, a zero, or a stray separator — the same
    // prohibition the absence marker carries.
    render(
      <ReadinessIndicator checks={sixChecks()} repoName="alpha" variant="compact" />,
    )

    expect(screen.queryByText(/\bof\b/)).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('never omits a check to close a gap, and holds each position across repos', () => {
    render(
      <ReadinessIndicator checks={sixChecks()} repoName="alpha" variant="compact" />,
    )
    const allOk = labels().map((label) => label.split(' — ')[0])
    cleanup()

    render(
      <ReadinessIndicator
        checks={sixChecks({ spec: 'fail', 'pen-test': 'never', coverage: 'warn' })}
        repoName="beta"
        variant="compact"
      />,
    )
    const mixed = labels().map((label) => label.split(' — ')[0])

    expect(mixed).toEqual(allOk)
    expect(mixed).toHaveLength(CHECK_IDS.length)
  })

  it('gives every status its own shape in the lookup table', () => {
    const icons = new Set(CHECK_STATUSES.map((s) => STATUS_PRESENTATION[s].icon))
    expect(icons.size).toBe(CHECK_STATUSES.length)
  })

  it('renders a different shape per status, so colour is never the only channel', () => {
    // The table above being distinct proves nothing about the DOM. Until this
    // existed, replacing `const Shape = presentation.icon` with a hard-coded
    // tick — every cell in the product identical regardless of status — left
    // all 72 readiness tests green. spec.md requires a rendered status to be
    // "distinguishable from the other five by shape alone", and that is a claim
    // about what is on screen.
    const shapes = new Set<string>()

    for (const status of CHECK_STATUSES) {
      cleanup()
      const checks = CHECK_IDS.map((id) => result(id, status))
      render(<ReadinessIndicator checks={checks} repoName="repo" />)

      const svg = document.querySelector('[role="figure"] svg')
      expect(svg).not.toBeNull()
      // lucide stamps its own name on every icon: `lucide-check`, `lucide-clock`.
      const name = Array.from((svg as SVGElement).classList).find((c) =>
        c.startsWith('lucide-'),
      )
      expect(name, `no lucide class for status ${status}`).toBeDefined()
      shapes.add(name as string)
    }

    expect(shapes.size).toBe(CHECK_STATUSES.length)
  })

  it.each(['light', 'dark'] as const)(
    'keeps all six shapes in the %s appearance, so the channel does not depend on the palette',
    (appearance) => {
      // The shape test above renders under whatever appearance happens to be
      // on the documentElement, which is light. That leaves the one regression
      // this requirement is most exposed to unguarded: a `dark:` variant that
      // drops or unifies the glyph, leaving dark readers with six cells told
      // apart by hue alone while every existing assertion stays green.
      //
      // Shapes are palette-independent by construction, so a pass here is
      // expected rather than surprising — the value is that it now has to
      // stay that way deliberately.
      //
      // The class comes off in afterEach rather than at the end of this body:
      // an assertion that throws mid-loop would otherwise leave `.dark` on the
      // documentElement and fail every later test in the file for a reason
      // that has nothing to do with them. Observed while mutation-testing this
      // very assertion.
      document.documentElement.classList.toggle('dark', appearance === 'dark')

      const shapes = new Set<string>()
      for (const status of CHECK_STATUSES) {
        cleanup()
        const checks = CHECK_IDS.map((id) => result(id, status))
        render(<ReadinessIndicator checks={checks} repoName="repo" />)

        const svg = document.querySelector('[role="figure"] svg')
        expect(svg, `no icon rendered for status ${status} in ${appearance}`).not.toBeNull()
        const name = Array.from((svg as SVGElement).classList).find((c) => c.startsWith('lucide-'))
        expect(name, `no lucide class for status ${status} in ${appearance}`).toBeDefined()
        shapes.add(name as string)
      }

      expect(shapes.size).toBe(CHECK_STATUSES.length)
    },
  )

  it('says when a cell failed to evaluate rather than failed on its merits', () => {
    // readinessOrder.ts claims "a reader can reconstruct any pairwise result by
    // counting cells". They could not: an evaluation error and a merits-based
    // failure both render a red X reading "failing", while the comparator ranks
    // the first strictly higher. Two repos each showing one red X could order
    // differently for a reason no cell showed.
    render(
      <ReadinessIndicator
        checks={[
          result('spec', 'fail', {
            error: { code: 'deriver-crashed', message: 'the spec deriver threw' },
          }),
        ]}
        repoName="dashboard"
      />,
    )

    const label = screen.getByRole('figure').getAttribute('aria-label') ?? ''
    expect(label).toContain('the spec deriver threw')
    expect(label).toMatch(/could not be evaluated|evaluation error/i)
  })

  it('gives every status its own words, so the disclosure never reads ambiguously', () => {
    const words = new Set(CHECK_STATUSES.map((s) => STATUS_PRESENTATION[s].word))
    expect(words.size).toBe(CHECK_STATUSES.length)
  })

  it.each([
    ['ok', 'bg-status-success/10', 'text-status-success'],
    ['warn', 'bg-status-warning/10', 'text-status-warning'],
    ['stale', 'bg-status-warning/10', 'text-status-warning'],
    ['fail', 'bg-status-error/10', 'text-status-error'],
    ['never', 'bg-text-tertiary/10', 'text-text-secondary'],
    ['na', 'bg-text-tertiary/10', 'text-text-secondary'],
  ] as const)('maps %s to its tokens', (status, bg, text) => {
    render(
      <ReadinessIndicator
        checks={[result('workflow', status)]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const cell = screen.getByRole('figure')
    expect(cell.className).toContain(bg)
    expect(cell.className).toContain(text)
  })

  it('shows a value in the full variant and withholds it in the compact one', () => {
    const checks = [result('coverage', 'ok', { value: 87.4, threshold: 80 })]

    render(
      <ReadinessIndicator checks={checks} repoName="dashboard" variant="full" />,
    )
    expect(screen.getByText('87.4 of 80')).toBeTruthy()
    cleanup()

    render(
      <ReadinessIndicator checks={checks} repoName="dashboard" variant="compact" />,
    )
    expect(screen.queryByText('87.4 of 80')).toBeNull()
  })

  it('reads a value against its threshold, since the threshold is why it is green', () => {
    render(
      <ReadinessIndicator
        checks={[result('coverage', 'warn', { value: 76, threshold: 80 })]}
        repoName="dashboard"
        variant="full"
      />,
    )
    expect(screen.getByText('76 of 80')).toBeTruthy()
  })

  it('renders a value with no threshold on its own', () => {
    render(
      <ReadinessIndicator
        checks={[result('spec', 'warn', { value: 3 })]}
        repoName="dashboard"
        variant="full"
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })

  /**
   * `aria-label` REPLACES an element's visible text for assistive tech. A value
   * rendered in the cell but left out of the label is a number a screen-reader
   * user cannot reach at all — and in the compact variant, the label is the only
   * place it could ever appear.
   */
  it.each(['compact', 'full'] as const)(
    'puts the value in the accessible name too — %s',
    (variant) => {
      render(
        <ReadinessIndicator
          checks={[result('coverage', 'ok', { value: 87.4, threshold: 80 })]}
          repoName="dashboard"
          variant={variant}
        />,
      )
      expect(screen.getByRole('figure').getAttribute('aria-label')).toContain(
        '87.4 of 80',
      )
    },
  )

  /**
   * spec.md — "Not-applicable states its reason": the UI renders that reason
   * "rather than an unexplained grey cell". The schema forces the daemon to
   * supply it, so dropping it here would waste a fact it was made to carry.
   */
  it('renders the not-applicable reason rather than an unexplained grey cell', () => {
    render(
      <ReadinessIndicator
        checks={[result('workflow', 'na')]}
        repoName="dashboard"
        variant="compact"
      />,
    )
    expect(screen.getByRole('figure').getAttribute('aria-label')).toContain(
      'this host cannot pin a version',
    )
  })

  /** spec.md — "every warning and not-applicable reason remains visible". */
  it('keeps a warning reason visible', () => {
    render(
      <ReadinessIndicator
        checks={[
          result('spec', 'warn', { summary: '3 changes open, 7 of 12 tasks done' }),
        ]}
        repoName="dashboard"
        variant="compact"
      />,
    )
    expect(screen.getByRole('figure').getAttribute('aria-label')).toContain(
      '3 changes open, 7 of 12 tasks done',
    )
  })

  it('discloses the check name, the status in words, the time and the provenance', () => {
    render(
      <ReadinessIndicator
        checks={[
          result('security-review', 'stale', {
            source: 'declared',
            at: Date.UTC(2026, 6, 30, 9, 15),
          }),
        ]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const cell = screen.getByRole('figure')
    const disclosure = cell.getAttribute('aria-label') ?? ''
    expect(disclosure).toContain(CHECK_LABELS['security-review'])
    expect(disclosure).toContain(STATUS_PRESENTATION.stale.word)
    expect(disclosure).toContain('2026-07-30 09:15 UTC')
    expect(disclosure).toContain('declared')
    // The same text is available to a pointer, not to a screen reader alone.
    expect(cell.getAttribute('title')).toBe(disclosure)
  })

  // A declared `never` and a derived `never` render the same shape and the same
  // grey, and reach opposite verdicts. The advisory note is what tells them
  // apart, and it is gated on provenance for exactly this reason: telling a
  // reader that the check "does not block readiness" when the repo declared it —
  // and is therefore not ready because of it — would send them looking for a
  // blocker that is the very cell they are reading.
  it('calls a derived never advisory and a declared never not', () => {
    const { unmount } = render(
      <ReadinessIndicator
        checks={[result('pen-test', 'never')]}
        repoName="dashboard"
        variant="compact"
      />,
    )
    expect(screen.getByRole('figure').getAttribute('aria-label')).toContain(
      'does not block readiness',
    )
    unmount()

    render(
      <ReadinessIndicator
        checks={[result('pen-test', 'never', { source: 'declared' })]}
        repoName="dashboard"
        variant="compact"
      />,
    )
    const declared = screen.getByRole('figure').getAttribute('aria-label') ?? ''
    expect(declared).not.toContain('does not block readiness')
    expect(declared).toContain('declared')
  })

  // A refused declaration: `declared` provenance carrying an evaluation error.
  // The combination is new — previously a rejected citation discarded the whole
  // file, so every check fell back to `derived` — and it must route through the
  // existing error path rather than reading as an ordinary merits-based failure.
  it('renders a refused declaration as an evaluation error, not a plain fail', () => {
    render(
      <ReadinessIndicator
        checks={[
          result('code-review', 'fail', {
            source: 'declared',
            at: null,
            error: {
              code: 'evidence-unverifiable',
              message: 'docs/review.md could not be read',
            },
          }),
        ]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const disclosure = screen.getByRole('figure').getAttribute('aria-label') ?? ''
    expect(disclosure).toContain('could not be evaluated')
    expect(disclosure).toContain('declared')
    expect(disclosure).toContain('docs/review.md could not be read')
  })

  it('renders an em dash for a missing time rather than inventing one', () => {
    render(
      <ReadinessIndicator
        checks={[result('pen-test', 'never')]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const disclosure = screen.getByRole('figure').getAttribute('aria-label') ?? ''
    // The em dash must be in the TIME's position. A bare toContain('—') would
    // also be satisfied by the separator `disclose` emits unconditionally, and
    // would keep passing if the timestamp were dropped entirely.
    expect(disclosure).toContain(', —,')
    // Nothing resembling a rendered timestamp may stand in for the absent one.
    expect(disclosure).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(disclosure).not.toContain('UTC')
  })

  it('names the repo on the group so two rows are tellable apart', () => {
    render(
      <ReadinessIndicator checks={sixChecks()} repoName="dashboard" variant="compact" />,
    )
    expect(screen.getByRole('group').getAttribute('aria-label')).toContain('dashboard')
  })

  describe('given a repoId, each cell selects its own check', () => {
    it('links to the repo detail positioned at that check', () => {
      render(
        <ReadinessIndicator
          checks={sixChecks()}
          repoName="dashboard"
          repoId="dashboard"
          variant="compact"
        />,
      )

      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(CHECK_IDS.length)
      CHECK_IDS.forEach((id, index) => {
        expect(links[index]?.getAttribute('href')).toBe(`/repos/dashboard#${id}`)
      })
    })

    it('keeps the whole disclosure as the control name', () => {
      render(
        <ReadinessIndicator
          checks={[result('coverage', 'warn', { value: 76, threshold: 80 })]}
          repoName="dashboard"
          repoId="dashboard"
        />,
      )

      const name = screen.getByRole('link').getAttribute('aria-label') ?? ''
      expect(name).toContain(CHECK_LABELS.coverage)
      expect(name).toContain(STATUS_PRESENTATION.warn.word)
      expect(name).toContain('76 of 80')
    })

    it('drops the native title in favour of a tooltip that opens on focus', () => {
      // A native title never reaches a sighted keyboard user. It was the right
      // trade while the cell could not be focused; a control has no such excuse.
      vi.useFakeTimers()
      render(
        <ReadinessIndicator
          checks={[result('coverage', 'ok')]}
          repoName="dashboard"
          repoId="dashboard"
        />,
      )

      const link = screen.getByRole('link')
      expect(link.getAttribute('title')).toBeNull()

      // Closed, the panel is aria-hidden and so out of the accessibility tree —
      // reach it through the DOM until it opens.
      const panel = document.querySelector('[role="tooltip"]') as HTMLElement
      expect(panel.className).toContain('opacity-0')
      expect(screen.queryByRole('tooltip')).toBeNull()

      act(() => { fireEvent.focus(link) })
      act(() => { vi.advanceTimersByTime(100) })
      expect(panel.className).toContain('opacity-100')
      expect(panel.textContent).toContain(CHECK_LABELS.coverage)
      // Open, it is announceable — one panel, not six.
      expect(screen.getAllByRole('tooltip')).toHaveLength(1)
    })

    it('adds no tab stop beyond the six controls themselves', () => {
      render(
        <ReadinessIndicator
          checks={sixChecks()}
          repoName="dashboard"
          repoId="dashboard"
          variant="compact"
        />,
      )

      // Six controls, and six is the whole tab cost of a row's checks. The
      // assertion below alone would also pass if the component rendered nothing
      // at all, so count the controls first — that is what §9.3 traded the
      // Tooltip's own tabIndex away to protect.
      expect(screen.getAllByRole('link')).toHaveLength(CHECK_IDS.length)
      expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(0)
    })

    it('stays a plain figure with a title when no repoId is given', () => {
      // The detail header renders the same six checks; linking each of them to
      // the page they are already on would be noise.
      render(
        <ReadinessIndicator
          checks={[result('coverage', 'ok')]}
          repoName="dashboard"
          variant="full"
        />,
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByRole('figure').getAttribute('title')).not.toBeNull()
    })
  })
})
