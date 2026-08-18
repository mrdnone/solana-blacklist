import type { BlacklistEntry } from '../api/types'
import { PubkeyCell } from './PubkeyCell'
import { SourceBadge } from './SourceBadge'

interface Props {
  entry: BlacklistEntry
  onValidatorClick?: (pubkey: string) => void
  /** Virtualizer measurement hooks — the row's real height feeds back into the offsets. */
  ref?: (el: HTMLTableRowElement | null) => void
  dataIndex?: number
}

export function BlacklistRow({ entry, onValidatorClick, ref, dataIndex }: Props) {
  const reasons = entry.sources
    .filter((s) => s.reason)
    .map((s) => s.reason!)

  return (
    <tr
      ref={ref}
      data-index={dataIndex}
      className="group border-b border-white/[0.16] hover:bg-[#131a2e] transition-colors duration-300 cursor-pointer align-top"
      onClick={onValidatorClick ? () => onValidatorClick(entry.pubkey) : undefined}
    >
      {/* Every cell clips its own content in an inner div: `overflow:hidden` on a
          <td> is not honoured reliably, so nowrap text bleeds into the next column. */}
      <td className="px-5 py-3 overflow-hidden">
        <div
          className="truncate text-[0.82rem] text-text-primary group-hover:text-rose-300 transition-colors"
          title={entry.name ?? undefined}
        >
          {entry.name ?? <span className="text-text-muted">—</span>}
        </div>
      </td>

      <td className="px-5 py-3 overflow-hidden">
        <PubkeyCell pubkey={entry.pubkey} variant="red" />
      </td>

      <td className="px-5 py-3 overflow-hidden">
        <div className="flex flex-wrap gap-1.5">
          {entry.sources.map((s, i) => (
            <SourceBadge key={`${s.name}-${i}`} name={s.name} />
          ))}
        </div>
      </td>

      <td className="px-5 py-3 overflow-hidden">
        <div
          className="line-clamp-2 break-words text-[0.82rem] leading-[1.45] text-text-secondary"
          title={reasons.length > 0 ? reasons.join('; ') : undefined}
        >
          {reasons.length > 0 ? reasons.join('; ') : <span className="text-text-muted">—</span>}
        </div>
      </td>

      <td className="px-5 py-3 overflow-hidden">
        <div className="truncate text-[0.78rem] font-mono text-text-secondary">
          {entry.first_seen ?? <span className="text-text-muted">—</span>}
        </div>
      </td>
    </tr>
  )
}
