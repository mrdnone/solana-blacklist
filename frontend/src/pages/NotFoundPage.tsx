import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-20 text-center space-y-6">
      <p className="font-heading text-[3rem] font-semibold tracking-[8px] uppercase text-text-muted">
        404
      </p>
      <p className="text-[0.9rem] text-text-secondary">
        Page not found.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[0.75rem] tracking-[2px] uppercase font-mono text-accent-green/80 hover:text-accent-green transition-colors"
      >
        ← Back to Blacklist
      </Link>
    </main>
  )
}
