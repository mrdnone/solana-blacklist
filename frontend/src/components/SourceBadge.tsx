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
        'inline-flex max-w-full items-center gap-2 overflow-hidden rounded-[2px] border border-dotted font-mono tracking-[1px]',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-[0.75rem]',
      )}
      title={name}
    >
      <span className="mrdn-dot" style={{ background: colors.dot }} />
      <span className="truncate">{name}</span>
    </span>
  )
}
