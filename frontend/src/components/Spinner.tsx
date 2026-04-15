export function Spinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-0 rounded-full border border-transparent border-t-white/40 animate-spin" />
        <div className="absolute inset-2 rounded-full shadow-[0_0_20px_rgba(200,210,255,0.15)]" />
      </div>
      {message && (
        <div className="text-center">
          <p className="text-[0.85rem] text-text-secondary font-body">{message}</p>
          <p className="text-[0.72rem] text-text-muted mt-1.5 tracking-[1px]">This may take up to 20 seconds</p>
        </div>
      )}
    </div>
  )
}
