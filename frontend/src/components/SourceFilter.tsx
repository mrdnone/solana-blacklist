import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { getSourceColors } from '../lib/sourceColors'

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

  const activeIndex = active ? sources.indexOf(active) : -1
  const shouldExpand = expanded || (activeIndex >= COLLAPSE_THRESHOLD)

  const needsCollapse = sources.length > COLLAPSE_THRESHOLD
  const showSearch = shouldExpand && sources.length > 10

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
        className={clsx('mrdn-filter', isActive && 'mrdn-filter--active', isEmpty && !isActive && 'opacity-70')}
      >
        <span className="mrdn-dot" style={{ background: getSourceColors(name).dot }} />
        {name}
        {counts && <span className="mrdn-filter__count">({count})</span>}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {showSearch && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter sources..."
          className="w-full max-w-[260px] rounded-[2px] border border-white/[0.55] bg-white/[0.07] px-3 py-1.5 font-mono text-[0.75rem] text-text-primary placeholder-text-muted outline-none focus:border-white/[0.85] focus:shadow-none transition-all duration-300"
        />
      )}

      <div className={clsx(
        'flex flex-wrap items-center gap-[9px]',
        shouldExpand && sources.length > 10 && 'max-h-[200px] overflow-y-auto pr-1',
      )}>
        <button
          onClick={() => onChange(null)}
          className={clsx('mrdn-filter', active === null && 'mrdn-filter--active')}
        >
          All
        </button>

        {filteredSources.map(renderPill)}

        {needsCollapse && !shouldExpand && (
          <button onClick={() => setExpanded(true)} className="mrdn-filter">
            +{hiddenCount} more
          </button>
        )}
      </div>

      {needsCollapse && shouldExpand && expanded && (
        <button
          onClick={() => { setExpanded(false); setSearch('') }}
          className="mrdn-filter"
        >
          Show less
        </button>
      )}
    </div>
  )
}
