import { useState } from 'react'
import type { PubkeyLookupResult } from '../api/types'
import { truncatePubkey } from '../lib/truncate'
import { SourceBadge } from './SourceBadge'
import { AppealLinks } from './AppealLinks'
import { useSources } from '../hooks/useSources'

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
  const { data: sourcesData } = useSources()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLookup(input)
  }

  return (
    <div className="card-glow mrdn-panel px-7 py-[26px] transition-colors duration-400 hover:border-[#ff8a4c]/[0.55]">
      <h2 className="mrdn-label uppercase font-mono">Pubkey Lookup</h2>
      <form onSubmit={handleSubmit} className="flex gap-3 mt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (result || error) onClear()
          }}
          placeholder="Paste a vote account or identity pubkey..."
          className="flex-1 min-w-0 rounded-[2px] px-[15px] py-[13px] font-mono text-[13.5px] text-text-primary outline-none transition-all duration-300"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="mrdn-cta shrink-0 px-[30px] py-[14px] text-[12.5px] uppercase disabled:cursor-not-allowed"
        >
          {isLoading ? 'Checking...' : 'Check'}
        </button>
      </form>

      {error && (
        <div className="mt-4 flex items-center gap-3 mrdn-status-flagged px-4 py-3">
          <span className="mrdn-node mrdn-node--ember" />
          <p className="text-[0.82rem] text-text-secondary">{error}</p>
        </div>
      )}

      {result && (
        <div className={`mt-5 px-6 py-[22px] ${result.blacklisted ? 'mrdn-status-flagged' : 'mrdn-status-clean'}`}>

          <div className="flex items-center gap-3.5 flex-wrap">
            {result.blacklisted ? (
              <span className="inline-flex items-center gap-2 text-[11px] tracking-[2px] uppercase font-mono text-ember">
                <span className="mrdn-node mrdn-node--ember animate-pulse-glow w-2! h-2!" />
                Blacklisted
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-[11px] tracking-[2px] uppercase font-mono text-white">
                <span className="mrdn-node w-2! h-2!" />
                Clean
              </span>
            )}
            {result.name && (
              <span className="text-[14px] text-text-primary">{result.name}</span>
            )}
            {result.first_seen && (
              <span className="ml-auto text-[11px] font-mono text-[#dfe6f5]/[0.68]">First seen: {result.first_seen}</span>
            )}
          </div>

          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-[18px] gap-y-[7px] mt-5 text-[12.5px]">
            <span className="text-[10px] tracking-[2px] uppercase font-mono text-[#dfe6f5]/[0.68] pt-0.5">Vote account</span>
            <code className="font-mono text-[#dfe6f5]/[0.94] truncate" title={result.pubkey}>
              {truncatePubkey(result.pubkey, 8)}
            </code>
            {result.identity && (
              <>
                <span className="text-[10px] tracking-[2px] uppercase font-mono text-[#dfe6f5]/[0.68] pt-0.5">Identity</span>
                <code className="font-mono text-[#dfe6f5]/[0.94] truncate" title={result.identity}>
                  {truncatePubkey(result.identity, 8)}
                </code>
              </>
            )}
          </div>

          {result.blacklisted && result.sources.length > 0 && (
            <div className="mt-5 pt-[18px] border-t border-[#ff8a4c]/[0.4] flex flex-col gap-4">
              <p className="text-[10px] tracking-[2px] uppercase font-mono text-[#dfe6f5]/[0.68]">Sources</p>
              {result.sources.map((s) => (
                <div key={s.name}>
                  <SourceBadge name={s.name} size="sm" />
                  {s.reason ? (
                    <div className="mt-2 text-[13px] leading-[1.7] text-[#dfe6f5]/[0.86]">{s.reason}</div>
                  ) : (
                    <div className="mt-2 text-[13px] leading-[1.7] text-[#dfe6f5]/[0.68] italic">no reason provided</div>
                  )}
                  <div className="mt-2">
                    <AppealLinks contactInfo={sourcesData?.[s.name]?.contact_info} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result.blacklisted && !result.in_validators_db && (
            <p className="mt-5 pt-[18px] border-t border-white/[0.3] text-[13px] leading-[1.7] text-[#dfe6f5]/[0.82]">
              This address was not found in any blacklist source.
            </p>
          )}

          {onViewValidator && (
            <button
              onClick={() => onViewValidator(result.pubkey)}
              className="mrdn-btn mt-[22px] uppercase whitespace-nowrap"
            >
              View Validator Details &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
