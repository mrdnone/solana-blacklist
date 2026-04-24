import { useNavigate } from 'react-router-dom'
import type { ValidatorDetailResponse, SourcesResponse } from '../api/types'
import { useVoteDetail } from '../hooks/useVoteDetail'
import { useSources } from '../hooks/useSources'
import { lookupPubkey } from '../api/endpoints'
import { useEffect, useState } from 'react'
import type { PubkeyLookupResult } from '../api/types'
import { PubkeyCell } from './PubkeyCell'
import { SourceBadge } from './SourceBadge'
import { AppealLinks } from './AppealLinks'
import { Spinner } from './Spinner'

interface Props {
  data: ValidatorDetailResponse | null
  isLoading: boolean
  error: string | null
  onBack: () => void
  onEpochClick: (epoch: number) => void
  onVote?: (voteIdentity: string) => void
}

// ── External links ────────────────────────────────────────────────────────────

function ExternalLinks({ voteIdentity, identity }: { voteIdentity: string; identity?: string }) {
  const id = identity ?? voteIdentity
  const links = [
    {
      label: 'Stakewiz',
      href: `https://stakewiz.com/validator/${voteIdentity}`,
      icon: '⚡',
    },
    {
      label: 'validator.info',
      href: `https://validator.info/solana/${id}`,
      icon: '🔍',
    },
    {
      label: 'Solana Beach',
      href: `https://solanabeach.io/validator/${id}`,
      icon: '🏖',
    },
    {
      label: 'Solscan',
      href: `https://solscan.io/account/${voteIdentity}`,
      icon: '🔬',
    },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.72rem] tracking-[1px] font-mono border border-white/[0.08] rounded-lg px-3 py-1.5 text-text-secondary hover:text-text-primary hover:border-white/[0.2] transition-all duration-200"
        >
          <span>{l.icon}</span>
          {l.label}
        </a>
      ))}
    </div>
  )
}

// ── Blacklist status card ─────────────────────────────────────────────────────

