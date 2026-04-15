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
        'inline-flex items-center rounded-full border font-mono tracking-[0.5px]',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'px-2.5 py-0.5 text-[0.65rem]' : 'px-3 py-1 text-[0.75rem]',
      )}
    >
      {name}
    </span>
  )
}
