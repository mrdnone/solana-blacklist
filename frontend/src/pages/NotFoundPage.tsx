import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="max-w-[1280px] mx-auto px-6 sm:px-12 py-20 text-center space-y-6">
      <p className="font-heading text-[3rem] font-medium tracking-[8px] uppercase text-text-muted">
        404
      </p>
      <p className="text-[0.9rem] text-text-secondary">
        Page not found.
      </p>
      <Link
        to="/"
        className="mrdn-back uppercase"
      >
        ← Back to Blacklist
      </Link>
    </main>
  )
}
