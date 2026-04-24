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
    <div className="card-glow rounded-2xl border border-white/[0.11] bg-[#1a1b1f] px-5 py-5 flex-1 min-w-0 text-center transition-all duration-400 hover:border-accent-green/20 hover:shadow-[0_0_40px_rgba(20,241,149,0.06)] hover:bg-[#21222c]">
      <p className="text-[0.72rem] tracking-[3px] uppercase text-text-muted mb-2 font-mono">{label}</p>
      {isLoading ? (
        <div className="h-8 w-20 mx-auto rounded bg-white/[0.03] animate-pulse" />
      ) : (
        <p className="text-[1.8rem] font-heading font-bold tracking-[-1px] bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent">
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
