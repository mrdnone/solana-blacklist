import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchVoteDetail } from '../api/endpoints'
import type { VoteDetailResponse } from '../api/types'

export function useVoteDetail(target: string | null) {
  const [data, setData] = useState<VoteDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(() => {
    if (!target) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    fetchVoteDetail(target)
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
  }, [target])

  useEffect(() => {
    isMounted.current = true
    load()
    return () => {
      isMounted.current = false
    }
  }, [load])

  return { data, isLoading, error, refetch: load }
}
