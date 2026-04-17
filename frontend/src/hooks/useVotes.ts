import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchVotes } from '../api/endpoints'
import type { VotesListResponse } from '../api/types'

export function useVotes() {
  const [data, setData] = useState<VotesListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchVotes()
      .then((result) => {
        if (isMounted.current) {
          setData(result)
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

  return { data, isLoading, error, refetch: load }
}
