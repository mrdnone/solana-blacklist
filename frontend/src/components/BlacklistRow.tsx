import type { BlacklistEntry } from '../api/types'
import { PubkeyCell } from './PubkeyCell'
import { SourceBadge } from './SourceBadge'

interface Props {
  entry: BlacklistEntry
  onValidatorClick?: (pubkey: string) => void
}

export function BlacklistRow({ entry, onValidatorClick }: Props) {
  const reasons = entry.sources
    .filter((s) => s.reason)
    .map((s) => s.reason!)

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-300">
      <td className="px-5 py-3 text-[0.82rem] text-text-primary truncate" title={entry.name ?? undefined}>
        {onValidatorClick ? (
          <button
            onClick={() => onValidatorClick(entry.pubkey)}
            className="hover:text-accent-green transition-colors text-left truncate block w-full"
          >
            {entry.name ?? <span className="text-text-muted">—</span>}
          </button>
        ) : (
          entry.name ?? <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        {onValidatorClick ? (
          <button onClick={() => onValidatorClick(entry.pubkey)} className="hover:opacity-80 transition-opacity">
            <PubkeyCell pubkey={entry.pubkey} />
          </button>
        ) : (
          <PubkeyCell pubkey={entry.pubkey} />
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {entry.sources.map((s) => (
            <SourceBadge key={s.name} name={s.name} />
          ))}
        </div>
      </td>
      <td className="px-5 py-3 text-[0.82rem] text-text-secondary truncate" title={reasons.length > 0 ? reasons.join('; ') : undefined}>
        {reasons.length > 0 ? reasons.join('; ') : <span className="text-text-muted">—</span>}
      </td>
      <td className="px-5 py-3 text-[0.78rem] font-mono text-text-secondary whitespace-nowrap">
        {entry.first_seen ?? <span className="text-text-muted">—</span>}
      </td>
    </tr>
  )
}
