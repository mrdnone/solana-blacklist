import { NavLink } from 'react-router-dom'

export function Header() {
  return (
    <header className="hero-eclipse relative border-b border-white/[0.06] py-16 sm:py-20">
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-12 text-center">
        <NavLink to="/" end className="inline-block">
          <h1 className="font-heading text-[2.6rem] sm:text-[3.2rem] font-semibold tracking-[8px] sm:tracking-[12px] uppercase bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent leading-tight"
              style={{ textShadow: '0 0 80px rgba(20, 241, 149, 0.3)' }}>
            Blacklist Explorer
          </h1>
        </NavLink>
        <p className="mt-3 text-[0.78rem] tracking-[4px] uppercase text-text-muted font-body">
          Solana Validator Trust Layer
        </p>
        <div className="mt-5 mx-auto w-[60px] h-px bg-gradient-to-r from-transparent via-accent-green/30 to-transparent" />

        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <NavLink
            to="/epochs"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border rounded-full px-5 py-2 transition-all duration-300 ${
                isActive
                  ? 'border-accent-green/50 bg-accent-green/15 text-accent-green'
                  : 'border-accent-green/20 bg-accent-green/[0.06] text-accent-green/80 hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/10'
              }`
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Epochs
          </NavLink>

          <NavLink
            to="/validators"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border rounded-full px-5 py-2 transition-all duration-300 ${
                isActive
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                  : 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400/80 hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10'
              }`
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Validators
          </NavLink>

          <NavLink
            to="/sources"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border rounded-full px-5 py-2 transition-all duration-300 ${
                isActive
                  ? 'border-accent-purple/50 bg-accent-purple/15 text-accent-purple'
                  : 'border-accent-purple/20 bg-accent-purple/[0.06] text-accent-purple/80 hover:text-accent-purple hover:border-accent-purple/40 hover:bg-accent-purple/10'
              }`
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            Sources
          </NavLink>

          {/* Divider */}
          <span className="w-px h-6 self-center bg-white/[0.08]" />

          {/* API Docs — internal */}
          <NavLink
            to="/api-docs"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border rounded-full px-5 py-2 transition-all duration-300 ${
                isActive
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-400'
                  : 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-400/70 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10'
              }`
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            API Docs
          </NavLink>

          {/* Swagger — external */}
          <a
            href={`${import.meta.env.VITE_API_ORIGIN ?? ''}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-white/[0.1] rounded-full px-5 py-2 text-text-muted hover:text-text-primary hover:border-white/[0.2] transition-all duration-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            Swagger
            <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}
