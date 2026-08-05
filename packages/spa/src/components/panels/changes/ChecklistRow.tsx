/**
 * ChecklistRow.tsx — one task line, with its inline markup rendered.
 *
 * Checklist text comes out of a `tasks.md` this daemon does not control, so it
 * is never handed to a markup parser and never reaches `innerHTML`. It is
 * **tokenised into React elements**: the only things recognised are inline code
 * spans and bold runs, and everything else stays a text node, which React
 * escapes. A `<img onerror=…>` in a row therefore renders as the characters
 * someone typed.
 *
 * The first draft rendered the raw string, which was safe and unreadable — rows
 * showed literal backticks and asterisks on screen. Safety and legibility were
 * being treated as one problem; they are two, and only the first was solved.
 */
import type { ReactElement, ReactNode } from 'react'

/**
 * Inline code first, so a `**` inside a code span stays literal.
 *
 * Bold is non-greedy and its content is rendered **recursively**, because the
 * two forms nest in real task text — `**Not carried, recorded in \`changes.ts\`'s
 * docblock:**` is a row from this change's own tasks file. A single flat pass
 * left one unmatched `**` on screen out of 129 rows; recursion is both shorter
 * than special-casing it and correct for the general shape.
 */
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*/gu

export function renderInlineMarkup(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0

  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0
    if (at > last) nodes.push(text.slice(last, at))
    if (match[1] !== undefined) {
      nodes.push(
        // `text-xs` rather than the `0.9em` this carried: the row is `text-sm`
        // (12px), so the relative value resolved to 10.8px — a size the scale
        // does not contain, reached by arithmetic instead of by choice. The
        // token one step down is 11px and does the same job, which is shrinking
        // mono to sit level with the surrounding sans.
        <code key={(key += 1)} className="rounded bg-card-bg-hover px-1 font-mono text-xs">
          {match[1]}
        </code>,
      )
    } else if (match[2] !== undefined) {
      nodes.push(
        <strong key={(key += 1)} className="font-semibold">
          {renderInlineMarkup(match[2])}
        </strong>,
      )
    }
    last = at + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function ChecklistRow({
  text,
  completed,
}: {
  text: string
  completed: boolean
}): ReactElement {
  return (
    <li
      className={
        completed
          ? 'flex gap-2 text-sm text-text-tertiary line-through'
          : 'flex gap-2 text-sm text-text-primary'
      }
    >
      <span aria-hidden="true" className="shrink-0">
        {completed ? '✓' : '·'}
      </span>
      {/* Clamped, so one 400-character task does not become the whole panel. */}
      <span className="line-clamp-3 min-w-0">{renderInlineMarkup(text)}</span>
    </li>
  )
}
