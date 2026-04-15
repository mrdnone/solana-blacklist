import { apiFetch } from './client'
import type { BlacklistResponse, PubkeyLookupResult, SourcesResponse } from './types'

export const fetchSources = () => apiFetch<SourcesResponse>('/sources')

export const fetchBlacklist = () => apiFetch<BlacklistResponse>('/blacklist')

export const lookupPubkey = (pubkey: string) =>
  apiFetch<PubkeyLookupResult>(`/blacklist/${encodeURIComponent(pubkey)}`)
