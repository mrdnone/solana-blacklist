interface Props {
  onSuggestSource?: () => void
  onEpochs?: () => void
  onMeridian?: () => void
}

export function Header({ onSuggestSource, onEpochs, onMeridian }: Props) {
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

        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          {onEpochs && (
            <button
              onClick={onEpochs}
              className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-green/20 bg-accent-green/[0.06] rounded-full px-5 py-2 text-accent-green/80 hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/10 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Epochs
            </button>
          )}
          {onMeridian && (
            <button
              onClick={onMeridian}
              className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-amber-500/20 bg-amber-500/[0.06] rounded-full px-5 py-2 text-amber-400/80 hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Vote to Blacklist
            </button>
          )}
          {onSuggestSource && (
            <button
              onClick={onSuggestSource}
              className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-purple/20 bg-accent-purple/[0.06] rounded-full px-5 py-2 text-accent-purple/80 hover:text-accent-purple hover:border-accent-purple/40 hover:bg-accent-purple/10 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Suggest Source
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
