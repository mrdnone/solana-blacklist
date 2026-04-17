import { useEffect, useRef, useState } from 'react'
import { fetchEpochDetail } from '../api/endpoints'
import type { EpochDetailResponse } from '../api/types'

export function useEpochDetail(epoch: number | null) {
  const [data, setData] = useState<EpochDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    if (epoch === null) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    fetchEpochDetail(epoch)
      .then((d) => { if (isMounted.current) setData(d) })
      .catch((e) => { if (isMounted.current) setError(e.message ?? String(e)) })
      .finally(() => { if (isMounted.current) setIsLoading(false) })
  }, [epoch])

  return { data, isLoading, error }
}
