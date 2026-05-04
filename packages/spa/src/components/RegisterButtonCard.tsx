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
      className="border-2 border-dashed border-[--accent] rounded-md flex items-center justify-center gap-2 text-[--accent] font-semibold text-sm p-4 min-h-[120px] hover:bg-[--surface-elevated] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
    >
      <Plus size={16} aria-hidden="true" />
      Register project
    </button>
  )
}
