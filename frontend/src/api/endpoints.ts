import { apiFetch, apiPost } from './client'
import type {
  BlacklistResponse,
  EpochDetailResponse,
  EpochSummary,
  PubkeyLookupResult,
  SourcesResponse,
  ValidatorDetailResponse,
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

export const fetchEpochDetail = (epoch: number) =>
  apiFetch<EpochDetailResponse>(`/epochs/${epoch}`)

export const fetchVotes = () => apiFetch<VotesListResponse>('/votes')

export const fetchVoteDetail = (target: string) =>
  apiFetch<VoteDetailResponse>(`/votes/${encodeURIComponent(target)}`)

export const submitVote = (req: VoteSubmitRequest) =>
  apiPost<VoteSubmitResponse>('/votes', req)
