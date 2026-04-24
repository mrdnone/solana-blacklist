import { useSources } from '../hooks/useSources'
import { SourceBadge } from './SourceBadge'
import { Spinner } from './Spinner'

interface Props {
  onBack: () => void
  onSuggestSource: () => void
}

export function SourcesPage({ onBack, onSuggestSource }: Props) {
  const { data: sourcesMap, isLoading } = useSources()

  // Convert the Record<string, SourceConfig> into an array, meridian last
  const sources = Object.values(sourcesMap ?? {}).sort((a, b) => {
    if (a.name === 'meridian') return 1
    if (b.name === 'meridian') return -1
    return String(a.name).localeCompare(String(b.name))
  })

  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[0.78rem] tracking-[2px] uppercase text-text-muted hover:text-accent-green transition-colors duration-300 font-mono mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-[1.8rem] sm:text-[2.2rem] font-semibold tracking-[4px] uppercase bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent">
            Blacklist Sources
          </h2>
          <p className="mt-2 text-[0.85rem] text-text-secondary">
            Data is aggregated from {sources.length} independent sources and deduplicated.
          </p>
        </div>
        <button
          onClick={onSuggestSource}
          className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-purple/20 bg-accent-purple/[0.06] rounded-full px-5 py-2.5 text-accent-purple/80 hover:text-accent-purple hover:border-accent-purple/40 hover:bg-accent-purple/10 transition-all duration-300 whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Suggest Source
        </button>
      </div>

      {isLoading ? (
        <Spinner message="Loading sources..." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {sources.map((s) => {
            const name = String(s.name ?? '')
            const isMeridian = name === 'meridian'
            const contact = s.contact_info as Record<string, string> | null | undefined
            const handler = s.handler
            const handlerLabel = handler === 'Json' || handler === 'json'
              ? 'JSON API'
              : typeof handler === 'object' && handler !== null && 'Csv' in (handler as object)
              ? 'CSV'
              : String(handler ?? '—')

            return (
              <div
                key={name}
                className="card-glow rounded-2xl border border-white/[0.06] bg-[#17181e] p-6 space-y-4 transition-all duration-400 hover:border-white/[0.12]"
              >
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <SourceBadge name={name} size="md" />
                  {isMeridian ? (
                    <span className="ml-auto text-[0.68rem] font-mono text-amber-400/70 border border-amber-400/20 bg-amber-400/[0.06] rounded-full px-2.5 py-0.5">
                      self-hosted
                    </span>
                  ) : (
                    <span className="ml-auto text-[0.68rem] font-mono text-text-muted border border-white/[0.06] rounded-full px-2.5 py-0.5">
                      {handlerLabel}
                    </span>
                  )}
                </div>

                {/* URL — hidden for meridian */}
                {!isMeridian && (
                  <div className="space-y-1">
                    <p className="text-[0.65rem] tracking-[2px] uppercase font-mono text-text-muted">Data Source</p>
                    <a
                      href={String(s.url ?? '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-mono text-[0.72rem] text-accent-green/60 hover:text-accent-green/90 truncate transition-colors duration-200"
                      title={String(s.url ?? '')}
                    >
                      {String(s.url ?? '')}
                    </a>
                  </div>
                )}

                {/* Contact links */}
                {contact && Object.keys(contact).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[0.65rem] tracking-[2px] uppercase font-mono text-text-muted">Contact</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(contact).map(([type, url]) => (
                        <a
                          key={type}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[0.68rem] font-mono tracking-wide border border-white/[0.06] rounded-full px-2.5 py-0.5 text-text-secondary hover:text-text-primary hover:border-white/[0.12] transition-all duration-200 capitalize"
                        >
                          <ContactIcon type={type} />
                          {type}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

function ContactIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case 'website':
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
        </svg>
      )
    case 'telegram':
      return (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 1 0 24 12.056A12.01 12.01 0 0 0 11.944 0Zm5.573 7.26l-1.97 9.29c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.538-.196 1.006.128.832.932Z"/>
        </svg>
      )
    case 'discord':
      return (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
      )
    default:
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
  }
}
