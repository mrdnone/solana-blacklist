import { useCallback, useState } from 'react'
import { HttpError } from '../api/client'
import { lookupPubkey as apiLookup } from '../api/endpoints'
import type { PubkeyLookupResult } from '../api/types'
import { BASE58_RE } from '../lib/constants'

export function usePubkeyLookup() {
  const [result, setResult] = useState<PubkeyLookupResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback((pubkey: string) => {
    const trimmed = pubkey.trim()
    if (!trimmed) {
      setError('Please enter a pubkey')
      return
    }
    if (!BASE58_RE.test(trimmed)) {
      setError('Invalid pubkey format (must be 32-44 base58 characters)')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    apiLookup(trimmed)
      .then((data) => {
        setResult(data)
        setIsLoading(false)
      })
      .catch((err) => {
        if (err instanceof HttpError && err.status === 404) {
          // 404 means "not blacklisted" — that's a valid result, not an error
          setResult({ pubkey: trimmed, blacklisted: false, sources: [] })
          setIsLoading(false)
        } else {
          setError(err.message)
          setIsLoading(false)
        }
      })
  }, [])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, lookup, clear }
}
