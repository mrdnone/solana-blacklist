import type { ValidatorDetailResponse, ValidatorEpochSnapshot } from '../api/types'
import { PubkeyCell } from './PubkeyCell'
import { Spinner } from './Spinner'

interface Props {
  data: ValidatorDetailResponse | null
  isLoading: boolean
  error: string | null
  onBack: () => void
  onEpochClick: (epoch: number) => void
}

function formatLamports(lamports?: number): string {
  if (lamports == null) return '—'
  return (lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SOL'
}

function formatNumber(n?: number): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function formatPct(n?: number): string {
  if (n == null) return '—'
  return n.toFixed(2) + '%'
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d18]/40 px-4 py-3 text-center">
      <p className="text-[0.65rem] tracking-[2px] uppercase text-text-muted font-mono mb-1">{label}</p>
      <p className="text-[1rem] font-heading font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function EpochRow({ snapshot, onEpochClick }: { snapshot: ValidatorEpochSnapshot; onEpochClick: (epoch: number) => void }) {
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-300">
      <td className="px-4 py-2.5">
        <button
          onClick={() => onEpochClick(snapshot.epoch)}
          className="font-mono text-[0.82rem] text-accent-green/80 hover:text-accent-green transition-colors"
        >
          {snapshot.epoch}
        </button>
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-primary font-mono">{formatLamports(snapshot.activated_stake_lamports)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{snapshot.commission != null ? snapshot.commission + '%' : '—'}</td>
      <td className="px-4 py-2.5 text-[0.82rem]">
        {snapshot.is_delinquent
          ? <span className="text-red-400">Yes</span>
          : <span className="text-accent-green/70">No</span>
        }
      </td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary font-mono">{formatNumber(snapshot.epoch_credits)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{formatPct(snapshot.skip_rate)}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{snapshot.version ?? '—'}</td>
      <td className="px-4 py-2.5 text-[0.78rem] text-text-muted font-mono whitespace-nowrap">
        {snapshot.snapshotted_at ? new Date(snapshot.snapshotted_at).toLocaleDateString() : '—'}
      </td>
    </tr>
  )
}

export function ValidatorDetail({ data, isLoading, error, onBack, onEpochClick }: Props) {
  if (isLoading) return <Spinner message="Loading validator details..." />

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

  const v = data.current

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[0.75rem] tracking-[1px] uppercase font-mono text-text-muted hover:text-accent-green transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Blacklist
      </button>

      {/* Validator header */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6 space-y-4">
        <div className="flex items-center gap-4">
          {v?.image && (
            <img src={v.image} alt="" className="w-12 h-12 rounded-full border border-white/[0.1]" />
          )}
          <div className="min-w-0">
            <h2 className="text-[1.3rem] font-heading font-semibold text-text-primary truncate">
              {v?.name ?? 'Unknown Validator'}
            </h2>
            <div className="mt-1">
              <PubkeyCell pubkey={data.vote_identity} />
            </div>
          </div>
        </div>

        {v?.website && (
          <a
            href={v.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.78rem] text-accent-purple/80 hover:text-accent-purple transition-colors"
          >
            {v.website}
          </a>
        )}

        {/* Stats grid */}
        {v && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
            <StatCard label="Stake" value={formatLamports(v.activated_stake_lamports)} />
            <StatCard label="Commission" value={v.commission != null ? v.commission + '%' : '—'} />
            <StatCard label="Wiz Score" value={v.wiz_score?.toFixed(1) ?? '—'} />
            <StatCard label="APY" value={formatPct(v.apy_estimate)} />
            <StatCard label="Skip Rate" value={formatPct(v.skip_rate)} />
            <StatCard label="Uptime" value={formatPct(v.uptime)} />
            <StatCard label="Version" value={v.version ?? '—'} />
            <StatCard label="Country" value={v.ip_country ?? '—'} />
            <StatCard label="Delinquent" value={v.delinquent ? 'Yes' : 'No'} />
            <StatCard label="Last Vote" value={formatNumber(v.last_vote)} />
            <StatCard label="Root Slot" value={formatNumber(v.root_slot)} />
            <StatCard label="Epoch Credits" value={formatNumber(v.epoch_credits)} />
          </div>
        )}

        {v?.node_pubkey && (
          <div className="text-[0.75rem] text-text-muted font-mono mt-2">
            Node: {v.node_pubkey}
          </div>
        )}
      </div>

      {/* Epoch history */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <h3 className="text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
            Epoch History <span className="text-text-primary">({data.epochs.length})</span>
          </h3>
        </div>

        {data.epochs.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-muted text-[0.85rem]">
            No epoch snapshots available yet
          </div>
        ) : (
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#0d0d18]">
                <tr className="border-b border-white/[0.06]">
                  {['Epoch', 'Stake', 'Comm.', 'Delinq.', 'Credits', 'Skip Rate', 'Version', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-secondary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.epochs.map((s) => (
                  <EpochRow key={s.epoch} snapshot={s} onEpochClick={onEpochClick} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
