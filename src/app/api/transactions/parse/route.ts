import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate, OfferMatchResult } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

type BenefitMatchResult = {
  benefit_id: string
  benefit_name: string
  amount_cents: number
  date: string
  notes: string
  period_key: string
  duplicate: boolean
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { csv } = body as { csv?: string }
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  // ── Benefits matching ──────────────────────────────────────────────
  const benefits = await sql`select id, name, reset_period from amex_benefits where active = true`

  const benefitMatches: BenefitMatchResult[] = []

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description
    const amount_cents = Math.round(txn.amount * 100)

    // Dedup: exact CSV/manual match, or any Lucent reconciliation for the
    // benefit period. Lucent records are aggregated, so importing the same
    // statement credit separately would double-count captured value.
    const [existing] = await sql`
      select id from benefit_usage
      where benefit_id = ${benefit.id} and period_key = ${periodKey}
        and (notes = ${notes} or source = 'budget_sync')
      limit 1
    `

    benefitMatches.push({
      benefit_id: benefit.id,
      benefit_name: benefitName,
      amount_cents,
      date: txn.date,
      notes,
      period_key: periodKey,
      duplicate: !!existing,
    })
  }

  // ── Offers matching ───────────────────────────────────────────────
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

  const offerMatches: OfferMatchResult[] = matchToOffers(transactions, offerInputs)

  return NextResponse.json({
    transaction_count: transactions.length,
    benefit_matches: benefitMatches,
    offer_matches: offerMatches,
  })
}
