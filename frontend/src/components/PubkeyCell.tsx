import { useState } from 'react'
import { truncatePubkey } from '../lib/truncate'

interface Props {
  pubkey: string
  variant?: 'green' | 'red'
}

export function PubkeyCell({ pubkey, variant = 'green' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(pubkey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const colorClass = variant === 'red' ? 'text-rose-400/80' : 'text-accent-green/80'

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <code className={`font-mono text-[0.82rem] ${colorClass} truncate`} title={pubkey}>
        {truncatePubkey(pubkey)}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 rounded-md hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-all duration-300"
        title="Copy pubkey"
      >
        {copied ? (
          <svg className={`w-3.5 h-3.5 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}
