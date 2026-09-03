import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface BackState {
  from?: string
}

export function useFromHere(): BackState {
  const { pathname, search, hash } = useLocation()
  return { from: `${pathname}${search}${hash}` }
}

export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as BackState | null)?.from

  return useCallback(() => {
    if (from) {
      navigate(from)
      return
    }

    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
      return
    }

    navigate(fallback)
  }, [navigate, from, fallback])
}
