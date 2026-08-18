import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BlacklistEntry } from '../api/types'
import { BlacklistRow } from './BlacklistRow'
import { Spinner } from './Spinner'

const ROW_HEIGHT = 52

interface Props {
  entries: BlacklistEntry[]
  isLoading: boolean
  isFirstLoad: boolean
  totalCount: number | null
  onValidatorClick?: (pubkey: string) => void
}

export function BlacklistTable({ entries, isLoading, isFirstLoad, totalCount, onValidatorClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  if (isFirstLoad && isLoading) {
    return <Spinner message="Fetching blacklist data from all sources..." />
  }

  return (
    <div className="card-glow rounded-[2px] border border-white/[0.3] bg-[#0e1324] overflow-hidden transition-all duration-400 hover:border-[#ff8a4c]/[0.55]">
      {isLoading && !isFirstLoad && (
        <div className="h-[2px] w-full rounded-[1px] bg-white/[0.12] overflow-hidden">
          <div className="h-full w-1/3 rounded-[1px] bg-gradient-to-r from-transparent via-rose-400/40 to-transparent animate-progress" />
        </div>
      )}

      {!isLoading && totalCount !== null && (
        <div className="px-5 py-2.5 border-b border-white/[0.3] text-[0.64rem] tracking-[3px] uppercase text-text-muted font-mono">
          Showing <span className="text-text-primary">{entries.length.toLocaleString()}</span>
          {entries.length !== totalCount && ` of ${totalCount.toLocaleString()}`} entries
        </div>
      )}

      <div ref={scrollRef} className="overflow-auto max-h-[70vh]">
        <table className="w-full text-left table-fixed">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[38%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/[0.3] bg-[#0e1324]">
              <th className="px-5 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Name
              </th>
              <th className="px-5 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Vote Account
              </th>
              <th className="px-5 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Sources
              </th>
              <th className="px-5 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                Reason
              </th>
              <th className="px-5 py-3 text-[0.64rem] font-mono font-normal tracking-[3px] uppercase text-text-muted">
                First Seen
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-text-muted text-[0.85rem]">
                  No entries match your filter
                </td>
              </tr>
            ) : (
              <>
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0, border: 'none' }}
                    />
                  </tr>
                )}

                {virtualizer.getVirtualItems().map((virtualRow) => (
                  <BlacklistRow
                    key={entries[virtualRow.index].pubkey}
                    entry={entries[virtualRow.index]}
                    onValidatorClick={onValidatorClick}
                  />
                ))}

                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        height:
                          virtualizer.getTotalSize() -
                          (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        padding: 0,
                        border: 'none',
                      }}
                    />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
