import { useEffect, useRef, useState } from 'react'
import { fetchValidators } from '../api/endpoints'
import type { ValidatorsListResponse } from '../api/types'

export function useValidators(q: string, delinquent: boolean | undefined, excludeZeroStake: boolean, limit: number, offset: number) {
  const [data, setData] = useState<ValidatorsListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetchValidators(q || undefined, delinquent, excludeZeroStake, limit, offset)
      .then((d) => { if (isMounted.current) setData(d) })
      .catch((e) => { if (isMounted.current) setError(e.message ?? String(e)) })
      .finally(() => { if (isMounted.current) setIsLoading(false) })
  }, [q, delinquent, excludeZeroStake, limit, offset])

  return { data, isLoading, error }
}
