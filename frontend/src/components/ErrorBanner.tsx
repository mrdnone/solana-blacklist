interface Props {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}

export function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <div className="card-glow rounded-[2px] border border-rose-400/60 bg-[#0e1324] px-5 py-4 flex items-center gap-4">
      <span className="mrdn-node mrdn-node--ember shrink-0" />
      <p className="text-[0.85rem] text-text-secondary flex-1">{message}</p>
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="mrdn-btn mrdn-btn--sm uppercase"
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
