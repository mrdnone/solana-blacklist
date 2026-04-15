export function truncatePubkey(pubkey: string, chars = 4): string {
  if (pubkey.length <= chars * 2 + 3) return pubkey
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`
}
