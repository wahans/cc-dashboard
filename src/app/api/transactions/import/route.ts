import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { csv } = body as { csv?: string }
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  // ── Benefits ──────────────────────────────────────────────────────
  const benefits = await sql`select id, name, reset_period from amex_benefits where active = true`

  let benefitsImported = 0
  let benefitsSkipped = 0

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description

    // Dedup check
    const [existing] = await sql`
      select id from benefit_usage
      where benefit_id = ${benefit.id} and period_key = ${periodKey} and notes = ${notes}
      limit 1
    `

    if (existing) {
      benefitsSkipped++
      continue
    }

    await sql`
      insert into benefit_usage (benefit_id, amount_used_cents, period_key, notes, source)
      values (${benefit.id}, ${Math.round(txn.amount * 100)}, ${periodKey}, ${notes}, 'csv')
    `
    benefitsImported++
  }

  // ── Offers ────────────────────────────────────────────────────────
  const enrolledOffers = await sql`
    select e.id, e.offer_id, o.merchant, o.spend_min_cents
    from enrolled_offers e join amex_offers o on o.id = e.offer_id
    where e.threshold_met = false
  `

  const offerInputs = enrolledOffers.map((e) => ({
    enrollment_id: e.id as string,
    offer_id: e.offer_id as string,
    merchant: e.merchant ?? '',
    spend_min_cents: e.spend_min_cents ?? null,
  }))

  const offerMatches = matchToOffers(transactions, offerInputs)
  let offersUpdated = 0

  for (const match of offerMatches) {
    await sql`
      update enrolled_offers
      set threshold_met = true, completed_at = ${new Date().toISOString()},
          spent_amount_cents = ${match.total_spent_cents}
      where id = ${match.enrollment_id}
    `
    offersUpdated++
  }

  return NextResponse.json({
    benefits_imported: benefitsImported,
    benefits_skipped: benefitsSkipped,
    offers_updated: offersUpdated,
  })
}
