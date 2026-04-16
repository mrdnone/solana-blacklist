import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBlacklist } from '../api/endpoints'
import type { BlacklistResponse } from '../api/types'

export function useBlacklist() {
  const [data, setData] = useState<BlacklistResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchBlacklist()
      .then((result) => {
        if (isMounted.current) {
          setData(result)
          // Use the server-side fetched_at timestamp if available
          setFetchedAt(result.fetched_at ? new Date(result.fetched_at) : new Date())
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err.message)
          setIsLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    isMounted.current = true
    load()
    return () => {
      isMounted.current = false
    }
  }, [load])

  return { data, isLoading, error, fetchedAt, refetch: load }
}
