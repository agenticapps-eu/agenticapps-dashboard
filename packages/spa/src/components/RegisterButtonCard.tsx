import { Plus } from 'lucide-react'

export interface RegisterButtonCardProps {
  onClick: () => void
}

export function RegisterButtonCard({ onClick }: RegisterButtonCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="Register a new project"
      onClick={onClick}
      className="border-2 border-dashed border-border-subtle bg-card-bg rounded-card flex items-center justify-center gap-2 text-text-secondary font-semibold text-sm p-4 min-h-[120px] hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Plus size={16} aria-hidden="true" />
      Register project
    </button>
  )
}
