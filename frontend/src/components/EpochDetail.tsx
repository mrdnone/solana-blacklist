import { useDeferredValue, useState } from 'react'
import type { BlacklistSourceRef, ValidatorEpochSnapshot } from '../api/types'
import { useEpochDetail } from '../hooks/useEpochDetail'
import { PubkeyCell } from './PubkeyCell'
import { SourceBadge } from './SourceBadge'
import { Spinner } from './Spinner'

interface Props {
  epoch: number
  initialSearch?: string
  onBack: () => void
  onValidatorClick: (pubkey: string) => void
}

const PAGE_SIZE = 50

function formatLamports(lamports?: number): string {
  if (lamports == null) return '—'
  return (lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SOL'
}

function SourcesCell({ sources }: { sources?: BlacklistSourceRef[] }) {
  if (!sources || sources.length === 0) return <span className="text-text-muted">—</span>
  return (
    <div className="flex flex-col gap-1">
      {sources.map((s, i) => (
        <div key={`${s.name}-${i}`} className="flex flex-col gap-0.5">
          <SourceBadge name={s.name} />
          {s.reason && (
            <span className="text-[0.72rem] text-text-muted leading-snug">{s.reason}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function ValidatorRow({ v, onValidatorClick }: { v: ValidatorEpochSnapshot; onValidatorClick: (pubkey: string) => void }) {
  return (
    <tr
      onClick={() => onValidatorClick(v.vote_identity)}
      className="border-b border-white/[0.16] hover:bg-[#131a2e] transition-all duration-300 cursor-pointer"
    >
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary truncate max-w-[160px]" title={v.name ?? undefined}>
        {v.name ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div onClick={() => onValidatorClick(v.vote_identity)} className="cursor-pointer">
          <PubkeyCell pubkey={v.vote_identity} variant="red" />
        </div>
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatLamports(v.activated_stake_lamports)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.commission != null ? v.commission + '%' : '—'}</td>
      <td className="px-4 py-2.5">
        <SourcesCell sources={v.blacklist_sources} />
      </td>
    </tr>
  )
}

export function EpochDetail({ epoch, initialSearch = '', onBack, onValidatorClick }: Props) {
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const deferredSearch = useDeferredValue(searchQuery)
  const [offset, setOffset] = useState(0)

  const [prevSearch, setPrevSearch] = useState(deferredSearch)
  if (deferredSearch !== prevSearch) {
    setPrevSearch(deferredSearch)
    setOffset(0)
  }

  const { data, isLoading, error } = useEpochDetail(epoch, deferredSearch, undefined, true, PAGE_SIZE, offset)

  const total = data?.total ?? 0
  const start = offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)

  if (isLoading && !data) return <Spinner message={`Loading epoch ${epoch}...`} />

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-[0.9rem] mb-4">{error}</p>
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary text-[0.82rem] font-mono transition-colors">
          &larr; Back
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="mrdn-back uppercase"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Epochs
      </button>

      <div className="card-glow rounded-[2px] border border-white/[0.3] bg-[#0e1324] p-6">
        <h2 className="text-[1.5rem] font-heading font-medium tracking-[-0.5px] text-text-primary">
          Epoch {epoch}
        </h2>
        <p className="mt-1 text-[0.82rem] text-text-muted font-mono">
          {total.toLocaleString()} blacklisted validator{total !== 1 ? 's' : ''} at this epoch
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, vote pubkey, or node pubkey…"
          className="flex-1 min-w-[200px] max-w-md border border-white/[0.55] rounded-[2px] px-4 py-2.5 text-[0.82rem] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/[0.85] transition-colors"
        />
      </div>

      <div className="card-glow rounded-[2px] border border-white/[0.3] bg-[#0e1324] overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0e1324]">
              <tr className="border-b border-white/[0.3]">
                {['Name', 'Vote Pubkey', 'Stake', 'Comm.', 'Blacklist Sources & Reason'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[0.65rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.validators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-text-muted text-[0.85rem]">
                    No blacklisted validators recorded for this epoch
                  </td>
                </tr>
              ) : (
                data.validators.map((v) => (
                  <ValidatorRow key={v.vote_identity} v={v} onValidatorClick={onValidatorClick} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-[0.78rem] text-text-muted font-mono">
            Showing {start}–{end} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="mrdn-btn mrdn-btn--sm uppercase"
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="mrdn-btn mrdn-btn--sm uppercase"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
