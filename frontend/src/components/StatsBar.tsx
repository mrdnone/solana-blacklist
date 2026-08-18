interface Props {
  uniquePubkeys: number | null
  sourceCount: number | null
  fetchedAt: Date | null
  isLoading: boolean
}

function StatTile({
  label,
  value,
  isLoading,
}: {
  label: string
  value: string
  isLoading: boolean
}) {
  return (
    <div className="card-glow mrdn-panel px-6 py-[22px] flex-1 min-w-0 transition-colors duration-400 hover:border-[#ff8a4c]/[0.55]">
      <p className="mrdn-label uppercase font-mono">{label}</p>
      {isLoading ? (
        <div className="mt-3 h-[34px] w-24 rounded-[2px] bg-white/[0.06] animate-pulse" />
      ) : (
        <p className="mt-3 text-[34px] leading-none font-heading font-medium tracking-[-1px] text-text-primary tabular-nums">
          {value}
        </p>
      )}
    </div>
  )
}

export function StatsBar({ uniquePubkeys, sourceCount, fetchedAt, isLoading }: Props) {
  const timeStr = fetchedAt
    ? fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <StatTile
        label="Blacklisted"
        value={uniquePubkeys?.toLocaleString() ?? '—'}
        isLoading={isLoading && uniquePubkeys === null}
      />
      <StatTile
        label="Sources"
        value={sourceCount?.toString() ?? '—'}
        isLoading={isLoading && sourceCount === null}
      />
      <StatTile
        label="Fetched"
        value={timeStr}
        isLoading={isLoading && fetchedAt === null}
      />
    </div>
  )
}
