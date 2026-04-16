import { useDeferredValue, useMemo, useState } from 'react'
import type { BlacklistEntry } from './api/types'
import { BlacklistTable } from './components/BlacklistTable'
import { ErrorBanner } from './components/ErrorBanner'
import { Header } from './components/Header'
import { PubkeyLookup } from './components/PubkeyLookup'
import { SourceFilter } from './components/SourceFilter'
import { Stars } from './components/Stars'
import { StatsBar } from './components/StatsBar'
import { SuggestSource } from './components/SuggestSource'
import { TableSearch } from './components/TableSearch'
import { useBlacklist } from './hooks/useBlacklist'
import { usePubkeyLookup } from './hooks/usePubkeyLookup'
import { useSources } from './hooks/useSources'

function filterEntries(
  entries: BlacklistEntry[],
  activeSource: string | null,
  searchQuery: string,
): BlacklistEntry[] {
  let result = entries

  if (activeSource) {
    result = result.filter((e) => e.sources.some((s) => s.name === activeSource))
  }

  const q = searchQuery.trim().toLowerCase()
  if (q) {
    result = result.filter(
      (e) =>
        e.pubkey.toLowerCase().includes(q) ||
        e.name?.toLowerCase().includes(q) ||
        e.sources.some(
          (s) => s.name.toLowerCase().includes(q) || s.reason?.toLowerCase().includes(q),
        ),
    )
  }

  return result
}

type Page = 'home' | 'suggest-source'

export default function App() {
  const { sourceNames } = useSources()
  const { data, isLoading, error, fetchedAt, refetch } = useBlacklist()
  const pubkeyLookup = usePubkeyLookup()

  const [page, setPage] = useState<Page>('home')
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const isFirstLoad = isLoading && data === null

  const filteredEntries = useMemo(
    () => filterEntries(data?.entries ?? [], activeSource, deferredSearch),
    [data?.entries, activeSource, deferredSearch],
  )

  return (
    <div className="relative min-h-screen">
      <Stars />

      <div className="relative z-10">
        <Header onSuggestSource={() => setPage('suggest-source')} />

        {page === 'suggest-source' ? (
          <SuggestSource onBack={() => setPage('home')} />
        ) : (
          <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10 space-y-7">
            {/* Stats */}
            <StatsBar
              uniquePubkeys={data?.unique_pubkeys ?? null}
              sourceCount={data?.sources ?? null}
              fetchedAt={fetchedAt}
              isLoading={isLoading}
            />

            {/* Error */}
            {error && !isFirstLoad && (
              <ErrorBanner message={error} onRetry={refetch} />
            )}

            {/* Source filter */}
            {sourceNames.length > 0 && (
              <SourceFilter sources={sourceNames} active={activeSource} onChange={setActiveSource} />
            )}

            {/* Pubkey lookup */}
            <PubkeyLookup
              onLookup={pubkeyLookup.lookup}
              onClear={pubkeyLookup.clear}
              isLoading={pubkeyLookup.isLoading}
              result={pubkeyLookup.result}
              error={pubkeyLookup.error}
            />

            {/* Search + Table */}
            {!isFirstLoad && (
              <TableSearch value={searchQuery} onChange={setSearchQuery} />
            )}

            {(isFirstLoad || data) && (
              <BlacklistTable
                entries={filteredEntries}
                isLoading={isLoading}
                isFirstLoad={isFirstLoad}
                totalCount={data?.unique_pubkeys ?? null}
              />
            )}

            {/* First load error */}
            {error && isFirstLoad && (
              <ErrorBanner
                message={`Failed to load blacklist data: ${error}`}
                onRetry={refetch}
              />
            )}
          </main>
        )}

        {/* Footer */}
        <footer className="border-t border-white/[0.04] py-8 mt-10">
          <p className="text-center text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
            Solana Blacklist Explorer
          </p>
        </footer>
      </div>
    </div>
  )
}
