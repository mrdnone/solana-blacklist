import { useEffect, useState } from 'react'
import { fetchSources } from '../api/endpoints'

export function useSources() {
  const [sourceNames, setSourceNames] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSources()
      .then((data) => {
        if (!cancelled) {
          setSourceNames(Object.keys(data).sort())
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

  return { sourceNames, isLoading, error }
}
