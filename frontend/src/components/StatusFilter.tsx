import { clsx } from 'clsx'

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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx('mrdn-filter px-[18px] py-[9px]', value === opt.value && 'mrdn-filter--active')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
