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
  pubkey: string
  blacklisted: boolean
  name?: string
  first_seen?: string
  sources: SourceRef[]
}

export interface SourceConfig {
  name: string
  url: string
  handler: unknown
  [key: string]: unknown
}

export type SourcesResponse = Record<string, SourceConfig>
