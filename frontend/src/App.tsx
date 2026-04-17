import { useDeferredValue, useMemo, useState } from 'react'
import type { BlacklistEntry } from './api/types'
import { BlacklistTable } from './components/BlacklistTable'
import { EpochDetail } from './components/EpochDetail'
import { EpochList } from './components/EpochList'
import { ErrorBanner } from './components/ErrorBanner'
import { Header } from './components/Header'
import { PubkeyLookup } from './components/PubkeyLookup'
import { SourceFilter } from './components/SourceFilter'
import { Stars } from './components/Stars'
import { StatsBar } from './components/StatsBar'
import { MeridianVoting } from './components/MeridianVoting'
import { SuggestSource } from './components/SuggestSource'
import { TableSearch } from './components/TableSearch'
import { ValidatorDetail } from './components/ValidatorDetail'
import { ValidatorsList } from './components/ValidatorsList'
import { useBlacklist } from './hooks/useBlacklist'
import { useEpochs } from './hooks/useEpochs'
import { usePubkeyLookup } from './hooks/usePubkeyLookup'
import { useSources } from './hooks/useSources'
import { useValidatorDetail } from './hooks/useValidatorDetail'

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

type Page =
  | { kind: 'home' }
  | { kind: 'suggest-source' }
  | { kind: 'meridian' }
  | { kind: 'validator'; pubkey: string }
  | { kind: 'validators' }
  | { kind: 'epochs' }
  | { kind: 'epoch-detail'; epoch: number }

export default function App() {
  const { sourceNames: configSourceNames } = useSources()
  const { data, isLoading, error, fetchedAt, refetch } = useBlacklist()
  const pubkeyLookup = usePubkeyLookup()

  // Build a map of source name → entry count, merging config + data-derived sources
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    // Seed with config sources (all start at 0)
    for (const name of configSourceNames) counts.set(name, 0)
    // Count from actual data
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

  const [page, setPage] = useState<Page>({ kind: 'home' })
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const isFirstLoad = isLoading && data === null

  const filteredEntries = useMemo(
    () => filterEntries(data?.entries ?? [], activeSource, deferredSearch),
    [data?.entries, activeSource, deferredSearch],
  )

  // Validator detail hook
  const validatorPubkey = page.kind === 'validator' ? page.pubkey : null
  const validatorDetail = useValidatorDetail(validatorPubkey)

  // Epochs hook
  const epochs = useEpochs()

  const navigateToValidator = (pubkey: string) => setPage({ kind: 'validator', pubkey })
  const navigateToValidators = () => setPage({ kind: 'validators' })
  const navigateToMeridian = () => setPage({ kind: 'meridian' })
  const navigateToEpochs = () => setPage({ kind: 'epochs' })
  const navigateToEpochDetail = (epoch: number) => setPage({ kind: 'epoch-detail', epoch })
  const navigateHome = () => setPage({ kind: 'home' })

  const renderPage = () => {
    switch (page.kind) {
      case 'suggest-source':
        return <SuggestSource onBack={navigateHome} />

      case 'meridian':
        return <MeridianVoting onBack={navigateHome} />

      case 'validator':
        return (
          <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
            <ValidatorDetail
              data={validatorDetail.data}
              isLoading={validatorDetail.isLoading}
              error={validatorDetail.error}
              onBack={navigateHome}
              onEpochClick={navigateToEpochDetail}
            />
          </main>
        )

      case 'validators':
        return (
          <ValidatorsList
            onBack={navigateHome}
            onValidatorClick={navigateToValidator}
          />
        )

      case 'epochs':
        return (
          <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
            <EpochList
              data={epochs.data}
              isLoading={epochs.isLoading}
              error={epochs.error}
              onBack={navigateHome}
              onEpochClick={navigateToEpochDetail}
            />
          </main>
        )

      case 'epoch-detail':
        return (
          <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
            <EpochDetail
              epoch={page.epoch}
              onBack={navigateToEpochs}
              onValidatorClick={navigateToValidator}
            />
          </main>
        )

      case 'home':
      default:
        return (
          <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10 space-y-7">
            {/* Stats */}
            <StatsBar
              uniquePubkeys={data?.unique_pubkeys ?? null}
              sourceCount={sourceNames.length > 0 ? sourceNames.length : (data?.sources ?? null)}
              fetchedAt={fetchedAt}
              isLoading={isLoading}
            />

            {/* Error */}
            {error && !isFirstLoad && (
              <ErrorBanner message={error} onRetry={refetch} />
            )}

            {/* Source filter */}
            {sourceNames.length > 0 && (
              <SourceFilter sources={sourceNames} counts={sourceCounts} active={activeSource} onChange={setActiveSource} />
            )}

            {/* Pubkey lookup */}
            <PubkeyLookup
              onLookup={pubkeyLookup.lookup}
              onClear={pubkeyLookup.clear}
              isLoading={pubkeyLookup.isLoading}
              result={pubkeyLookup.result}
              error={pubkeyLookup.error}
              onViewValidator={navigateToValidator}
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
                onValidatorClick={navigateToValidator}
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
        )
    }
  }

  return (
    <div className="relative min-h-screen">
      <Stars />

      <div className="relative z-10">
        <Header
          onSuggestSource={() => setPage({ kind: 'suggest-source' })}
          onEpochs={navigateToEpochs}
          onValidators={navigateToValidators}
          onMeridian={navigateToMeridian}
        />

        {renderPage()}

        {/* Footer */}
        <footer className="border-t border-white/[0.04] py-8 mt-10 space-y-4">
          <div className="flex justify-center items-center gap-5">
            <a
              href="https://t.me/mrdnone"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent-green transition-colors duration-300"
              title="Telegram"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 1 0 24 12.056A12.01 12.01 0 0 0 11.944 0Zm5.573 7.26l-1.97 9.29c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.538-.196 1.006.128.832.932Z"/>
              </svg>
            </a>
            <a
              href="https://discord.com/users/onlineonline11_21910"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent-purple transition-colors duration-300"
              title="Discord"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            <a
              href="mailto:Blacklistmrndone@gmail.com"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              title="Email"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </a>
            <a
              href="https://github.com/mrdnone/solana-blacklist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              title="GitHub"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </a>
          </div>
          <p className="text-center text-[0.72rem] tracking-[2px] uppercase text-text-secondary font-mono">
            Solana Blacklist Explorer
          </p>
        </footer>
      </div>
    </div>
  )
}
