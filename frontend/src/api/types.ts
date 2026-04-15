export interface SourceRef {
  name: string
  reason?: string
}

export interface BlacklistEntry {
  pubkey: string
  sources: SourceRef[]
}

export interface BlacklistResponse {
  unique_pubkeys: number
  sources: number
  entries: BlacklistEntry[]
}

export interface PubkeyLookupResult {
  pubkey: string
  blacklisted: boolean
  sources: SourceRef[]
}

export interface SourceConfig {
  name: string
  url: string
  handler: unknown
  [key: string]: unknown
}

export type SourcesResponse = Record<string, SourceConfig>
