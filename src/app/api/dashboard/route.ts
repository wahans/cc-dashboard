import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getYearUsageCents } from '@/lib/benefits'
import { countDistinctOfferMerchants, selectDiverseOffers } from '@/lib/offer-display'

export async function GET() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear()

  const [{ count: enrolledOffersCount }] = await sql`select count(*)::int as count from enrolled_offers`
  const enrolledRows = await sql`select offer_id from enrolled_offers`
  const enrolledIds = enrolledRows.map((row) => row.offer_id)
  const enrolledSet = new Set(enrolledIds)

  const rawExpiring = await sql`
    select id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type
    from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
    order by reward_amount_cents desc
  `
  const expiringOffers = selectDiverseOffers(
    rawExpiring.filter((offer) => !enrolledSet.has(offer.id)) as Array<{ merchant: string }>,
    10
  )
  const allExpiring = await sql`
    select id, merchant from amex_offers
    where active = true and expiration_date >= ${today} and expiration_date <= ${in14}
  `

  const enrolledExpiringOffers = await sql`
    select e.id, o.merchant, o.reward_amount_cents, o.spend_min_cents, o.expiration_date, o.reward_type
    from enrolled_offers e join amex_offers o on o.id = e.offer_id
    where e.threshold_met = false and o.expiration_date >= ${today} and o.expiration_date <= ${in30}
    order by o.expiration_date asc
  `

  const benefits = await sql`select * from amex_benefits where active = true order by sort_order`
  const usage = await sql`select * from benefit_usage`
  const benefitsSummary = benefits.map((benefit) => {
    const usedCents = Math.min(
      Number(benefit.amount_cents),
      getYearUsageCents(
        benefit.id as string,
        usage as Array<{ benefit_id: string; period_key: string; amount_used_cents: number }>,
        currentYear
      )
    )
    return {
      id: benefit.id,
      name: benefit.name,
      amount_cents: Number(benefit.amount_cents),
      used_cents: usedCents,
      remaining_cents: Math.max(0, Number(benefit.amount_cents) - usedCents),
      category: benefit.category,
      enrolled: Boolean(benefit.enrolled),
    }
  }).filter((benefit) => benefit.enrolled || benefit.used_cents > 0)

  const benefitYTDCents = benefitsSummary.reduce(
    (sum, benefit) => sum + benefit.used_cents,
    0
  )

  return NextResponse.json({
    stats: {
      enrolledOffersCount: enrolledOffersCount ?? 0,
      expiringOffersCount: countDistinctOfferMerchants(
        allExpiring.filter((offer) => !enrolledSet.has(offer.id)) as Array<{ merchant: string }>
      ),
      benefitsRemainingCents: benefitsSummary.reduce((sum, benefit) => sum + benefit.remaining_cents, 0),
      valueCapturedYTDCents: benefitYTDCents,
    },
    expiringOffers,
    enrolledExpiringOffers,
    benefitsSummary,
  })
}
