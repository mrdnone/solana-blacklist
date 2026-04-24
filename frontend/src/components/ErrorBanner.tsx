interface Props {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}

export function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <div className="card-glow rounded-xl border border-rose-400/15 bg-[#17181e] px-5 py-4 flex items-center gap-4">
      <div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(255,100,100,0.4)] shrink-0" />
      <p className="text-[0.85rem] text-text-secondary flex-1">{message}</p>
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-[0.75rem] tracking-[2px] uppercase text-text-muted hover:text-text-primary border border-white/[0.08] rounded-full px-4 py-1.5 hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-300 font-mono"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-primary transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
