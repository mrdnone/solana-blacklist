import type { BlacklistEntry } from '../api/types'
import { BlacklistRow } from './BlacklistRow'
import { Spinner } from './Spinner'

interface Props {
  entries: BlacklistEntry[]
  isLoading: boolean
  isFirstLoad: boolean
  totalCount: number | null
}

export function BlacklistTable({ entries, isLoading, isFirstLoad, totalCount }: Props) {
  if (isFirstLoad && isLoading) {
    return <Spinner message="Fetching blacklist data from all sources..." />
  }

  return (
    <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] overflow-hidden transition-all duration-400 hover:border-white/[0.12]">
      {/* Progress bar for refetches */}
      {isLoading && !isFirstLoad && (
        <div className="h-px w-full bg-white/[0.04] overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress" />
        </div>
      )}

      {/* Result count */}
      {!isLoading && totalCount !== null && (
        <div className="px-5 py-2.5 border-b border-white/[0.04] text-[0.72rem] tracking-[2px] uppercase text-text-muted font-mono">
          Showing {entries.length.toLocaleString()}
          {entries.length !== totalCount && ` of ${totalCount.toLocaleString()}`} entries
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-5 py-3 text-[0.68rem] font-mono font-normal tracking-[3px] uppercase text-text-muted w-48">
                Pubkey
              </th>
              <th className="px-5 py-3 text-[0.68rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Sources
              </th>
              <th className="px-5 py-3 text-[0.68rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-16 text-center text-text-muted text-[0.85rem]">
                  No entries match your filter
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <BlacklistRow key={entry.pubkey} entry={entry} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
