import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchValidatorDetail } from '../api/endpoints'
import type { ValidatorDetailResponse } from '../api/types'

export function useValidatorDetail(pubkey: string | null) {
  const [data, setData] = useState<ValidatorDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    if (!pubkey) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    fetchValidatorDetail(pubkey)
      .then((d) => { if (isMounted.current) setData(d) })
      .catch((e) => { if (isMounted.current) setError(e.message ?? String(e)) })
      .finally(() => { if (isMounted.current) setIsLoading(false) })
  }, [pubkey])

  const refetch = useCallback(() => {
    if (!pubkey) return
    setIsLoading(true)
    setError(null)
    fetchValidatorDetail(pubkey)
      .then((d) => { if (isMounted.current) setData(d) })
      .catch((e) => { if (isMounted.current) setError(e.message ?? String(e)) })
      .finally(() => { if (isMounted.current) setIsLoading(false) })
  }, [pubkey])

  return { data, isLoading, error, refetch }
}
