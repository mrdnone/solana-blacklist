import { clsx } from 'clsx'

interface Props {
  sources: string[]
  active: string | null
  onChange: (source: string | null) => void
}

export function SourceFilter({ sources, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={clsx(
          'rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border transition-all duration-300',
          active === null
            ? 'bg-white/[0.08] text-text-primary border-white/[0.15]'
            : 'bg-transparent text-text-muted border-white/[0.06] hover:text-text-secondary hover:border-white/[0.12]',
        )}
      >
        All
      </button>
      {sources.map((name) => {
        const isActive = active === name
        return (
          <button
            key={name}
            onClick={() => onChange(isActive ? null : name)}
            className={clsx(
              'rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border transition-all duration-300',
              isActive
                ? 'bg-white/[0.08] text-text-primary border-white/[0.15]'
                : 'bg-transparent text-text-muted border-white/[0.06] hover:text-text-secondary hover:border-white/[0.12]',
            )}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}
