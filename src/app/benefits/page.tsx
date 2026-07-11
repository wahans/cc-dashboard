import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { BenefitCard } from '@/components/benefits/BenefitCard'

export const metadata: Metadata = { title: 'Benefits' }
import type { Benefit } from '@/components/benefits/BenefitCard'
import { getBenefitGuidance, sortByBenefitValue } from '@/lib/benefit-value'

async function getBenefits(): Promise<Benefit[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cookieHeader = (await cookies()).toString()
  const res = await fetch(`${baseUrl}/api/benefits`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function BenefitsPage() {
  const benefits = await getBenefits()

  const enrolled = sortByBenefitValue(benefits.filter((b) => b.enrolled))
  const unenrolled = benefits.filter((b) => !b.enrolled && b.enrollment_required)
  const highValue = enrolled.filter((b) => ['core', 'good-fit'].includes(getBenefitGuidance(b.name).priority))
  const optional = enrolled.filter((b) => !['core', 'good-fit'].includes(getBenefitGuidance(b.name).priority))

  const totalRemainingCents = enrolled.reduce((sum, b) => sum + b.remaining_cents, 0)
  const unenrolledValueCents = unenrolled.reduce((sum, b) => sum + b.amount_cents, 0)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-balance">Benefits Tracker</h1>
        <p className="text-muted-foreground mt-1 text-pretty">
          <span className="font-medium text-foreground">${(totalRemainingCents / 100).toFixed(0)}</span> available if it replaces spending you already planned
          {unenrolledValueCents > 0 && (
            <> · <span className="text-amber-600 font-medium">${(unenrolledValueCents / 100).toFixed(0)}/yr left on the table</span></>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-3 text-pretty">
          Progress is year-to-date from Lucent and manual entries.{' '}
          <Link href="/import" className="text-blue-600 hover:text-blue-800 font-medium">
            Use CSV fallback only when Lucent is missing transactions →
          </Link>
        </p>
      </div>

      {unenrolled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-amber-700 text-balance">⚠ Needs Enrollment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortByBenefitValue(unenrolled).map((b) => (
              <BenefitCard key={b.id} benefit={b}  />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-balance">Best-fit benefits</h2>
            <p className="text-sm text-muted-foreground text-pretty">Start here: these are the most realistic ways to recover the fee without manufacturing spend.</p>
          </div>
          <span className="hidden sm:block text-xs font-medium text-emerald-700">{highValue.length} prioritized</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {highValue.map((b) => (
            <BenefitCard key={b.id} benefit={b}  />
          ))}
        </div>
      </section>

      {optional.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1 text-balance">Optional / skip for now</h2>
          <p className="text-sm text-muted-foreground mb-3 text-pretty">These only count as value when they replace a purchase or membership you already wanted.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optional.map((b) => <BenefitCard key={b.id} benefit={b} />)}
          </div>
        </section>
      )}
    </div>
  )
}
