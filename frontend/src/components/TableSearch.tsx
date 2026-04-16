interface Props {
  value: string
  onChange: (value: string) => void
}

export function TableSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter results by pubkey, source, or reason..."
        className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d18] py-3 pl-11 pr-4 text-[0.85rem] text-text-primary placeholder-text-muted outline-none focus:border-accent-green/30 focus:shadow-[0_0_30px_rgba(20,241,149,0.06)] transition-all duration-300 font-body"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-all duration-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
