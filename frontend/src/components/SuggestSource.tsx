interface Props {
  onBack: () => void
}

export function SuggestSource({ onBack }: Props) {
  return (
    <div className="max-w-[820px] mx-auto px-6 sm:px-12 py-10 space-y-8">
      {/* Back button */}
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
        <h2 className="font-heading text-[1.8rem] sm:text-[2.2rem] font-semibold tracking-[4px] uppercase bg-gradient-to-r from-accent-green to-accent-purple bg-clip-text text-transparent">
          Suggest a Source
        </h2>
        <p className="mt-3 text-[0.88rem] text-text-secondary leading-relaxed">
          The Solana Blacklist aggregates data from multiple community sources. You can add your own by submitting a single-file pull request to the repository — no Rust code changes required.
        </p>
      </div>

      {/* How it works */}
      <Section title="How It Works">
        <p>
          Each blacklist source is a single <Code>.json</Code> file in the{' '}
          <Code>src/sources/</Code> directory. At build time, all <Code>.json</Code> files
          in that folder are automatically discovered and compiled in — so adding a new
          source is as simple as adding one file.
        </p>
      </Section>

      {/* Step by step */}
      <Section title="Step-by-Step">
        <ol className="list-decimal list-inside space-y-4 text-text-secondary">
          <li>
            <strong className="text-text-primary">Fork the repository</strong>
            <p className="mt-1 ml-5">
              Fork{' '}
              <A href="https://github.com/mrdnone/solana-blacklist">mrdnone/solana-blacklist</A>{' '}
              on GitHub.
            </p>
          </li>
          <li>
            <strong className="text-text-primary">Add your source JSON file</strong>
            <p className="mt-1 ml-5">
              Create <Code>src/sources/your_source_name.json</Code> following the schema below.
              That's the only file you need to touch.
            </p>
          </li>
          <li>
            <strong className="text-text-primary">Submit a Pull Request</strong>
            <p className="mt-1 ml-5">
              Open a PR to{' '}
              <A href="https://github.com/mrdnone/solana-blacklist/pulls">mrdnone/solana-blacklist</A>{' '}
              with a brief description of the source and why it should be included.
            </p>
          </li>
        </ol>
      </Section>

      {/* JSON Schema */}
      <Section title="Source JSON Schema">
        <p className="mb-4">
          All fields below are supported. Required fields are marked <span className="text-rose-400">*</span>.
          Optional fields can be omitted entirely or set to <Code>null</Code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-4 py-2.5 font-mono font-normal text-text-muted tracking-wider text-[0.72rem] uppercase">Field</th>
                <th className="px-4 py-2.5 font-mono font-normal text-text-muted tracking-wider text-[0.72rem] uppercase">Type</th>
                <th className="px-4 py-2.5 font-mono font-normal text-text-muted tracking-wider text-[0.72rem] uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <Field name="name" type="string" required desc='Unique source identifier, e.g. "my_source"' />
              <Field name="url" type="string" required desc="HTTP(S) endpoint returning blacklist data" />
              <Field name="handler" type='"Json" | {Csv:{…}}' required desc='Use "Json" for JSON APIs, or {"Csv": {"delimiter": 44, "headers": true}} for CSV' />
              <Field name="pubkey_path" type="string" required desc="JSONPath to extract the vote-account pubkey from each record" />
              <Field name="record_path" type="string?" desc="JSONPath to select the array of candidate records from the response root" />
              <Field name="filters" type="string[]" desc="JSONPath predicates ANDed together — records must match all to be included" />
              <Field name="reason_path" type="string?" desc="JSONPath to extract a reason string from each record" />
              <Field name="reason_template" type="string?" desc='Template with {$.path} placeholders, e.g. "Rate: {$.sandwichRate:.2}%"' />
              <Field name="name_path" type="string?" desc="JSONPath to extract the validator name from each record" />
              <Field name="fetch_headers" type="object?" desc="Extra HTTP headers to send with the request" />
              <Field name="contact_info" type="object?" desc="Contact info for the source operator — website, discord, telegram, etc." />
            </tbody>
          </table>
        </div>
      </Section>

      {/* Examples */}
      <Section title="Example: JSON API Source">
        <CodeBlock>{`{
  "name": "example_source",
  "url": "https://api.example.com/blacklist",
  "contact_info": { "website": "https://example.com" },
  "handler": "Json",
  "record_path": "$.data.validators[*]",
  "pubkey_path": "$.voteAccount",
  "filters": ["?(@.flagged == true)"],
  "reason_path": "$.reason",
  "name_path": "$.validatorName"
}`}</CodeBlock>
      </Section>

      <Section title="Example: CSV Source">
        <CodeBlock>{`{
  "name": "example_csv",
  "url": "https://docs.google.com/spreadsheets/.../export?format=csv",
  "contact_info": null,
  "handler": { "Csv": { "delimiter": 44, "headers": true } },
  "filters": [],
  "record_path": null,
  "pubkey_path": "$.c1",
  "name_path": "$.c0"
}`}</CodeBlock>
        <p className="mt-3 text-[0.82rem] text-text-muted">
          CSV rows are converted to JSON objects. Columns are accessible by header name (if enabled)
          and always by index alias: <Code>c0</Code>, <Code>c1</Code>, …
        </p>
      </Section>

      {/* Requirements */}
      <Section title="Requirements for Acceptance">
        <ul className="list-disc list-inside space-y-2 text-text-secondary">
          <li>The source must be publicly accessible (no auth, or a public API key)</li>
          <li>It must return Solana validator vote-account pubkeys</li>
          <li>The data should be regularly updated by the source maintainer</li>
          <li>Include contact info (<Code>contact_info</Code>) so we can reach the source operator</li>
        </ul>
      </Section>

      {/* CTA */}
      <div className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-8 text-center space-y-4">
        <p className="text-text-secondary text-[0.88rem]">
          Ready to contribute? Create the file directly on GitHub or open an issue to discuss first.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="https://github.com/mrdnone/solana-blacklist/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.75rem] tracking-[2px] uppercase font-mono border border-white/[0.08] rounded-full px-5 py-2 text-text-muted hover:text-accent-green hover:border-accent-green/30 hover:bg-accent-green/[0.04] transition-all duration-300"
          >
            Open Issue
            <ExternalIcon />
          </a>
          <a
            href="https://github.com/mrdnone/solana-blacklist/new/main/src/sources"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.75rem] tracking-[2px] uppercase font-mono bg-accent-green/10 border border-accent-green/20 rounded-full px-5 py-2 text-accent-green hover:bg-accent-green/15 hover:border-accent-green/30 transition-all duration-300"
          >
            Add Source File on GitHub
            <ExternalIcon />
          </a>
        </div>
      </div>
    </div>
  )
}

/* ── Reusable sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-glow rounded-2xl border border-white/[0.06] bg-[#0d0d18] p-6 sm:p-8 space-y-3">
      <h3 className="font-heading text-[1rem] tracking-[3px] uppercase text-text-primary font-medium">
        {title}
      </h3>
      <div className="text-[0.85rem] text-text-secondary leading-relaxed">{children}</div>
    </section>
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
    <pre className="mt-3 p-4 rounded-lg bg-[#080810] border border-white/[0.04] overflow-x-auto text-[0.78rem] font-mono text-text-secondary leading-relaxed">
      {children}
    </pre>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-green/80 hover:text-accent-green underline underline-offset-2 decoration-accent-green/30 transition-colors duration-300"
    >
      {children}
    </a>
  )
}

function Field({ name, type, desc, required }: { name: string; type: string; desc: string; required?: boolean }) {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-4 py-2.5 font-mono text-accent-green/80 whitespace-nowrap">
        {name}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </td>
      <td className="px-4 py-2.5 font-mono text-text-muted whitespace-nowrap">{type}</td>
      <td className="px-4 py-2.5">{desc}</td>
    </tr>
  )
}

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  )
}
