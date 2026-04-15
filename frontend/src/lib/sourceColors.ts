// Meridian-style monochromatic source badges — subtle tints, no vivid colors
export const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sandwiched_me: {
    bg: 'bg-white/[0.03]',
    text: 'text-orange-200/70',
    border: 'border-white/[0.08]',
  },
  hanabi: {
    bg: 'bg-white/[0.03]',
    text: 'text-purple-200/70',
    border: 'border-white/[0.08]',
  },
  'jito:blacklist': {
    bg: 'bg-white/[0.03]',
    text: 'text-blue-200/70',
    border: 'border-white/[0.08]',
  },
  'solana::sfdp_rejects': {
    bg: 'bg-white/[0.03]',
    text: 'text-red-200/70',
    border: 'border-white/[0.08]',
  },
}

export const FALLBACK_COLORS = {
  bg: 'bg-white/[0.03]',
  text: 'text-white/50',
  border: 'border-white/[0.08]',
}

export function getSourceColors(name: string) {
  return SOURCE_COLORS[name] ?? FALLBACK_COLORS
}
