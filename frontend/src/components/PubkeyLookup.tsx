import { useState } from 'react'
import type { PubkeyLookupResult } from '../api/types'
import { truncatePubkey } from '../lib/truncate'
import { SourceBadge } from './SourceBadge'

interface Props {
  onLookup: (pubkey: string) => void
  onClear: () => void
  isLoading: boolean
  result: PubkeyLookupResult | null
  error: string | null
  onViewValidator?: (pubkey: string) => void
}

export function PubkeyLookup({ onLookup, onClear, isLoading, result, error, onViewValidator }: Props) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLookup(input)
  }

  return (
    <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6 transition-all duration-400 hover:border-white/[0.12] hover:shadow-[0_0_40px_rgba(20,241,149,0.06)]">
      <h2 className="text-[0.72rem] tracking-[3px] uppercase text-text-muted font-mono mb-4">Pubkey Lookup</h2>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (result || error) onClear()
          }}
          placeholder="Paste a vote account or identity pubkey..."
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-mono text-[0.82rem] text-text-primary placeholder-text-muted outline-none focus:border-accent-green/30 focus:shadow-[0_0_30px_rgba(20,241,149,0.06)] transition-all duration-300"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full border border-accent-green/25 px-6 py-2.5 text-[0.75rem] tracking-[3px] uppercase font-mono text-accent-green hover:bg-accent-green/10 hover:border-accent-green/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
        >
          {isLoading ? 'Checking...' : 'Check'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.04] px-4 py-3">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
          <p className="text-[0.82rem] text-text-secondary">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 space-y-4">

          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            {result.blacklisted ? (
              <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[0.72rem] tracking-[2px] uppercase font-mono text-rose-300">
                Blacklisted
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[0.72rem] tracking-[2px] uppercase font-mono text-emerald-300">
                Clean
              </span>
            )}
            {result.name && (
              <span className="text-[0.85rem] text-text-primary font-medium">{result.name}</span>
            )}
            {result.first_seen && (
              <span className="text-[0.68rem] font-mono text-text-muted ml-auto">First seen: {result.first_seen}</span>
            )}
          </div>

          {/* Pubkey fields */}
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.78rem]">
            <span className="font-mono text-text-muted">Vote account</span>
            <code className="font-mono text-text-secondary truncate" title={result.pubkey}>
              {truncatePubkey(result.pubkey, 8)}
            </code>
            {result.identity && (
              <>
                <span className="font-mono text-text-muted">Identity</span>
                <code className="font-mono text-text-secondary truncate" title={result.identity}>
                  {truncatePubkey(result.identity, 8)}
                </code>
              </>
            )}
          </div>

          {/* Sources + reasons (blacklisted) */}
          {result.blacklisted && result.sources.length > 0 && (
            <div className="space-y-2">
              <p className="text-[0.72rem] tracking-[2px] uppercase font-mono text-text-muted">Sources</p>
              {result.sources.map((s) => (
                <div key={s.name} className="flex flex-col items-start gap-1">
                  <SourceBadge name={s.name} size="sm" />
                  {s.reason ? (
                    <span className="text-[0.78rem] text-text-secondary leading-snug pl-1">{s.reason}</span>
                  ) : (
                    <span className="text-[0.72rem] text-text-muted italic leading-snug pl-1">no reason provided</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          {onViewValidator && (
            <div className="pt-1">
              <button
                onClick={() => onViewValidator(result.pubkey)}
                className="rounded-full border border-accent-green/25 px-4 py-1.5 text-[0.72rem] tracking-[2px] uppercase font-mono text-accent-green hover:bg-accent-green/10 hover:border-accent-green/40 transition-all duration-300 whitespace-nowrap"
              >
                View Validator Details &rarr;
              </button>
            </div>
          )}

          {/* Clean but unknown */}
          {!result.blacklisted && !result.in_validators_db && (
            <p className="text-[0.78rem] text-text-muted">
              This address was not found in any blacklist source.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
