export function Header() {
  return (
    <header className="hero-eclipse relative border-b border-white/[0.06] py-16 sm:py-20">
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-12 text-center">
        <h1 className="font-heading text-[2.6rem] sm:text-[3.2rem] font-semibold tracking-[8px] sm:tracking-[12px] uppercase bg-gradient-to-b from-white to-[#888899] bg-clip-text text-transparent leading-tight"
            style={{ textShadow: '0 0 80px rgba(200, 210, 255, 0.3)' }}>
          Blacklist
        </h1>
        <p className="mt-3 text-[0.78rem] tracking-[4px] uppercase text-text-muted font-body">
          Aggregated Solana Validator Data
        </p>
        <div className="mt-5 mx-auto w-[60px] h-px bg-gradient-to-r from-transparent via-[rgba(200,210,255,0.25)] to-transparent" />
      </div>
    </header>
  )
}
