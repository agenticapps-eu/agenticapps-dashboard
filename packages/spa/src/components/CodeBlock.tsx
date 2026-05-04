import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export type CodeBlockProps = {
  command: string
  copyLabel: string
}

export function CodeBlock({ command, copyLabel }: CodeBlockProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
      setState('copied')
      window.setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('failed')
      window.setTimeout(() => setState('idle'), 3000)
    }
  }

  const Icon = state === 'copied' ? Check : Copy
  const iconColor =
    state === 'copied' ? 'text-[--success]' : 'text-[--text-muted] group-hover:text-[--text]'

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[--border-strong] bg-[--surface-elevated] px-3 py-2 font-mono text-sm text-[--text]">
        {command}
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copyLabel}
        className="group inline-flex h-9 w-9 items-center justify-center rounded-md border border-[--border-strong] bg-[--surface-elevated] hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        <Icon size={14} aria-hidden="true" className={iconColor} />
      </button>
      {state === 'copied' && (
        <span aria-live="polite" className="sr-only">
          Copied
        </span>
      )}
      {state === 'failed' && (
        <span role="alert" className="sr-only">
          Failed to copy. Press Cmd+C with the line selected.
        </span>
      )}
    </div>
  )
}
