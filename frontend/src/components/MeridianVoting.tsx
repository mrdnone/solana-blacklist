import { useEffect, useState } from 'react'
import { submitVote } from '../api/endpoints'
import type { VoteDetailResponse } from '../api/types'
import { useVoteDetail } from '../hooks/useVoteDetail'
import { useVotes } from '../hooks/useVotes'

const PRESET_REASONS = [
  'Sandwich attacks / MEV exploitation targeting delegators',
  'Consistently high commission without notice',
  'Validator downtime / chronic delinquency',
  'Identity misrepresentation or impersonation',
  'Collusion with other validators to manipulate consensus',
  'Custom',
] as const

type PresetReason = (typeof PRESET_REASONS)[number]

interface Props {
  onBack: () => void
  initialTarget?: string
}

export function MeridianVoting({ onBack, initialTarget }: Props) {
  const votes = useVotes()

  // Vote submission state
  const [target, setTarget] = useState(initialTarget ?? '')
  const [showInstructions, setShowInstructions] = useState(false)
  const [voteTimestamp, setVoteTimestamp] = useState<number | null>(null)
  const [voterIdentity, setVoterIdentity] = useState('')
  const [signature, setSignature] = useState('')
  const [selectedReason, setSelectedReason] = useState<PresetReason | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitResult, setSubmitResult] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const effectiveReason =
    selectedReason === 'Custom' ? customReason.trim() : (selectedReason ?? '')
  const reasonValid = effectiveReason.length > 0

  // Live countdown for the 10-minute signing window
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (voteTimestamp === null) {
      setSecondsLeft(null)
      return
    }
    const tick = () => {
      const remaining = (voteTimestamp + 600) - Math.floor(Date.now() / 1000)
      setSecondsLeft(Math.max(0, remaining))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [voteTimestamp])

  // Detail expansion
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null)
  const voteDetail = useVoteDetail(expandedTarget)

  const canonicalMessage =
    target && voteTimestamp ? `meridian:blacklist:${target}:${voteTimestamp}` : ''

  const handleOpenInstructions = () => {
    if (!target.trim()) return
    setVoteTimestamp(Math.floor(Date.now() / 1000))
    setSelectedReason(null)
    setCustomReason('')
    setShowInstructions(true)
    setSubmitResult(null)
    setSubmitError(null)
  }

  const handleSubmit = async () => {
    if (!voterIdentity.trim() || !signature.trim() || !target.trim() || !reasonValid || secondsLeft === 0) return
    setSubmitLoading(true)
    setSubmitResult(null)
    setSubmitError(null)
    try {
      const res = await submitVote({
        voter_identity: voterIdentity.trim(),
        target_vote_pubkey: target.trim(),
        signature: signature.trim(),
        voted_at_ts: voteTimestamp!,
        reason: effectiveReason,
      })
      setSubmitResult(res.inserted ? 'Report recorded successfully!' : 'Report already exists.')
      setVoterIdentity('')
      setSignature('')
      setSelectedReason(null)
      setCustomReason('')
      setVoteTimestamp(null)
      setShowInstructions(false)
      votes.refetch()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const truncate = (s: string) => (s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s)

  return (
    <div className="max-w-[820px] mx-auto px-6 sm:px-12 py-10 space-y-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[0.78rem] tracking-[2px] uppercase text-text-muted hover:text-accent-green transition-colors duration-300 font-mono"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Title */}
      <div>
        <h2 className="font-heading text-[1.8rem] sm:text-[2.2rem] font-semibold tracking-[4px] uppercase bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Meridian Blacklist Reports
        </h2>
        <p className="mt-3 text-[0.88rem] text-text-secondary leading-relaxed">
          Community-driven validator blacklisting through cryptographic reporting.
        </p>
      </div>

      {/* Section 1: How It Works */}
      <Section title="How It Works">
        <ul className="list-disc list-inside space-y-2">
          <li>
            Validators sign a canonical off-chain message: <Code>meridian:blacklist:&lt;target_pubkey&gt;:&lt;timestamp&gt;</Code>
          </li>
          <li>Paste the signature proof along with your validator identity pubkey.</li>
          <li>
            Once a target reaches <strong className="text-amber-300">{votes.data?.threshold ?? 10} reports</strong>, it
            will be reviewed by Meridian and may be added to the blacklist.
          </li>
        </ul>
      </Section>

      {/* Section 2: Vote to Blacklist */}
      <Section title="Report to Blacklist">
        <div className="space-y-4">
          <div>
            <label className="block text-[0.75rem] tracking-[2px] uppercase text-text-muted mb-2 font-mono">
              Target Vote Account Pubkey
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setShowInstructions(false)
                  setVoteTimestamp(null)
                }}
                placeholder="Enter validator vote account pubkey..."
                className="flex-1 bg-[#131418] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[0.85rem] text-text-primary font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <button
                onClick={handleOpenInstructions}
                disabled={!target.trim()}
                className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono bg-amber-500/10 border border-amber-500/20 rounded-lg px-5 py-2.5 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Blacklist this validator
              </button>
            </div>
          </div>

          {showInstructions && (
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-5 space-y-4">
              <h4 className="text-[0.82rem] font-mono tracking-[2px] uppercase text-amber-300">
                Signing Instructions
              </h4>

              {/* Step 1: Message */}
              <div className="space-y-1.5">
                <p className="text-[0.78rem] text-text-muted">1. Canonical message to sign:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#131418] border border-white/[0.04] rounded px-3 py-2 text-[0.78rem] text-amber-300/80 font-mono break-all">
                    {canonicalMessage}
                  </code>
                  <button
                    onClick={() => copyToClipboard(canonicalMessage)}
                    className="shrink-0 text-text-muted hover:text-amber-300 transition-colors p-1.5"
                    title="Copy message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                {voteTimestamp && secondsLeft !== null && (
                  <div className="flex items-center gap-3">
                    <p className={`text-[0.72rem] font-mono ${secondsLeft <= 60 ? 'text-rose-400' : 'text-text-muted'}`}>
                      {secondsLeft > 0
                        ? `Expires in ${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`
                        : 'Expired — refresh to get a new timestamp'}
                    </p>
                    {secondsLeft <= 60 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVoteTimestamp(Math.floor(Date.now() / 1000))
                          setSignature('')
                        }}
                        className="text-[0.70rem] font-mono tracking-[1px] uppercase px-2.5 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: CLI command */}
              <div className="space-y-1.5">
                <p className="text-[0.78rem] text-text-muted">2. Sign with Solana CLI:</p>
                <pre className="bg-[#131418] border border-white/[0.04] rounded px-3 py-2 text-[0.75rem] text-text-secondary font-mono overflow-x-auto">
                  {`solana sign-offchain-message -k <identity-keypair> "${canonicalMessage}"`}
                </pre>
              </div>

              {/* Step 3: Identity */}
              <div className="space-y-1.5">
                <label className="block text-[0.78rem] text-text-muted">3. Your validator identity pubkey:</label>
                <input
                  type="text"
                  value={voterIdentity}
                  onChange={(e) => setVoterIdentity(e.target.value)}
                  placeholder="Voter identity pubkey..."
                  className="w-full bg-[#131418] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[0.85rem] text-text-primary font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>

              {/* Step 4: Signature */}
              <div className="space-y-1.5">
                <label className="block text-[0.78rem] text-text-muted">4. Base58 signature:</label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Paste signature here..."
                  className="w-full bg-[#131418] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[0.85rem] text-text-primary font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>

              {/* Step 5: Reason */}
              <div className="space-y-2">
                <label className="block text-[0.78rem] text-text-muted">
                  5. Reason <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-1.5">
                  {PRESET_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedReason(r)}
                      className={`w-full text-left rounded-lg border px-4 py-2.5 text-[0.82rem] font-mono transition-colors ${
                        selectedReason === r
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-white/[0.06] bg-[#131418] text-text-secondary hover:border-white/[0.12]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {selectedReason === 'Custom' && (
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe why this validator should be blacklisted..."
                    rows={3}
                    className="w-full bg-[#131418] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[0.85rem] text-text-primary font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-amber-500/40 transition-colors resize-none"
                  />
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitLoading || !voterIdentity.trim() || !signature.trim() || !reasonValid || secondsLeft === 0}
                className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono bg-amber-500/15 border border-amber-500/30 rounded-lg px-6 py-2.5 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitLoading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          )}

          {submitResult && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-4 py-3 text-[0.82rem] text-green-300">
              {submitResult}
            </div>
          )}
          {submitError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-[0.82rem] text-rose-300">
              {submitError}
            </div>
          )}
        </div>
      </Section>

      {/* Section 3: Current Votes */}
      <Section title="Current Reports">
        {votes.isLoading && !votes.data ? (
          <div className="text-text-muted text-[0.82rem] py-4">Loading reports...</div>
        ) : votes.error ? (
          <div className="text-rose-300 text-[0.82rem] py-4">
            Error: {votes.error}{' '}
            <button onClick={votes.refetch} className="underline text-amber-300 ml-2">
              Retry
            </button>
          </div>
        ) : !votes.data?.targets.length ? (
          <div className="text-text-muted text-[0.82rem] py-4">No reports recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {votes.data.targets.map((t) => {
              const pct = Math.min(100, (t.vote_count / votes.data!.threshold) * 100)
              const reached = t.vote_count >= votes.data!.threshold
              const isExpanded = expandedTarget === t.target_vote_pubkey

              return (
                <div key={t.target_vote_pubkey}>
                  <button
                    onClick={() => setExpandedTarget(isExpanded ? null : t.target_vote_pubkey)}
                    className="w-full text-left rounded-lg border border-white/[0.06] bg-[#131418] hover:border-white/[0.1] transition-colors p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-[0.82rem] text-text-primary" title={t.target_vote_pubkey}>
                        {truncate(t.target_vote_pubkey)}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[0.75rem] font-mono text-text-muted">
                          {t.vote_count} / {votes.data!.threshold}
                        </span>
                        {reached ? (
                          <span className="text-[0.68rem] tracking-[1px] uppercase font-mono px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-400/20">
                            Blacklisted
                          </span>
                        ) : (
                          <span className="text-[0.68rem] tracking-[1px] uppercase font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-400/20">
                            Pending
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-rose-500/60' : 'bg-amber-500/60'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <VoteDetailPanel detail={voteDetail.data} isLoading={voteDetail.isLoading} error={voteDetail.error} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

/* ── Sub-components ── */

function VoteDetailPanel({
  detail,
  isLoading,
  error,
}: {
  detail: VoteDetailResponse | null
  isLoading: boolean
  error: string | null
}) {
  if (isLoading) return <div className="px-4 py-3 text-[0.78rem] text-text-muted">Loading details...</div>
  if (error) return <div className="px-4 py-3 text-[0.78rem] text-rose-300">Error: {error}</div>
  if (!detail?.votes.length) return <div className="px-4 py-3 text-[0.78rem] text-text-muted">No reports yet.</div>

  return (
    <div className="ml-4 mt-1 rounded-lg border border-white/[0.04] bg-[#131418] p-4 space-y-2">
      {detail.votes.map((v) => (
        <div key={v.signature} className="space-y-0.5">
          <div className="flex items-center justify-between text-[0.78rem]">
            <span className="font-mono text-text-secondary" title={v.voter_identity}>
              {v.voter_identity.slice(0, 6)}...{v.voter_identity.slice(-4)}
            </span>
            <span className="text-text-muted text-[0.72rem]">{new Date(v.voted_at).toLocaleString()}</span>
          </div>
          {v.reason && (
            <p className="text-[0.72rem] text-text-muted italic pl-1">{v.reason}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-glow rounded-2xl border border-white/[0.06] bg-[#17181e] p-6 sm:p-8 space-y-3">
      <h3 className="font-heading text-[1rem] tracking-[3px] uppercase text-text-primary font-medium">{title}</h3>
      <div className="text-[0.85rem] text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.8em] bg-white/[0.06] text-amber-300/80 px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}
