import { clsx } from 'clsx'
import { getSourceColors } from '../lib/sourceColors'

interface Props {
  name: string
  size?: 'sm' | 'md'
}

export function SourceBadge({ name, size = 'sm' }: Props) {
  const colors = getSourceColors(name)
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-[2px] border border-dotted font-mono tracking-[1px]',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-[0.75rem]',
      )}
    >
      <span className="mrdn-dot" style={{ background: colors.dot }} />
      {name}
    </span>
  )
}
