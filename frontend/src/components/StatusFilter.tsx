interface Props {
  value: 'active' | 'delinquent' | 'all'
  onChange: (value: 'active' | 'delinquent' | 'all') => void
}

const options: { label: string; value: Props['value'] }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Delinquent', value: 'delinquent' },
  { label: 'All', value: 'all' },
]

export function StatusFilter({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.06] overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-[0.72rem] tracking-[1.5px] uppercase font-mono transition-all duration-200 ${
            value === opt.value
              ? 'bg-accent-green/10 text-accent-green border-accent-green/20'
              : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
