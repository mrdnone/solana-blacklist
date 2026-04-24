import { useMemo, useState } from 'react'
import type { EpochSummary } from '../api/types'
import { Spinner } from './Spinner'

interface Props {
  data: EpochSummary[] | null
  isLoading: boolean
  error: string | null
  onBack: () => void
  onEpochClick: (epoch: number) => void
}

function formatLamports(lamports?: number): string {
  if (lamports == null) return '—'
  return (lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' SOL'
}

export function EpochList({ data, isLoading, error, onBack, onEpochClick }: Props) {
  const [epochSearch, setEpochSearch] = useState('')

  const filteredData = useMemo(() => {
    if (!data) return null
    const q = epochSearch.trim()
    if (!q) return data
    return data.filter((e) => String(e.epoch).includes(q))
  }, [data, epochSearch])

  if (isLoading) return <Spinner message="Loading epochs..." />

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-[0.9rem] mb-4">{error}</p>
        <button onClick={onBack} className="text-accent-green/80 hover:text-accent-green text-[0.82rem] font-mono">
          &larr; Back
        </button>
      </div>
    )
  }

  const totalCount = data?.length ?? 0
  const shownCount = filteredData?.length ?? 0
  const countLabel = epochSearch.trim()
    ? `${shownCount} of ${totalCount} epochs`
    : `${totalCount} epochs`

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[0.75rem] tracking-[1px] uppercase font-mono text-text-muted hover:text-accent-green transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Blacklist
      </button>

      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#17181e] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-4">
          <h3 className="text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
            Stored Epochs <span className="text-text-primary">({countLabel})</span>
          </h3>
          <input
            type="text"
            value={epochSearch}
            onChange={(e) => setEpochSearch(e.target.value)}
            placeholder="Search epoch number..."
            className="ml-auto max-w-[200px] rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[0.75rem] text-text-primary placeholder-text-muted outline-none focus:border-accent-green/30 focus:shadow-[0_0_30px_rgba(20,241,149,0.06)] transition-all duration-300"
          />
        </div>

        {!filteredData || filteredData.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-muted text-[0.85rem]">
            {epochSearch.trim()
              ? 'No epochs match your search.'
              : 'No epoch snapshots available yet. Snapshots are taken once per epoch boundary.'}
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#17181e]">
                <tr className="border-b border-white/[0.06]">
                  {['Epoch', 'Validators', 'Total Stake', 'Avg Commission', 'Snapshotted'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-secondary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((e) => (
                  <tr
                    key={e.epoch}
                    onClick={() => onEpochClick(e.epoch)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-300 cursor-pointer"
                  >
                    <td className="px-5 py-3 font-mono text-[0.9rem] text-accent-green/80 hover:text-accent-green">
                      {e.epoch}
                    </td>
                    <td className="px-5 py-3 text-[0.85rem] text-text-primary font-mono">
                      {e.validator_count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-[0.85rem] text-text-secondary font-mono">
                      {formatLamports(e.total_stake_lamports)}
                    </td>
                    <td className="px-5 py-3 text-[0.85rem] text-text-secondary">
                      {e.avg_commission != null ? e.avg_commission.toFixed(2) + '%' : '—'}
                    </td>
                    <td className="px-5 py-3 text-[0.78rem] text-text-muted font-mono whitespace-nowrap">
                      {new Date(e.snapshotted_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
