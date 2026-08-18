import { Link } from 'react-router-dom'
import { MoonLogo } from './MoonLogo'

/**
 * First screen: the Meridian brand mark over the wordmark, centred in the
 * viewport. Type treatment (metallic gradient fill, Space Grotesk display,
 * mono tracking-3px eyebrows) is lifted from the Meridian hero.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-58px)] flex-col items-center justify-center gap-8 px-6 py-16 text-center sm:px-12">
      {/* Coordinate rails — Meridian's hero framing. Desktop only. */}
      <div className="pointer-events-none absolute inset-x-12 top-6 hidden justify-between font-mono text-[10px] tracking-[3px] text-text-secondary/40 lg:flex">
        <span>50°06′ N · OBSERVATORY OF LATENCY</span>
        <span>8°41′ E · SOLANA SECTOR</span>
      </div>

      <MoonLogo size={220} className="max-sm:!h-[min(56vw,220px)] max-sm:!w-[min(56vw,220px)]" />

      <p className="font-mono text-[11px] tracking-[4px] uppercase text-text-secondary/55 sm:text-[12px]">
        Solana Validator Trust Layer
      </p>

      <h1 className="m-0 bg-[linear-gradient(180deg,#ffffff_0%,#cdd6ea_38%,#66718c_52%,#f0f4fd_62%,#98a2ba_100%)] bg-clip-text font-heading text-[clamp(40px,9.5vw,104px)] font-bold leading-[0.95] tracking-[-2px] text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-wrap:balance]">
        Blacklist Explorer
      </h1>

      <p className="m-0 max-w-[620px] font-mono text-[13px] leading-[1.85] text-text-secondary/60 sm:text-[15px]">
        Every Solana validator flagged by an independent source, aggregated into one
        auditable list. Cross-referenced by epoch, traced back to who reported it and why.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <a href="#blacklist" className="mrdn-cta inline-block px-8 py-[15px] font-mono text-[12px] uppercase no-underline">
          Browse the list
        </a>
        <Link to="/sources" className="mrdn-btn inline-block font-mono text-[12px] uppercase no-underline">
          The sources
        </Link>
      </div>
    </section>
  )
}
