interface Props {
  onSuggestSource?: () => void
}

export function Header({ onSuggestSource }: Props) {
  return (
    <header className="hero-eclipse relative border-b border-white/[0.06] py-16 sm:py-20">
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-12 text-center">
        <h1 className="font-heading text-[2.6rem] sm:text-[3.2rem] font-semibold tracking-[8px] sm:tracking-[12px] uppercase bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent leading-tight"
            style={{ textShadow: '0 0 80px rgba(20, 241, 149, 0.3)' }}>
          Blacklist
        </h1>
        <p className="mt-3 text-[0.78rem] tracking-[4px] uppercase text-text-muted font-body">
          Aggregated Solana Validator Data
        </p>
        <div className="mt-5 mx-auto w-[60px] h-px bg-gradient-to-r from-transparent via-accent-green/30 to-transparent" />

        {onSuggestSource && (
          <button
            onClick={onSuggestSource}
            className="mt-6 inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-purple/20 bg-accent-purple/[0.06] rounded-full px-5 py-2 text-accent-purple/80 hover:text-accent-purple hover:border-accent-purple/40 hover:bg-accent-purple/10 transition-all duration-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Suggest Source
          </button>
        )}
      </div>
    </header>
  )
}
