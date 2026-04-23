import { useNavigate } from 'react-router-dom'

// ── Reusable primitives ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6 sm:p-8 space-y-5">
      <h2 className="font-heading text-[1rem] tracking-[3px] uppercase text-text-primary font-medium">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Tag({ color, children }: { color: 'green' | 'amber' | 'purple' | 'cyan'; children: React.ReactNode }) {
  const styles = {
    green:  'border-accent-green/20 bg-accent-green/[0.06] text-accent-green',
    amber:  'border-amber-500/20 bg-amber-500/[0.06] text-amber-400',
    purple: 'border-accent-purple/20 bg-accent-purple/[0.06] text-accent-purple',
    cyan:   'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] tracking-[1px] uppercase font-mono ${styles[color]}`}>
      {children}
    </span>
  )
}

function Method({ m }: { m: 'GET' | 'POST' | 'DELETE' }) {
  const styles = {
    GET:    'text-accent-green border-accent-green/30 bg-accent-green/[0.06]',
    POST:   'text-amber-400 border-amber-400/30 bg-amber-400/[0.06]',
    DELETE: 'text-rose-400 border-rose-400/30 bg-rose-400/[0.06]',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.68rem] font-mono font-semibold tracking-widest shrink-0 ${styles[m]}`}>
      {m}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.8em] bg-white/[0.06] text-accent-green/80 px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="p-4 rounded-lg bg-[#080810] border border-white/[0.04] overflow-x-auto text-[0.78rem] font-mono text-text-secondary leading-relaxed">
      {children}
    </pre>
  )
}

function ParamRow({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-4 py-2.5 font-mono text-[0.78rem] text-accent-green/80 whitespace-nowrap">
        {name}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </td>
      <td className="px-4 py-2.5 font-mono text-[0.72rem] text-text-muted whitespace-nowrap">{type}</td>
      <td className="px-4 py-2.5 text-[0.82rem] text-text-secondary">{desc}</td>
    </tr>
  )
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-4 py-2 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-muted">Parameter</th>
            <th className="px-4 py-2 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-muted">Type</th>
            <th className="px-4 py-2 text-[0.65rem] font-mono font-normal tracking-[2px] uppercase text-text-muted">Description</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

interface EndpointProps {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  summary: string
  children: React.ReactNode
}

function Endpoint({ method, path, summary, children }: EndpointProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] flex-wrap gap-y-2">
        <Method m={method} />
        <code className="font-mono text-[0.85rem] text-text-primary">{path}</code>
        <span className="text-[0.78rem] text-text-muted ml-auto hidden sm:block">{summary}</span>
      </div>
      <div className="px-5 py-4 space-y-4 text-[0.85rem] text-text-secondary">
        {children}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ApiDocsPage() {
  const navigate = useNavigate()
  const base = '/api'
  const swaggerUrl = `${import.meta.env.VITE_API_ORIGIN ?? ''}/docs`

  return (
    <div className="max-w-[900px] mx-auto px-6 sm:px-12 py-10 space-y-8">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[0.78rem] tracking-[2px] uppercase text-text-muted hover:text-accent-green transition-colors duration-300 font-mono"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Title */}
      <div className="space-y-3">
        <h1 className="font-heading text-[1.8rem] sm:text-[2.2rem] font-semibold tracking-[4px] uppercase bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent">
          API Reference
        </h1>
        <p className="text-[0.88rem] text-text-secondary leading-relaxed">
          All endpoints are served under <Code>{base}</Code>. Responses are JSON.
          The interactive Swagger UI is available at{' '}
          <a href={swaggerUrl} target="_blank" rel="noopener noreferrer"
             className="text-accent-green/80 hover:text-accent-green underline underline-offset-2 decoration-accent-green/30 transition-colors">
            /docs
          </a>.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Tag color="green">Blacklist</Tag>
          <Tag color="amber">Meridian</Tag>
          <Tag color="purple">Admin</Tag>
        </div>
      </div>

      {/* ── Blacklist ── */}
      <Section title="Blacklist">
        <Endpoint method="GET" path="/api/sources" summary="List all configured blacklist sources">
          <p>Returns a map of all configured sources keyed by source name, including their URL, handler type, and contact info.</p>
          <CodeBlock>{`GET /api/sources

// Response
{
  "jito:blacklist": {
    "name": "jito",
    "url": "https://docs.google.com/...",
    "contact_info": { "discord": "https://discord.gg/jito" },
    ...
  },
  "solana::sfdp_rejects": { ... },
  ...
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/blacklist" summary="Get full aggregated blacklist">
          <ParamTable>
            <ParamRow name="source" type="string?" desc="Filter results to a single source name, e.g. jito:blacklist" />
          </ParamTable>
          <CodeBlock>{`GET /api/blacklist
GET /api/blacklist?source=jito:blacklist

// Response
{
  "unique_pubkeys": 142,
  "sources": 4,
  "fetched_at": "2025-04-23T10:00:00Z",
  "entries": [
    {
      "pubkey": "ENVaKoD7...",
      "name": "My Validator",
      "first_seen": "2025-01-15T00:00:00Z",
      "sources": [
        { "name": "jito:blacklist", "reason": null }
      ]
    }
  ]
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/blacklist/{pubkey}" summary="Look up a single pubkey">
          <p>Accepts both vote account and identity pubkeys. Resolves identity → vote account automatically.</p>
          <CodeBlock>{`GET /api/blacklist/ENVaKoD7ytn58xJ8s5htFfQ8hqQt1G9dcPUDqbSwVcgB

// Response — blacklisted
{
  "pubkey": "ENVaKoD7...",
  "identity": "AbcXyz...",
  "blacklisted": true,
  "name": "My Validator",
  "first_seen": "2025-01-15T00:00:00Z",
  "sources": [{ "name": "jito:blacklist", "reason": null }],
  "in_validators_db": true
}

// Response — clean
{
  "pubkey": "ENVaKoD7...",
  "blacklisted": false,
  "sources": [],
  "in_validators_db": true
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/validators" summary="Paginated validator list">
          <ParamTable>
            <ParamRow name="q" type="string?" desc="Search by name, vote pubkey, or node pubkey" />
            <ParamRow name="delinquent" type="bool?" desc="Filter by delinquent status" />
            <ParamRow name="exclude_zero_stake" type="bool?" desc="Exclude validators with zero active stake" />
            <ParamRow name="limit" type="u32?" desc="Results per page — default 50, max 500" />
            <ParamRow name="offset" type="u32?" desc="Pagination offset" />
          </ParamTable>
          <CodeBlock>{`GET /api/validators?q=my+validator&limit=20&offset=0

// Response
{
  "validators": [ { "vote_identity": "...", "name": "...", ... } ],
  "total": 1240,
  "limit": 20,
  "offset": 0
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/validators/{pubkey}" summary="Validator detail + epoch history">
          <CodeBlock>{`GET /api/validators/ENVaKoD7ytn58xJ8s5htFfQ8hqQt1G9dcPUDqbSwVcgB

// Response
{
  "vote_identity": "ENVaKoD7...",
  "current": { "name": "My Validator", "commission": 5, ... },
  "epochs": [
    {
      "epoch": 742,
      "is_blacklisted": true,
      "blacklist_sources": [{ "name": "jito:blacklist", "reason": null }],
      ...
    }
  ]
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/epochs" summary="List epochs with snapshot data">
          <CodeBlock>{`GET /api/epochs

// Response — array of epoch summaries
[
  { "epoch": 742, "validator_count": 1420, "snapshotted_at": "..." },
  ...
]`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/epochs/{epoch}" summary="Paginated validator snapshots for an epoch">
          <ParamTable>
            <ParamRow name="epoch" type="u64" required desc="Epoch number (path parameter)" />
            <ParamRow name="q" type="string?" desc="Search by name or pubkey" />
            <ParamRow name="blacklisted_only" type="bool?" desc="Return only blacklisted validators" />
            <ParamRow name="delinquent" type="bool?" desc="Filter by delinquent status" />
            <ParamRow name="limit" type="u32?" desc="Default 50, max 500" />
            <ParamRow name="offset" type="u32?" desc="Pagination offset" />
          </ParamTable>
          <CodeBlock>{`GET /api/epochs/742?blacklisted_only=true&limit=50

// Response
{
  "epoch": 742,
  "validator_count": 138,
  "validators": [ { "vote_identity": "...", "is_blacklisted": true, ... } ],
  "total": 138,
  "limit": 50,
  "offset": 0
}`}</CodeBlock>
        </Endpoint>
      </Section>

      {/* ── Meridian ── */}
      <Section title="Meridian — Community Blacklist Reports">
        <p className="text-[0.85rem] text-text-secondary leading-relaxed">
          Active validators can cryptographically sign a report to flag a target validator for blacklisting.
          Once a target accumulates <strong className="text-amber-300">10 reports</strong> from distinct validators,
          it is reviewed and may be added to the blacklist.
        </p>

        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-5 py-4 space-y-2 text-[0.82rem] text-text-secondary">
          <p className="text-amber-300 font-mono text-[0.75rem] tracking-[2px] uppercase">How to submit a report</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Pick the target vote account pubkey.</li>
            <li>Get the current Unix timestamp (seconds): <Code>date +%s</Code></li>
            <li>Build the canonical message: <Code>meridian:blacklist:&lt;target&gt;:&lt;timestamp&gt;</Code></li>
            <li>Sign it with your validator identity keypair:<br />
              <code className="block mt-1.5 bg-[#080810] border border-white/[0.04] rounded px-3 py-2 text-[0.75rem] text-amber-300/80 font-mono">
                solana sign-offchain-message -k &lt;identity-keypair&gt; "meridian:blacklist:&lt;target&gt;:&lt;ts&gt;"
              </code>
            </li>
            <li>POST the result to <Code>/api/votes</Code>.</li>
          </ol>
        </div>

        <Endpoint method="POST" path="/api/votes" summary="Submit a blacklist report">
          <CodeBlock>{`POST /api/votes
Content-Type: application/json

{
  "voter_identity": "<your validator identity pubkey>",
  "target_vote_pubkey": "<target vote account pubkey>",
  "signature": "<base58 ed25519 signature>",
  "voted_at_ts": 1714000000,
  "reason": "Sandwich attacks targeting delegators"
}

// Response
{ "status": "ok", "inserted": true }`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/votes" summary="List all report targets with counts">
          <CodeBlock>{`GET /api/votes

// Response
{
  "threshold": 10,
  "targets": [
    { "target_vote_pubkey": "ENVaKoD7...", "vote_count": 7 }
  ]
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/votes/{target}" summary="Reports for a specific target">
          <CodeBlock>{`GET /api/votes/ENVaKoD7ytn58xJ8s5htFfQ8hqQt1G9dcPUDqbSwVcgB

// Response
{
  "target": "ENVaKoD7...",
  "vote_count": 7,
  "threshold": 10,
  "blacklisted": false,
  "votes": [
    {
      "voter_identity": "AbcXyz...",
      "signature": "...",
      "voted_at": "2025-04-01T12:00:00Z",
      "reason": "Sandwich attacks targeting delegators"
    }
  ]
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/meridian/info" summary="Reporting system info and instructions">
          <p>Returns a human-readable JSON description of the Meridian reporting system and available endpoints.</p>
        </Endpoint>
      </Section>

      {/* ── Admin ── */}

      {/* ── Swagger link ── */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.85rem] text-text-primary font-medium">Interactive API Explorer</p>
          <p className="text-[0.78rem] text-text-muted mt-0.5">Try every endpoint directly in the browser via Swagger UI.</p>
        </div>
        <a
          href={swaggerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[0.72rem] tracking-[2px] uppercase font-mono border border-accent-green/25 rounded-full px-5 py-2.5 text-accent-green hover:bg-accent-green/10 hover:border-accent-green/40 transition-all duration-300 whitespace-nowrap"
        >
          Open Swagger UI
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      </div>

    </div>
  )
}
