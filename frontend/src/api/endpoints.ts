import { apiFetch, apiPost } from './client'
import type {
  BlacklistResponse,
  EpochDetailResponse,
  EpochSummary,
  PubkeyLookupResult,
  SourcesResponse,
  ValidatorDetailResponse,
  ValidatorsListResponse,
  VoteDetailResponse,
  VotesListResponse,
  VoteSubmitRequest,
  VoteSubmitResponse,
} from './types'

export const fetchSources = () => apiFetch<SourcesResponse>('/sources')

export const fetchBlacklist = () => apiFetch<BlacklistResponse>('/blacklist')

export const lookupPubkey = (pubkey: string) =>
  apiFetch<PubkeyLookupResult>(`/blacklist/${encodeURIComponent(pubkey)}`)

export const fetchValidatorDetail = (pubkey: string) =>
  apiFetch<ValidatorDetailResponse>(`/validators/${encodeURIComponent(pubkey)}`)

export const fetchEpochs = () => apiFetch<EpochSummary[]>('/epochs')

export const fetchEpochDetail = (epoch: number, q?: string, delinquent?: boolean, blacklistedOnly?: boolean, limit?: number, offset?: number) => {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (delinquent != null) params.set('delinquent', String(delinquent))
  if (blacklistedOnly) params.set('blacklisted_only', 'true')
  if (limit != null) params.set('limit', String(limit))
  if (offset != null) params.set('offset', String(offset))
  const qs = params.toString()
  return apiFetch<EpochDetailResponse>(`/epochs/${epoch}${qs ? '?' + qs : ''}`)
}

export const fetchVotes = () => apiFetch<VotesListResponse>('/votes')

export const fetchVoteDetail = (target: string) =>
  apiFetch<VoteDetailResponse>(`/votes/${encodeURIComponent(target)}`)

export const submitVote = (req: VoteSubmitRequest) =>
  apiPost<VoteSubmitResponse>('/votes', req)

export const fetchValidators = (q?: string, delinquent?: boolean, excludeZeroStake?: boolean, limit?: number, offset?: number) => {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (delinquent != null) params.set('delinquent', String(delinquent))
  if (excludeZeroStake) params.set('exclude_zero_stake', 'true')
  if (limit != null) params.set('limit', String(limit))
  if (offset != null) params.set('offset', String(offset))
  const qs = params.toString()
  return apiFetch<ValidatorsListResponse>(`/validators${qs ? '?' + qs : ''}`)
}
