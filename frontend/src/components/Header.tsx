interface Props {
  onSources?: () => void
  onEpochs?: () => void
  onValidators?: () => void
  onMeridian?: () => void
}

export function Header({ onSources, onEpochs, onValidators, onMeridian }: Props) {
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
          {onValidators && (
            <button
              onClick={onValidators}
              className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-green/20 bg-accent-green/[0.06] rounded-full px-5 py-2 text-accent-green/80 hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/10 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Validators
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
          {onSources && (
            <button
              onClick={onSources}
              className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-purple/20 bg-accent-purple/[0.06] rounded-full px-5 py-2 text-accent-purple/80 hover:text-accent-purple hover:border-accent-purple/40 hover:bg-accent-purple/10 transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
              Sources
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