function BlacklistStatus({ lookup, sourcesData }: { lookup: PubkeyLookupResult | null; sourcesData: SourcesResponse | null }) {
  if (!lookup) return null

  if (!lookup.blacklisted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent-green/20 bg-accent-green/[0.05] px-5 py-4">
        <div className="w-2.5 h-2.5 rounded-full bg-accent-green shrink-0" />
        <span className="text-[0.85rem] text-accent-green font-mono tracking-wide">Not blacklisted</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0 animate-pulse" />
        <span className="text-[0.85rem] text-rose-400 font-mono tracking-wide">Blacklisted</span>
      </div>
      <div className="flex flex-col gap-2">
        {lookup.sources.map((s, i) => (
          <div key={`${s.name}-${i}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge name={s.name} size="md" />
              {s.reason && (
                <span className="text-[0.78rem] text-text-secondary leading-snug">{s.reason}</span>
              )}
            </div>
            <AppealLinks contactInfo={sourcesData?.[s.name]?.contact_info} />
          </div>
        ))}
      </div>
      {lookup.first_seen && (
        <p className="text-[0.72rem] text-text-muted font-mono">First seen: {lookup.first_seen}</p>
      )}
    </div>
  )
}

// ── Meridian vote summary ────────────────────────────────────────────────────

function MeridianVotes({
  voteIdentity,
  onVote,
  onVotePageClick,
}: {
  voteIdentity: string
  onVote?: (v: string) => void
  onVotePageClick: () => void
}) {
  const { data } = useVoteDetail(voteIdentity)
  if (!data) return null

  const pct = Math.min(100, Math.round((data.vote_count / data.threshold) * 100))

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#17181e]/60 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] tracking-[2px] uppercase text-text-muted font-mono mb-0.5">
            Community Blacklist Reports
          </p>
          <p className="text-[0.9rem] font-mono text-text-primary">
            <span className={data.vote_count >= data.threshold ? 'text-rose-400' : 'text-amber-400'}>
              {data.vote_count}
            </span>
            <span className="text-text-muted"> / {data.threshold}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onVotePageClick}
            className="text-[0.72rem] tracking-[1px] uppercase font-mono border border-white/[0.08] rounded-lg px-3 py-1.5 text-text-secondary hover:text-text-primary hover:border-white/[0.2] transition-all duration-200"
          >
            View reports
          </button>
          {onVote && (
            <button
              onClick={() => onVote(voteIdentity)}
              className="text-[0.72rem] tracking-[2px] uppercase font-mono border border-amber-500/20 bg-amber-500/[0.06] rounded-lg px-3 py-1.5 text-amber-400/80 hover:text-amber-400 hover:border-amber-500/40 transition-all duration-200"
            >
              🚩 Report
            </button>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${data.vote_count >= data.threshold ? 'bg-rose-500' : 'bg-amber-500/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {data.votes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.votes.slice(0, 5).map((v) => (
            <span key={v.voter_identity} className="text-[0.65rem] font-mono text-text-muted border border-white/[0.06] rounded px-1.5 py-0.5" title={v.voter_identity}>
              {v.voter_identity.slice(0, 6)}…
            </span>
          ))}
          {data.votes.length > 5 && (
            <span className="text-[0.65rem] font-mono text-text-muted">+{data.votes.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Epoch calendar ────────────────────────────────────────────────────────────

function EpochCalendar({
  epochs,
  onEpochClick,
}: {
  epochs: ValidatorDetailResponse['epochs']
  onEpochClick: (epoch: number) => void
}) {
  if (epochs.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-text-muted text-[0.85rem]">
        No epoch snapshots available yet
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-5">
      {[...epochs].reverse().map((s) => {
        const isBlacklisted = s.is_blacklisted
        return (
          <button
            key={s.epoch}
            onClick={() => onEpochClick(s.epoch)}
            title={
              isBlacklisted
                ? `Epoch ${s.epoch} — blacklisted (${s.blacklist_sources?.map((x) => x.name).join(', ')})`
                : `Epoch ${s.epoch} — clean`
            }
            className={[
              'inline-flex items-center justify-center rounded-lg font-mono text-[0.72rem] transition-all duration-200 w-[52px] h-[36px]',
              isBlacklisted
                ? 'border border-rose-500/40 bg-rose-500/[0.12] text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60'
                : 'border border-accent-green/20 bg-accent-green/[0.05] text-accent-green/70 hover:bg-accent-green/[0.1] hover:text-accent-green hover:border-accent-green/40',
            ].join(' ')}
          >
            {s.epoch}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ValidatorDetail({ data, isLoading, error, onBack, onEpochClick, onVote }: Props) {
  const navigate = useNavigate()
  const [lookup, setLookup] = useState<PubkeyLookupResult | null>(null)
  const { data: sourcesData } = useSources()

  useEffect(() => {
    if (!data?.vote_identity) return
    lookupPubkey(data.vote_identity)
      .then(setLookup)
      .catch(() => setLookup(null))
  }, [data?.vote_identity])

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
  const isBlacklisted = lookup?.blacklisted ?? false

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[0.75rem] tracking-[1px] uppercase font-mono text-text-muted hover:text-accent-green transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      {/* Header card */}
      <div className={[
        'card-glow rounded-2xl border bg-[#17181e] p-6 space-y-5',
        isBlacklisted ? 'border-rose-500/20' : 'border-white/[0.06]',
      ].join(' ')}>
        {/* Avatar + name + addresses */}
        <div className="flex items-start gap-4">
          {v?.image ? (
            <img src={v.image} alt="" className="w-14 h-14 rounded-full border border-white/[0.1] shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full border border-white/[0.08] bg-white/[0.04] shrink-0 flex items-center justify-center text-text-muted text-[1.4rem]">
              ◈
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-[1.3rem] font-heading font-semibold text-text-primary truncate">
              {v?.name && v.name !== '-' ? v.name : 'Unknown Validator'}
            </h2>
            <div className="grid grid-cols-[72px_1fr] gap-x-4 gap-y-1.5 items-center">
              <span className="text-[0.65rem] tracking-[2px] uppercase text-text-muted font-mono">Vote</span>
              <PubkeyCell pubkey={data.vote_identity} variant={isBlacklisted ? 'red' : 'green'} />
              {v?.node_pubkey && (
                <>
                  <span className="text-[0.65rem] tracking-[2px] uppercase text-text-muted font-mono">Identity</span>
                  <PubkeyCell pubkey={v.node_pubkey} variant={isBlacklisted ? 'red' : 'green'} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* External links */}
        <ExternalLinks voteIdentity={data.vote_identity} identity={v?.node_pubkey} />

        {/* Website */}
        {v?.website && (
          <a
            href={v.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[0.78rem] text-accent-purple/80 hover:text-accent-purple transition-colors truncate max-w-full"
          >
            {v.website}
          </a>
        )}
      </div>

      {/* Two-column: blacklist status + meridian votes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BlacklistStatus lookup={lookup} sourcesData={sourcesData} />
        <MeridianVotes
          voteIdentity={data.vote_identity}
          onVote={onVote}
          onVotePageClick={() => navigate(`/vote/${data.vote_identity}`)}
        />
      </div>

      {/* Epoch blacklist calendar */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#17181e]">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <h3 className="text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
            Epoch History
          </h3>
          <span className="text-[0.72rem] font-mono text-text-muted">
            {data.epochs.filter((e) => e.is_blacklisted).length} blacklisted
            {' / '}
            {data.epochs.length} epochs
          </span>
        </div>
        <EpochCalendar epochs={data.epochs} onEpochClick={onEpochClick} />
      </div>
    </div>
  )
}
