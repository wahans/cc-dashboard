import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getPeriodKey, getPeriodEnd } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function GET() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear().toString()

  const [{ count: enrolledOffersCount }] = await sql`select count(*)::int as count from enrolled_offers`
  const enrolledRows = await sql`select offer_id from enrolled_offers`
  const enrolledIds = enrolledRows.map((row) => row.offer_id)
  const enrolledSet = new Set(enrolledIds)

  const rawExpiring = await sql`
    select id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type
    from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
    order by reward_amount_cents desc limit 20
  `
  const expiringOffers = rawExpiring.filter((offer) => !enrolledSet.has(offer.id)).slice(0, 10)
  const allExpiring = await sql`
    select id from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
  `

  const enrolledExpiringOffers = await sql`
    select e.id, o.merchant, o.reward_amount_cents, o.spend_min_cents, o.expiration_date, o.reward_type
    from enrolled_offers e join amex_offers o on o.id = e.offer_id
    where e.threshold_met = false and o.expiration_date >= ${today} and o.expiration_date <= ${in30}
    order by o.expiration_date asc
  `

  const benefits = await sql`select * from amex_benefits where active = true and enrolled = true order by sort_order`
  const usage = await sql`select * from benefit_usage`
  const benefitsSummary = benefits.map((benefit) => {
    const period = benefit.reset_period as ResetPeriod
    const periodKey = getPeriodKey(period, now)
    const usedCents = usage
      .filter((item) => item.benefit_id === benefit.id && item.period_key === periodKey)
      .reduce((sum, item) => sum + Number(item.amount_used_cents), 0)
    return {
      id: benefit.id,
      name: benefit.name,
      amount_cents: Number(benefit.amount_cents),
      used_cents: usedCents,
      remaining_cents: Math.max(0, Number(benefit.amount_cents) - usedCents),
      reset_period: period,
      period_ends: getPeriodEnd(period, now).toISOString().split('T')[0],
      category: benefit.category,
    }
  })

  const benefitYTDCents = usage
    .filter((item) => String(item.period_key).startsWith(currentYear))
    .reduce((sum, item) => sum + Number(item.amount_used_cents), 0)

  return NextResponse.json({
    stats: {
      enrolledOffersCount: enrolledOffersCount ?? 0,
      expiringOffersCount: allExpiring.filter((offer) => !enrolledSet.has(offer.id)).length,
      benefitsRemainingCents: benefitsSummary.reduce((sum, benefit) => sum + benefit.remaining_cents, 0),
      valueCapturedYTDCents: benefitYTDCents,
    },
    expiringOffers,
    enrolledExpiringOffers,
    benefitsSummary,
  })
}
