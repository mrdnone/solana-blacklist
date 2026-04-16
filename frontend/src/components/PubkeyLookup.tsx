import { useState } from 'react'
import type { PubkeyLookupResult } from '../api/types'
import { SourceBadge } from './SourceBadge'

interface Props {
  onLookup: (pubkey: string) => void
  onClear: () => void
  isLoading: boolean
  result: PubkeyLookupResult | null
  error: string | null
}

export function PubkeyLookup({ onLookup, onClear, isLoading, result, error }: Props) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLookup(input)
  }

  const handleClear = () => {
    setInput('')
    onClear()
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
          placeholder="Paste a validator vote account pubkey..."
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-mono text-[0.82rem] text-text-primary placeholder-text-muted outline-none focus:border-accent-green/30 focus:shadow-[0_0_30px_rgba(20,241,149,0.06)] transition-all duration-300"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full border border-accent-green/25 px-6 py-2.5 text-[0.75rem] tracking-[3px] uppercase font-mono text-accent-green hover:bg-accent-green/10 hover:border-accent-green/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
        >
          {isLoading ? 'Checking...' : 'Check'}
        </button>
        {(result || error) && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-white/[0.08] px-5 py-2.5 text-[0.75rem] tracking-[2px] uppercase font-mono text-text-muted hover:text-text-primary hover:border-white/[0.15] transition-all duration-300"
          >
            Clear
          </button>
        )}
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
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-3">
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
            <code className="font-mono text-[0.72rem] text-text-secondary truncate">{result.pubkey}</code>
            {result.first_seen && (
              <span className="text-[0.68rem] font-mono text-text-muted ml-auto">First seen: {result.first_seen}</span>
            )}
          </div>

          {result.blacklisted && result.sources.length > 0 && (
            <div className="mt-4 space-y-2">
              {result.sources.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <SourceBadge name={s.name} size="sm" />
                  {s.reason && <span className="text-[0.78rem] text-text-secondary">{s.reason}</span>}
                </div>
              ))}
            </div>
          )}

          {!result.blacklisted && (
            <p className="mt-3 text-[0.78rem] text-text-muted">
              This address was not found in any blacklist source.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
