import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Stars } from './components/Stars'

const FOOTER_LINKS = [
  { label: 'Telegram', href: 'https://t.me/mrdnone', external: true },
  { label: 'Discord', href: 'https://discord.com/users/1172938486106554591', external: true },
  { label: 'Email', href: 'mailto:Blacklistmrndone@gmail.com', external: false },
  { label: 'GitHub', href: 'https://github.com/mrdnone/solana-blacklist', external: true },
]

export default function App() {
  return (
    <div className="relative min-h-screen">
      <Stars />

      <div className="relative z-10">
        <Header />

        <Outlet />

        <footer className="mt-20 flex items-center justify-between gap-4 flex-wrap border-t border-white/[0.26] px-6 sm:px-12 pt-6 pb-7 font-mono text-[10.5px] tracking-[2px] uppercase text-[#dfe6f5]/[0.68]">
          <span>Solana Blacklist Explorer</span>
          <div className="flex items-center gap-[22px] flex-wrap">
            {FOOTER_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="tracking-[2px] text-[#dfe6f5]/[0.68] hover:text-text-primary transition-colors duration-300"
              >
                {l.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}
