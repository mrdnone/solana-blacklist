import { useDeferredValue, useState } from 'react'
import type { BlacklistSourceRef, ValidatorEpochSnapshot } from '../api/types'
import { useEpochDetail } from '../hooks/useEpochDetail'
import { PubkeyCell } from './PubkeyCell'
import { SourceBadge } from './SourceBadge'
import { Spinner } from './Spinner'

interface Props {
  epoch: number
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
      className="border-b border-white/[0.04] hover:bg-rose-500/[0.07] transition-all duration-300 cursor-pointer"
    >
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary truncate max-w-[160px]" title={v.name ?? undefined}>
        {v.name ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div onClick={() => onValidatorClick(v.vote_identity)} className="cursor-pointer hover:opacity-80 transition-opacity">
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

export function EpochDetail({ epoch, onBack, onValidatorClick }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [offset, setOffset] = useState(0)

  // Reset offset when search changes
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
        <button onClick={onBack} className="text-accent-green/80 hover:text-accent-green text-[0.82rem] font-mono">
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
        className="inline-flex items-center gap-2 text-[0.75rem] tracking-[1px] uppercase font-mono text-text-muted hover:text-accent-green transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Epochs
      </button>

      {/* Epoch header */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6">
        <h2 className="text-[1.5rem] font-heading font-semibold bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent">
          Epoch {epoch}
        </h2>
        <p className="mt-1 text-[0.82rem] text-text-muted font-mono">
          {total.toLocaleString()} blacklisted validator{total !== 1 ? 's' : ''} at this epoch
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, vote pubkey, or node pubkey…"
          className="flex-1 min-w-[200px] max-w-md bg-card-bg border border-white/[0.06] rounded-lg px-4 py-2.5 text-[0.82rem] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-green/30 transition-colors"
        />
      </div>

      {/* Blacklisted validator table */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0d0d18]">
              <tr className="border-b border-white/[0.06]">
                {['Name', 'Vote Pubkey', 'Stake', 'Comm.', 'Blacklist Sources & Reason'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-secondary">
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

      {/* Pagination — only shown when needed */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-[0.78rem] text-text-muted font-mono">
            Showing {start}–{end} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="text-[0.72rem] tracking-[2px] uppercase font-mono border border-white/[0.08] rounded-lg px-4 py-2 text-text-secondary hover:text-text-primary hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="text-[0.72rem] tracking-[2px] uppercase font-mono border border-white/[0.08] rounded-lg px-4 py-2 text-text-secondary hover:text-text-primary hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
