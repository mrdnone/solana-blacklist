import { useMemo, useState } from 'react'
import { clsx } from 'clsx'

const COLLAPSE_THRESHOLD = 5

interface Props {
  sources: string[]
  counts?: Map<string, number>
  active: string | null
  onChange: (source: string | null) => void
}

export function SourceFilter({ sources, counts, active, onChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  // Auto-expand if active filter is beyond threshold
  const activeIndex = active ? sources.indexOf(active) : -1
  const shouldExpand = expanded || (activeIndex >= COLLAPSE_THRESHOLD)

  const needsCollapse = sources.length > COLLAPSE_THRESHOLD
  const showSearch = shouldExpand && sources.length > 10

  // Filter sources by search when expanded
  const filteredSources = useMemo(() => {
    if (!shouldExpand) return sources.slice(0, COLLAPSE_THRESHOLD)
    if (!search.trim()) return sources
    const q = search.trim().toLowerCase()
    return sources.filter((name) => name.toLowerCase().includes(q))
  }, [sources, shouldExpand, search])

  const hiddenCount = sources.length - COLLAPSE_THRESHOLD

  const renderPill = (name: string) => {
    const isActive = active === name
    const count = counts?.get(name) ?? 0
    const isEmpty = count === 0
    return (
      <button
        key={name}
        onClick={() => onChange(isActive ? null : name)}
        className={clsx(
          'rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border transition-all duration-300',
          isActive
            ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/25'
            : isEmpty
              ? 'bg-transparent text-text-muted/40 border-white/[0.04] hover:text-text-muted hover:border-white/[0.08]'
              : 'bg-transparent text-text-muted border-white/[0.06] hover:text-text-primary hover:border-white/[0.15]',
        )}
      >
        {name}
        {counts && (
          <span className={clsx(
            'ml-1.5 text-[0.65rem]',
            isActive ? 'text-accent-purple/60' : 'text-text-muted/50',
          )}>
            ({count})
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* Search bar (only when expanded with many sources) */}
      {showSearch && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter sources..."
          className="w-full max-w-[260px] rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[0.75rem] text-text-primary placeholder-text-muted outline-none focus:border-accent-green/30 focus:shadow-[0_0_30px_rgba(20,241,149,0.06)] transition-all duration-300"
        />
      )}

      {/* Pills container — scrollable when expanded */}
      <div className={clsx(
        'flex flex-wrap gap-2',
        shouldExpand && sources.length > 10 && 'max-h-[200px] overflow-y-auto pr-1',
      )}>
        <button
          onClick={() => onChange(null)}
          className={clsx(
            'rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border transition-all duration-300',
            active === null
              ? 'bg-accent-green/10 text-accent-green border-accent-green/25'
              : 'bg-transparent text-text-muted border-white/[0.06] hover:text-text-primary hover:border-white/[0.15]',
          )}
        >
          All
        </button>

        {filteredSources.map(renderPill)}

        {needsCollapse && !shouldExpand && (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border border-white/[0.06] text-text-muted hover:text-text-primary hover:border-white/[0.15] transition-all duration-300"
          >
            +{hiddenCount} more
          </button>
        )}
      </div>

      {/* Show less button — outside scroll container */}
      {needsCollapse && shouldExpand && expanded && (
        <button
          onClick={() => { setExpanded(false); setSearch('') }}
          className="rounded-full px-5 py-2 text-[0.8rem] font-mono tracking-[0.5px] border border-white/[0.06] text-text-muted hover:text-text-primary hover:border-white/[0.15] transition-all duration-300"
        >
          Show less
        </button>
      )}
    </div>
  )
}
