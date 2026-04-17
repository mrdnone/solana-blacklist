import { useDeferredValue, useMemo, useState } from 'react'
import type { EpochDetailResponse, ValidatorEpochSnapshot } from '../api/types'
import { PubkeyCell } from './PubkeyCell'
import { Spinner } from './Spinner'
import { TableSearch } from './TableSearch'

interface Props {
  epoch: number
  data: EpochDetailResponse | null
  isLoading: boolean
  error: string | null
  onBack: () => void
  onValidatorClick: (pubkey: string) => void
}

function formatLamports(lamports?: number): string {
  if (lamports == null) return '—'
  return (lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SOL'
}

function formatNumber(n?: number): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function ValidatorRow({ v, onValidatorClick }: { v: ValidatorEpochSnapshot; onValidatorClick: (pubkey: string) => void }) {
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-300">
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary truncate max-w-[160px]" title={v.name ?? undefined}>
        <button
          onClick={() => onValidatorClick(v.vote_identity)}
          className="hover:text-accent-green transition-colors text-left truncate block w-full"
        >
          {v.name ?? <span className="text-text-muted">—</span>}
        </button>
      </td>
      <td className="px-4 py-2.5">
        <button onClick={() => onValidatorClick(v.vote_identity)} className="hover:opacity-80 transition-opacity">
          <PubkeyCell pubkey={v.vote_identity} />
        </button>
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatLamports(v.activated_stake_lamports)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.commission != null ? v.commission + '%' : '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem]">
        {v.is_delinquent
          ? <span className="text-red-400">Yes</span>
          : <span className="text-accent-green/70">No</span>
        }
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatNumber(v.epoch_credits)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.version ?? '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.ip_country ?? '—'}</td>
    </tr>
  )
}

function filterValidators(validators: ValidatorEpochSnapshot[], query: string): ValidatorEpochSnapshot[] {
  const q = query.trim().toLowerCase()
  if (!q) return validators
  return validators.filter(
    (v) =>
      v.vote_identity.toLowerCase().includes(q) ||
      v.name?.toLowerCase().includes(q) ||
      v.node_pubkey?.toLowerCase().includes(q) ||
      v.ip_country?.toLowerCase().includes(q) ||
      v.version?.toLowerCase().includes(q),
  )
}

export function EpochDetail({ epoch, data, isLoading, error, onBack, onValidatorClick }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const filtered = useMemo(
    () => filterValidators(data?.validators ?? [], deferredSearch),
    [data?.validators, deferredSearch],
  )

  if (isLoading) return <Spinner message={`Loading epoch ${epoch}...`} />

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
          {data.validator_count.toLocaleString()} validators snapshotted
        </p>
      </div>

      {/* Search */}
      <TableSearch value={searchQuery} onChange={setSearchQuery} />

      {/* Validator table */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/[0.04] text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
          Showing <span className="text-text-primary">{filtered.length.toLocaleString()}</span>
          {filtered.length !== data.validator_count && ` of ${data.validator_count.toLocaleString()}`} validators
        </div>
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0d0d18]">
              <tr className="border-b border-white/[0.06]">
                {['Name', 'Vote Pubkey', 'Stake', 'Comm.', 'Delinq.', 'Credits', 'Version', 'Country'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-text-muted text-[0.85rem]">
                    No validators match your search
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <ValidatorRow key={v.vote_identity} v={v} onValidatorClick={onValidatorClick} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
