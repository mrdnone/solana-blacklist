// Solana-accented source badges — vivid tints per source
export const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sandwiched_me: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-300',
    border: 'border-orange-400/20',
  },
  hanabi: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    border: 'border-purple-400/20',
  },
  'jito:blacklist': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-300',
    border: 'border-cyan-400/20',
  },
  'solana::sfdp_rejects': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
    border: 'border-rose-400/20',
  },
}

export const FALLBACK_COLORS = {
  bg: 'bg-white/[0.05]',
  text: 'text-white/70',
  border: 'border-white/[0.12]',
}

export function getSourceColors(name: string) {
  return SOURCE_COLORS[name] ?? FALLBACK_COLORS
}
