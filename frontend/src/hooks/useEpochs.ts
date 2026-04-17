import { useEffect, useRef, useState } from 'react'
import { fetchEpochs } from '../api/endpoints'
import type { EpochSummary } from '../api/types'

export function useEpochs() {
  const [data, setData] = useState<EpochSummary[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    fetchEpochs()
      .then((d) => { if (isMounted.current) setData(d) })
      .catch((e) => { if (isMounted.current) setError(e.message ?? String(e)) })
      .finally(() => { if (isMounted.current) setIsLoading(false) })
  }, [])

  return { data, isLoading, error }
}
