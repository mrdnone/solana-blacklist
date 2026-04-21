export interface SourceRef {
  name: string
  reason?: string
  validator_name?: string
}

export interface BlacklistEntry {
  pubkey: string
  name?: string
  first_seen?: string
  sources: SourceRef[]
}

export interface BlacklistResponse {
  unique_pubkeys: number
  sources: number
  fetched_at?: string
  entries: BlacklistEntry[]
}

export interface PubkeyLookupResult {
  pubkey: string        // resolved vote account pubkey
  identity?: string     // validator identity pubkey (if known)
  blacklisted: boolean
  name?: string
  first_seen?: string
  sources: SourceRef[]
  in_validators_db?: boolean
}

export interface SourceConfig {
  name: string
  url: string
  handler: unknown
  [key: string]: unknown
}

export type SourcesResponse = Record<string, SourceConfig>

// ── Validator detail ─────────────────────────────────────────────────────────

export interface ValidatorMeta {
  vote_identity: string
  identity?: string
  name?: string
  delinquent?: boolean
  activated_stake?: number
  commission?: number
  skip_rate?: number
  uptime?: number
  version?: string
  wiz_score?: number
  apy_estimate?: number
  ip_country?: string
  image?: string
  website?: string
  updated_at: string
  node_pubkey?: string
  activated_stake_lamports?: number
  last_vote?: number
  root_slot?: number
  epoch_credits?: number
  prev_epoch_credits?: number
}

export interface ValidatorEpochSnapshot {
  vote_identity: string
  epoch: number
  node_pubkey?: string
  activated_stake_lamports?: number
  commission?: number
  is_delinquent: boolean
  epoch_credits?: number
  prev_epoch_credits?: number
  last_vote?: number
  root_slot?: number
  name?: string
  skip_rate?: number
  uptime?: number
  version?: string
  wiz_score?: number
  apy_estimate?: number
  ip_country?: string
  image?: string
  website?: string
  snapshotted_at: string
}

export interface ValidatorDetailResponse {
  vote_identity: string
  current: ValidatorMeta | null
  epochs: ValidatorEpochSnapshot[]
}

// ── Epoch endpoints ──────────────────────────────────────────────────────────

export interface EpochSummary {
  epoch: number
  validator_count: number
  total_stake_lamports?: number
  avg_commission?: number
  snapshotted_at: string
}

export interface EpochDetailResponse {
  epoch: number
  validator_count: number
  validators: ValidatorEpochSnapshot[]
  total: number
  limit: number
  offset: number
}

// ── Meridian voting ─────────────────────────────────────────────────────────

export interface Vote {
  voter_identity: string
  target_vote_pubkey: string
  signature: string
  voted_at: string
}

export interface VoteTarget {
  target_vote_pubkey: string
  vote_count: number
}

export interface VotesListResponse {
  threshold: number
  targets: VoteTarget[]
}

export interface VoteDetailResponse {
  target: string
  vote_count: number
  threshold: number
  blacklisted: boolean
  votes: Vote[]
}

export interface VoteSubmitRequest {
  voter_identity: string
  target_vote_pubkey: string
  signature: string
}

export interface VoteSubmitResponse {
  status: string
  inserted: boolean
}

// ── Validators list ─────────────────────────────────────────────────────────

export interface ValidatorsListResponse {
  validators: ValidatorMeta[]
  total: number
  limit: number
  offset: number
}
