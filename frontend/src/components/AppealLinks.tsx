import type { ContactInfo } from '../api/types'
import { getAppealLinks } from '../lib/sourceLinks'

const KIND_ICONS: Record<string, string> = {
  discord: '💬',
  telegram: '✈️',
  web: '🌐',
}

interface Props {
  contactInfo: ContactInfo | null | undefined
}

export function AppealLinks({ contactInfo }: Props) {
  const links = getAppealLinks(contactInfo)
  if (links.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
      <span className="text-[0.65rem] font-mono text-text-muted tracking-[3px] uppercase">Appeal:</span>
      {links.map((l) => (
        <a
          key={l.kind}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[0.68rem] font-mono text-text-muted
                     border border-white/[0.3] rounded-[2px] px-2 py-0.5
                     hover:text-text-primary hover:border-white/[0.55]
                     transition-all duration-200 whitespace-nowrap"
        >
          <span>{KIND_ICONS[l.kind]}</span>
          {l.label}
        </a>
      ))}
    </div>
  )
}
