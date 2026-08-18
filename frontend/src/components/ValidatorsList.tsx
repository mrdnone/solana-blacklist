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
      className="border-b border-white/[0.16] hover:bg-[#131a2e] transition-all duration-300 cursor-pointer"
    >
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary truncate max-w-[160px]" title={v.name ?? undefined}>
        {v.name ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div onClick={() => onValidatorClick(v.vote_identity)} className="cursor-pointer transition-colors hover:text-text-primary">
          <PubkeyCell pubkey={v.vote_identity} />
        </div>
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatLamports(v.activated_stake_lamports)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{v.commission != null ? v.commission + '%' : '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem]">
        {v.delinquent == null
          ? <span className="text-text-muted">—</span>
          : v.delinquent
            ? <span className="text-red-400">Yes</span>
            : <span className="text-accent-green">No</span>
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
    <main className="max-w-[1280px] mx-auto px-6 sm:px-12 py-10">
      <button onClick={onBack} className="mrdn-back uppercase mb-6">
        ← Back
      </button>

      <h2 className="font-heading text-[1.6rem] font-medium tracking-[4px] uppercase text-text-primary mb-6">
        Validators
      </h2>

      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, vote pubkey, or node pubkey…"
          className="flex-1 min-w-[260px] max-w-[440px] rounded-[2px] px-[15px] py-3 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
        />
        <div className="ml-auto">
          <StatusFilter value={status} onChange={setStatus} />
        </div>
      </div>

      {error && (
        <div className="text-ember font-mono text-[0.82rem] mb-4">{error}</div>
      )}

      {isLoading && !data ? (
        <Spinner message="Loading validators..." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[2px] border border-white/[0.3] bg-[#0e1324]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.3] sticky top-0 bg-[#0e1324] z-10">
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Name</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Vote Pubkey</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Stake</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Commission</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Delinquent</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Version</th>
                  <th className="px-4 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">Country</th>
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

          {total > 0 && (
            <div className="flex items-center justify-between mt-4">
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
        </>
      )}
    </main>
  )
}
