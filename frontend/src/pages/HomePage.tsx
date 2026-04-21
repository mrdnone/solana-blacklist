import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BlacklistEntry } from '../api/types'
import { BlacklistTable } from '../components/BlacklistTable'
import { ErrorBanner } from '../components/ErrorBanner'
import { PubkeyLookup } from '../components/PubkeyLookup'
import { SourceFilter } from '../components/SourceFilter'
import { StatsBar } from '../components/StatsBar'
import { TableSearch } from '../components/TableSearch'
import { useBlacklist } from '../hooks/useBlacklist'
import { usePubkeyLookup } from '../hooks/usePubkeyLookup'
import { useSources } from '../hooks/useSources'

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

export function HomePage() {
  const navigate = useNavigate()
  const { sourceNames: configSourceNames } = useSources()
  const { data, isLoading, error, fetchedAt, refetch } = useBlacklist()
  const pubkeyLookup = usePubkeyLookup()

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const name of configSourceNames) counts.set(name, 0)
    if (data?.entries) {
      for (const e of data.entries) {
        for (const s of e.sources) {
          counts.set(s.name, (counts.get(s.name) ?? 0) + 1)
        }
      }
    }
    return counts
  }, [configSourceNames, data?.entries])

  const sourceNames = useMemo(
    () => Array.from(sourceCounts.keys()).sort(),
    [sourceCounts],
  )

  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const isFirstLoad = isLoading && data === null

  const filteredEntries = useMemo(
    () => filterEntries(data?.entries ?? [], activeSource, deferredSearch),
    [data?.entries, activeSource, deferredSearch],
  )

  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10 space-y-7">
      <StatsBar
        uniquePubkeys={data?.unique_pubkeys ?? null}
        sourceCount={sourceNames.length > 0 ? sourceNames.length : (data?.sources ?? null)}
        fetchedAt={fetchedAt}
        isLoading={isLoading}
      />

      {error && !isFirstLoad && (
        <ErrorBanner message={error} onRetry={refetch} />
      )}

      {sourceNames.length > 0 && (
        <SourceFilter sources={sourceNames} counts={sourceCounts} active={activeSource} onChange={setActiveSource} />
      )}

      <PubkeyLookup
        onLookup={pubkeyLookup.lookup}
        onClear={pubkeyLookup.clear}
        isLoading={pubkeyLookup.isLoading}
        result={pubkeyLookup.result}
        error={pubkeyLookup.error}
        onViewValidator={(pubkey) => navigate(`/validators/${pubkey}`)}
      />

      {!isFirstLoad && (
        <TableSearch value={searchQuery} onChange={setSearchQuery} />
      )}

      {(isFirstLoad || data) && (
        <BlacklistTable
          entries={filteredEntries}
          isLoading={isLoading}
          isFirstLoad={isFirstLoad}
          totalCount={data?.unique_pubkeys ?? null}
          onValidatorClick={(pubkey) => navigate(`/validators/${pubkey}`)}
        />
      )}

      {error && isFirstLoad && (
        <ErrorBanner
          message={`Failed to load blacklist data: ${error}`}
          onRetry={refetch}
        />
      )}
    </main>
  )
}
