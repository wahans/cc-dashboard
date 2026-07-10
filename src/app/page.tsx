import type { Metadata } from 'next'
import { sql } from '@/lib/db'
import { getPeriodKey, getPeriodEnd } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'
import { StatCard } from '@/components/dashboard/StatCard'
import { ExpiringOffersPanel } from '@/components/dashboard/ExpiringOffersPanel'
import { BenefitsSummaryPanel } from '@/components/dashboard/BenefitsSummaryPanel'
import { BudgetSyncButton } from '@/components/dashboard/BudgetSyncButton'
import { SyncHistoryPanel } from '@/components/dashboard/SyncHistoryPanel'
import { FeePayoffPanel } from '@/components/dashboard/FeePayoffPanel'
import type { SyncLogRow } from '@/types/sync'
import { ANNUAL_FEE_CENTS } from '@/lib/benefit-value'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

function formatDollars(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export default async function DashboardPage() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear().toString()

  const [{ count: enrolledOffersCount }] = await sql`select count(*)::int as count from enrolled_offers`
  const enrolledRows = await sql`select offer_id from enrolled_offers`

  const enrolledIds = (enrolledRows ?? []).map((r) => r.offer_id as string)
  const enrolledSet = new Set(enrolledIds)

  const rawExpiring = await sql`
    select id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type
    from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
    order by reward_amount_cents desc limit 20
  `

  const expiringOffers = rawExpiring
    .filter((o) => !enrolledSet.has(o.id))
    .slice(0, 10) as unknown as Parameters<typeof ExpiringOffersPanel>[0]['unenrolledOffers']

  const allExpiring = await sql`
    select id from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
  `
  const unenrolledExpiringCount = allExpiring.filter((o) => !enrolledSet.has(o.id)).length

  const rawEnrolledExpiring = await sql`
    select e.id, e.spent_amount_cents, o.merchant, o.reward_amount_cents,
           o.spend_min_cents, o.expiration_date, o.reward_type
    from enrolled_offers e
    join amex_offers o on o.id = e.offer_id
    where e.threshold_met = false and o.expiration_date >= ${today} and o.expiration_date <= ${in30}
    order by o.expiration_date asc
  `

  const enrolledExpiringOffers = rawEnrolledExpiring.map((row) => ({
      id: row.id as string,
      spent_amount_cents: (row.spent_amount_cents as number | null) ?? 0,
      merchant: row.merchant as string,
      reward_amount_cents: row.reward_amount_cents as number | null,
      spend_min_cents: row.spend_min_cents as number | null,
      expiration_date: row.expiration_date as string,
      reward_type: row.reward_type as string,
    }))

  const enrolledPendingIn14d = enrolledExpiringOffers.filter(
    (o) => o.expiration_date && o.expiration_date <= in14
  ).length

  const benefits = await sql`select * from amex_benefits where active = true and enrolled = true order by sort_order`
  const usage = await sql`select * from benefit_usage`

  const benefitsSummary = benefits.map((b) => {
    const period = b.reset_period as ResetPeriod
    const periodKey = getPeriodKey(period, now)
    const periodEnd = getPeriodEnd(period, now)
    const periodUsage = usage.filter((u) => u.benefit_id === b.id && u.period_key === periodKey)
    const usedCents = periodUsage.reduce((sum, u) => sum + Number(u.amount_used_cents), 0)
    const remainingCents = Math.max(0, b.amount_cents - usedCents)
    return {
      id: b.id as string,
      name: b.name as string,
      amount_cents: Number(b.amount_cents),
      used_cents: usedCents,
      remaining_cents: remainingCents,
      reset_period: period,
      period_ends: periodEnd.toISOString().split('T')[0],
      category: b.category as string,
    }
  })

  benefitsSummary.sort((a, b) => b.remaining_cents - a.remaining_cents)

  const benefitsRemainingCents = benefitsSummary.reduce((sum, b) => sum + b.remaining_cents, 0)

  const ytdUsage = await sql`select amount_used_cents from benefit_usage where period_key like ${currentYear + '%'} `

  const benefitYTDCents = (ytdUsage ?? []).reduce(
    (sum, u) => sum + Number(u.amount_used_cents), 0
  )

  const [lastSyncRow] = await sql`
    select created_at from benefit_usage where source = 'budget_sync'
    order by created_at desc limit 1
  `

  const lastBudgetSync = lastSyncRow?.created_at ?? null

  const syncLogRows = await sql`
    select id, type, ran_at, records_processed, records_updated, error
    from sync_log order by ran_at desc limit 20
  `

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Amex Platinum — rewards at a glance</p>
        </div>
        <BudgetSyncButton lastSyncedAt={lastBudgetSync} />
      </div>
      <FeePayoffPanel capturedCents={Math.min(ANNUAL_FEE_CENTS, benefitYTDCents)} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Enrolled Offers" value={(enrolledOffersCount ?? 0).toString()}
  accent="blue" />
        <StatCard
          label="Expiring in 14d"
          value={(unenrolledExpiringCount + enrolledPendingIn14d).toString()}
          subtext={[
            unenrolledExpiringCount > 0 ? `${unenrolledExpiringCount} to enroll` : '',
            enrolledPendingIn14d > 0 ? `${enrolledPendingIn14d} to complete` : '',
          ].filter(Boolean).join(' · ') || undefined}
          accent={enrolledPendingIn14d > 0 ? 'red' : unenrolledExpiringCount > 0 ? 'amber' : 'default'}
        />
        <StatCard label="Benefits Remaining" value={formatDollars(benefitsRemainingCents)}
  subtext="this period" accent="green" />
        <StatCard label="Credits Captured YTD" value={formatDollars(benefitYTDCents)}
  subtext="actual benefit value" accent="default" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BenefitsSummaryPanel benefits={benefitsSummary} />
        <ExpiringOffersPanel unenrolledOffers={expiringOffers} enrolledOffers={enrolledExpiringOffers} />
      </div>
      <SyncHistoryPanel rows={(syncLogRows ?? []) as SyncLogRow[]} />
    </div>
  )
}
