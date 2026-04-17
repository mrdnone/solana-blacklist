import { apiFetch } from './client'
import type {
  BlacklistResponse,
  EpochDetailResponse,
  EpochSummary,
  PubkeyLookupResult,
  SourcesResponse,
  ValidatorDetailResponse,
} from './types'

export const fetchSources = () => apiFetch<SourcesResponse>('/sources')

export const fetchBlacklist = () => apiFetch<BlacklistResponse>('/blacklist')

export const lookupPubkey = (pubkey: string) =>
  apiFetch<PubkeyLookupResult>(`/blacklist/${encodeURIComponent(pubkey)}`)

export const fetchValidatorDetail = (pubkey: string) =>
  apiFetch<ValidatorDetailResponse>(`/validators/${encodeURIComponent(pubkey)}`)

export const fetchEpochs = () => apiFetch<EpochSummary[]>('/epochs')

export const fetchEpochDetail = (epoch: number) =>
  apiFetch<EpochDetailResponse>(`/epochs/${epoch}`)
