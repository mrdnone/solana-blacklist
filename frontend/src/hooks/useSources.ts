import { useEffect, useState } from 'react'
import { fetchSources } from '../api/endpoints'
import type { SourcesResponse } from '../api/types'

export function useSources() {
  const [sourceNames, setSourceNames] = useState<string[]>([])
  const [data, setData] = useState<SourcesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSources()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setSourceNames(Object.keys(d).sort())
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { sourceNames, data, isLoading, error }
}
