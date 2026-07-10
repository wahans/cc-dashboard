import Link from 'next/link'
import { ANNUAL_FEE_CENTS } from '@/lib/benefit-value'

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export function FeePayoffPanel({ capturedCents }: { capturedCents: number }) {
  const paidOffCents = Math.min(ANNUAL_FEE_CENTS, Math.max(0, capturedCents))
  const pct = Math.min(100, Math.round((paidOffCents / ANNUAL_FEE_CENTS) * 100))
  const remainingCents = Math.max(0, ANNUAL_FEE_CENTS - paidOffCents)

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[1.4px] text-slate-400">Annual fee payback</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{dollars(paidOffCents)} of $895 paid off</h2>
          <p className="mt-1 text-sm text-slate-300">
            {remainingCents > 0 ? `${dollars(remainingCents)} still to recover from real credits.` : 'You have recovered the full annual fee.'}
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums text-emerald-300">{pct}%</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-700" aria-label={`${pct}% of annual fee recovered`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-400">
        <span>Tracked statement credits and logged benefit usage</span>
        <Link href="/benefits" className="font-medium text-white underline decoration-slate-500 underline-offset-4 hover:decoration-white">See what to do next →</Link>
      </div>
    </section>
  )
}
