import { useTheme, type ThemeChoice } from '../lib/theme.js'

const OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match system' },
]

export function ThemeToggle() {
  const { choice, setChoice } = useTheme()
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold leading-snug text-[--text]">Theme</h2>
      <fieldset className="space-y-1 border-0 p-0">
        <legend className="sr-only">Theme</legend>
        {OPTIONS.map(({ value, label }) => {
          const selected = choice === value
          return (
            <label
              key={value}
              className={[
                'flex cursor-pointer items-center gap-3 rounded-md border-l-2 px-3 py-2',
                selected
                  ? 'border-l-[--accent] bg-[--surface-elevated]'
                  : 'border-l-transparent hover:bg-[--surface-elevated]',
              ].join(' ')}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={selected}
                onChange={() => setChoice(value)}
                className="h-4 w-4 border-[--border-strong] text-[--accent] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-sm text-[--text]">{label}</span>
            </label>
          )
        })}
      </fieldset>
    </section>
  )
}
