import { useDeferredValue, useState } from 'react'
import { useValidators } from '../hooks/useValidators'
import { PubkeyCell } from './PubkeyCell'
import { Spinner } from './Spinner'
import { StatusFilter } from './StatusFilter'
import type { ValidatorMeta } from '../api/types'

type StatusValue = 'active' | 'delinquent' | 'all'

function statusToDelinquent(s: StatusValue): boolean | undefined {
  if (s === 'active') return false
  if (s === 'delinquent') return true
  return undefined
}

interface Props {
  onBack: () => void
  onValidatorClick: (pubkey: string) => void
}

const PAGE_SIZE = 50

function formatLamports(lamports?: number): string {
  if (lamports == null) return '—'
  return (lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SOL'
}

function ValidatorRow({ v, onValidatorClick }: { v: ValidatorMeta; onValidatorClick: (pubkey: string) => void }) {
  return (
    <tr
      onClick={() => onValidatorClick(v.vote_identity)}
      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-300 cursor-pointer"
    >
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary truncate max-w-[160px]" title={v.name ?? undefined}>
        {v.name ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onValidatorClick(v.vote_identity)} className="hover:opacity-80 transition-opacity">
          <PubkeyCell pubkey={v.vote_identity} />
        </button>
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatLamports(v.activated_stake_lamports)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.commission != null ? v.commission + '%' : '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem]">
        {v.delinquent == null
          ? <span className="text-text-muted">—</span>
          : v.delinquent
            ? <span className="text-red-400">Yes</span>
            : <span className="text-accent-green/70">No</span>
        }
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.version ?? '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.ip_country ?? '—'}</td>
    </tr>
  )
}

export function ValidatorsList({ onBack, onValidatorClick }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<StatusValue>('active')

  // Reset offset when search or filter changes
  const [prevSearch, setPrevSearch] = useState(deferredSearch)
  const [prevStatus, setPrevStatus] = useState(status)
  if (deferredSearch !== prevSearch || status !== prevStatus) {
    setPrevSearch(deferredSearch)
    setPrevStatus(status)
    setOffset(0)
  }

  const { data, isLoading, error } = useValidators(deferredSearch, statusToDelinquent(status), status !== 'active', PAGE_SIZE, offset)

  const validators = data?.validators ?? []

  const total = data?.total ?? 0
  const start = offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)

  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
      <button onClick={onBack} className="text-text-muted hover:text-text-primary text-[0.78rem] font-mono tracking-wider uppercase mb-6 transition-colors">
        ← Back
      </button>

      <h2 className="font-heading text-[1.6rem] font-semibold tracking-[4px] uppercase text-text-primary mb-6">
        Validators
      </h2>

      {/* Search + Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, vote pubkey, or node pubkey…"
          className="flex-1 min-w-[200px] max-w-md bg-card-bg border border-white/[0.06] rounded-lg px-4 py-2.5 text-[0.82rem] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-green/30 transition-colors"
        />
        <StatusFilter value={status} onChange={setStatus} />
      </div>

      {/* Hidden count notice */}
      {error && (
        <div className="text-red-400 text-[0.82rem] mb-4">{error}</div>
      )}

      {isLoading && !data ? (
        <Spinner message="Loading validators..." />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-card-bg/60 backdrop-blur-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] sticky top-0 bg-card-bg/90 backdrop-blur-sm z-10">
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Name</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Vote Pubkey</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Stake</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Commission</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Delinquent</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Version</th>
                  <th className="px-4 py-3 text-[0.7rem] tracking-[2px] uppercase text-text-muted font-medium">Country</th>
                </tr>
              </thead>
              <tbody>
                {validators.map((v) => (
                  <ValidatorRow key={v.vote_identity} v={v} onValidatorClick={onValidatorClick} />
                ))}
                {data && validators.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-[0.82rem]">
                      No validators found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-4">
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
        </>
      )}
    </main>
  )
}
