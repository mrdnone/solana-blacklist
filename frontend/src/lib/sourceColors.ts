export const SOURCE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  'jito:blacklist': {
    bg: 'bg-white/[0.07]',
    text: 'text-white',
    border: 'border-white/[0.5]',
    dot: '#ffffff',
  },
  jito: {
    bg: 'bg-white/[0.07]',
    text: 'text-white',
    border: 'border-white/[0.5]',
    dot: '#ffffff',
  },
  hanabi: {
    bg: 'bg-white/[0.05]',
    text: 'text-[#e6ecf8]',
    border: 'border-white/[0.4]',
    dot: '#e6ecf8',
  },
  sandwiched_me: {
    bg: 'bg-white/[0.04]',
    text: 'text-[#c8d2e6]',
    border: 'border-white/[0.34]',
    dot: '#c8d2e6',
  },
  sfdp_rejects: {
    bg: 'bg-white/[0.03]',
    text: 'text-[#aab5cd]',
    border: 'border-white/[0.28]',
    dot: '#aab5cd',
  },
  meridian: {
    bg: 'bg-[#ff8a4c]/[0.12]',
    text: 'text-[#ff8a4c]',
    border: 'border-[#ff8a4c]/[0.6]',
    dot: '#ff8a4c',
  },
}

const FALLBACK = {
  bg: 'bg-white/[0.04]',
  text: 'text-[#c8d2e6]',
  border: 'border-white/[0.34]',
  dot: '#c8d2e6',
}

export function getSourceColors(name: string) {
  return SOURCE_COLORS[name] ?? FALLBACK
}
